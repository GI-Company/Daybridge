-- Free beta hardening. No participant, credential, snapshot, or history rows change.
-- Apply this single additive migration; never replay consolidated historical files.
set lock_timeout = '5s';

create function daybridge_private.workspace_access_for_user(p_user_id uuid) returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid := p_user_id; v_status text; v_metadata jsonb;
begin
 if v_user is null then return false; end if;
 select raw_app_meta_data into v_metadata from auth.users where id=v_user;
 if not found then return false; end if;
 -- Read current server-owned metadata: a pre-reset JWT cannot bypass setup.
 if v_metadata->>'daybridge_managed'='true' and
    v_metadata->>'daybridge_must_change_password'='true' then return false; end if;
 select status into v_status from public.daybridge_court_participants where user_id=v_user;
 if v_status is null then
  return coalesce(v_metadata->>'daybridge_managed','false')<>'true';
 end if; -- existing independent personal accounts retain access; unassigned managed users do not
 if v_status='active' then return true; end if;
 if v_status<>'removed' then return false; end if; -- suspension cannot be bypassed by paying
 return exists(select 1 from public.daybridge_billing_subscriptions s
  where s.user_id=v_user and s.status in ('active','past_due') and s.access_until>now()
  and not exists(select 1 from public.daybridge_billing_risks r where r.subscription_id=s.subscription_id and r.blocks_access));
end;
$$;
revoke all on function daybridge_private.workspace_access_for_user(uuid) from public,anon,authenticated;
grant usage on schema daybridge_private to service_role;
grant execute on function daybridge_private.workspace_access_for_user(uuid) to service_role;

-- Browser authorization has no caller-selected identity.
create or replace function daybridge_private.workspace_access() returns boolean
language sql stable security definer set search_path='' as $$
 select daybridge_private.workspace_access_for_user((select auth.uid()));
$$;
revoke all on function daybridge_private.workspace_access() from public,anon,service_role;
grant execute on function daybridge_private.workspace_access() to authenticated;

-- Owner policies remain in force. Old JWTs must also respect reset/suspension
-- when using the remaining directly accessible travel/device APIs.
do $$
declare t text;
begin
 foreach t in array array['travel_preferences','travel_appointments','travel_estimates',
  'notification_deliveries','push_subscriptions','private_security_audit'] loop
  execute format('create policy "workspace entitlement" on public.%I as restrictive for all to authenticated using ((select daybridge_private.workspace_access())) with check ((select daybridge_private.workspace_access()))',t);
 end loop;
end;
$$;

-- Background work must apply the same fresh entitlement as browser RLS.
-- Return only reminder/travel fields; notes, accounts, contacts and other private
-- snapshot fields do not need to cross the database boundary every minute.
create function public.daybridge_reminder_snapshot(p_user_id uuid)
returns table(payload jsonb)
language sql stable security invoker set search_path='' as $$
 select (select jsonb_object_agg(item.key,item.value)
         from jsonb_each(s.payload) item
         where item.key in ('profile','events','eventOccurrences','tasks','medications',
          'medicationSchedules','medicationLogs','bills','savedPlaces'))
 from public.private_snapshots s
 where s.user_id=p_user_id and daybridge_private.workspace_access_for_user(p_user_id);
$$;
revoke all on function public.daybridge_reminder_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.daybridge_reminder_snapshot(uuid) to service_role;

create or replace function public.daybridge_assign_participant(
  p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_limit integer;
  v_subscription text;
  v_count integer;
begin
  if not exists (
    select 1 from public.daybridge_court_staff s
    where s.court_id = p_court_id and s.user_id = p_actor_id and s.active
  ) then raise exception 'Not an authorized court administrator'; end if;

  select c.seat_limit,c.subscription_status into v_limit,v_subscription from public.daybridge_courts c
  where c.id = p_court_id and c.enabled for update;
  if not found then raise exception 'Court unavailable'; end if;

  if v_subscription not in ('pilot','active') then raise exception 'Court subscription is inactive'; end if;

  select count(*) into v_count from public.daybridge_court_participants p
  where p.court_id = p_court_id and p.status in ('active','suspended');
  if v_count >= v_limit then raise exception 'Court seat limit reached'; end if;

  insert into public.daybridge_court_participants
    (user_id,court_id,username,created_by)
  values (p_user_id,p_court_id,p_username,p_actor_id);

  insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values (p_court_id,p_actor_id,p_user_id,'participant_created');
end;
$$;
revoke all on function public.daybridge_assign_participant(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.daybridge_assign_participant(uuid,uuid,text,uuid)
  to service_role;

create or replace function public.daybridge_transition_participant(
  p_court_id uuid, p_user_id uuid, p_actor_id uuid, p_action text
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_limit integer;
  v_subscription text;
  v_count integer;
  v_status text;
  v_next text;
begin
  if p_action not in ('suspend','restore','remove') then
    raise exception 'Unsupported account action';
  end if;
  if not exists (
    select 1 from public.daybridge_court_staff s
    where s.court_id = p_court_id and s.user_id = p_actor_id and s.active
  ) then raise exception 'Not an authorized court administrator'; end if;

  select c.seat_limit,c.subscription_status into v_limit,v_subscription from public.daybridge_courts c
  where c.id = p_court_id and c.enabled for update;
  if not found then raise exception 'Court unavailable'; end if;

  select p.status into v_status from public.daybridge_court_participants p
  where p.court_id = p_court_id and p.user_id = p_user_id for update;
  if not found then raise exception 'Participant not assigned to court'; end if;

  if p_action = 'restore' and v_status <> 'active' and v_subscription not in ('pilot','active') then
    raise exception 'Court subscription is inactive';
  end if;

  v_next := case when p_action = 'restore' then 'active'
                 when p_action = 'suspend' then 'suspended'
                 else 'removed' end;
  if v_next in ('active','suspended') and v_status = 'removed' then
    select count(*) into v_count from public.daybridge_court_participants p
    where p.court_id = p_court_id and p.status in ('active','suspended');
    if v_count >= v_limit then raise exception 'Court seat limit reached'; end if;
  end if;

  update public.daybridge_court_participants
  set status = v_next, updated_at = now()
  where court_id = p_court_id and user_id = p_user_id;

  insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values (p_court_id,p_actor_id,p_user_id,'participant_' || p_action);

  return v_next;
end;
$$;
revoke all on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  to service_role;

