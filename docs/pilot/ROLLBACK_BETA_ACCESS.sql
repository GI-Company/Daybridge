-- Emergency rollback only, after reviewing the beta security regressions it reopens.
-- Deploy the prior application commit first; the new worker needs its projection RPC.
-- This restores schema definitions only and never restores/overwrites user records.
begin;
set local lock_timeout='5s';

CREATE OR REPLACE FUNCTION daybridge_private.workspace_access()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid := (select auth.uid()); v_status text;
begin
 if v_user is null then return false; end if;
 select status into v_status from public.daybridge_court_participants where user_id=v_user;
 if v_status is null then
  return not exists(select 1 from auth.users where id=v_user and raw_app_meta_data->>'daybridge_managed'='true');
 end if; -- existing independent personal accounts retain access; unassigned managed users do not
 if v_status='active' then return true; end if;
 if v_status<>'removed' then return false; end if; -- suspension cannot be bypassed by paying
 return exists(select 1 from public.daybridge_billing_subscriptions s
  where s.user_id=v_user and s.status in ('active','past_due') and s.access_until>now()
  and not exists(select 1 from public.daybridge_billing_risks r where r.subscription_id=s.subscription_id and r.blocks_access));
end;
$function$;

CREATE OR REPLACE FUNCTION public.daybridge_assign_participant(p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_limit integer;
  v_count integer;
begin
  if not exists (
    select 1 from public.daybridge_court_staff s
    where s.court_id = p_court_id and s.user_id = p_actor_id and s.active
  ) then raise exception 'Not an authorized court administrator'; end if;

  select c.seat_limit into v_limit from public.daybridge_courts c
  where c.id = p_court_id and c.enabled for update;
  if not found then raise exception 'Court unavailable'; end if;

  select count(*) into v_count from public.daybridge_court_participants p
  where p.court_id = p_court_id and p.status in ('active','suspended');
  if v_count >= v_limit then raise exception 'Court seat limit reached'; end if;

  insert into public.daybridge_court_participants
    (user_id,court_id,username,created_by)
  values (p_user_id,p_court_id,p_username,p_actor_id);

  insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values (p_court_id,p_actor_id,p_user_id,'participant_created');
end;
$function$;

CREATE OR REPLACE FUNCTION public.daybridge_transition_participant(p_court_id uuid, p_user_id uuid, p_actor_id uuid, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_limit integer;
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

  select c.seat_limit into v_limit from public.daybridge_courts c
  where c.id = p_court_id and c.enabled for update;
  if not found then raise exception 'Court unavailable'; end if;

  select p.status into v_status from public.daybridge_court_participants p
  where p.court_id = p_court_id and p.user_id = p_user_id for update;
  if not found then raise exception 'Participant not assigned to court'; end if;

  v_next := case when p_action = 'restore' then 'active'
                 when p_action = 'suspend' then 'suspended'
                 else 'removed' end;
  if v_next = 'active' and v_status = 'removed' then
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
$function$;

drop policy "workspace entitlement" on public.travel_preferences;
drop policy "workspace entitlement" on public.travel_appointments;
drop policy "workspace entitlement" on public.travel_estimates;
drop policy "workspace entitlement" on public.notification_deliveries;
drop policy "workspace entitlement" on public.push_subscriptions;
drop policy "workspace entitlement" on public.private_security_audit;
drop function public.daybridge_reminder_snapshot(uuid);
drop function daybridge_private.workspace_access_for_user(uuid);
commit;
