-- Existing staff retain access. Only new credentials/resets require rotation.
alter table public.daybridge_court_staff
 add column password_change_required boolean not null default false,
 add column credential_version uuid,
 add column credential_valid_after timestamptz,
 add column credential_operation_until timestamptz;

-- Never turn participant or owner identities into court-managed credentials.
create or replace function daybridge_private.confirmed_staff(p_email text) returns uuid
language sql stable security definer set search_path='' as $$
 select u.id from auth.users u where lower(u.email)=lower(p_email) and u.email_confirmed_at is not null
  and coalesce(u.raw_app_meta_data->>'daybridge_managed','false')<>'true'
  and coalesce(u.raw_app_meta_data->>'daybridge_platform_owner','false')<>'true'
  and not exists(select 1 from public.daybridge_court_participants p where p.user_id=u.id);
$$;
revoke all on function daybridge_private.confirmed_staff(text) from public,anon,authenticated;
grant execute on function daybridge_private.confirmed_staff(text) to service_role;

create function daybridge_private.staff_identity(p_user uuid)
 returns table(email text,managed boolean) language sql stable security definer set search_path='' as $$
 select u.email,coalesce(u.raw_app_meta_data->>'daybridge_staff_managed','false')='true'
 from auth.users u where u.id=p_user;
$$;
revoke all on function daybridge_private.staff_identity(uuid) from public,anon,authenticated;
grant execute on function daybridge_private.staff_identity(uuid) to service_role;

-- Claim a short exclusive credential operation before calling Auth. A failed reset
-- stays restricted; retrying a reset issues a new secret rather than restoring one.
create function public.daybridge_owner_staff_credentials(
 p_actor uuid,p_court uuid,p_user uuid,p_action text,p_version uuid,
 p_username text default null,p_role text default null
) returns text language plpgsql security invoker set search_path='' as $$
declare v_email text; v_expected text; v_member public.daybridge_court_staff; v_managed boolean;
begin
 if not daybridge_private.platform_owner(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_action not in ('create','reset') or p_version is null then raise exception 'Invalid credential action'; end if;
 perform 1 from public.daybridge_courts where id=p_court for update;
 if not found then raise exception 'Court not found'; end if;
 select s.* into v_member from public.daybridge_court_staff s where s.court_id=p_court and s.user_id=p_user for update;
 if v_member.credential_operation_until>now() then raise exception 'A credential operation is already running. Retry shortly.'; end if;
 select u.email,u.managed into v_email,v_managed from daybridge_private.staff_identity(p_user) u;
 if v_email is null or p_user=p_actor or daybridge_private.confirmed_staff(v_email) is distinct from p_user then
  raise exception 'Not an eligible court staff identity' using errcode='42501'; end if;
 select split_part(v_email,'@',1)||'@'||lower(j.state_code)||'.'||j.login_slug||'.'||c.login_slug into v_expected
 from public.daybridge_courts c join public.daybridge_judicial_circuits j on j.id=c.circuit_id where c.id=p_court;
 if v_email<>v_expected then raise exception 'Staff identity does not match this court' using errcode='42501'; end if;
 if p_action='create' then
  if p_role not in ('coordinator','case_manager') or p_role is null or p_username is null
   or p_username !~ '^[a-z][a-z0-9_-]{2,31}$' or split_part(v_email,'@',1)<>p_username
   or v_managed is distinct from true then raise exception 'Invalid new staff identity'; end if;
  if v_member.user_id is not null then raise exception 'Staff already assigned'; end if;
  insert into public.daybridge_court_staff(court_id,user_id,role,password_change_required,credential_version,credential_valid_after,credential_operation_until)
   values(p_court,p_user,p_role,true,p_version,clock_timestamp(),now()+interval '2 minutes');
 else
  if v_member.user_id is null or not v_member.active then raise exception 'Restore staff access before resetting credentials'; end if;
  update public.daybridge_court_staff set password_change_required=true,credential_version=p_version,credential_valid_after=clock_timestamp(),
   credential_operation_until=now()+interval '2 minutes' where court_id=p_court and user_id=p_user;
 end if;
 insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values(p_court,p_actor,p_user,'owner_staff_'||p_action||'_requested');
 return v_email;
end;
$$;
revoke all on function public.daybridge_owner_staff_credentials(uuid,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.daybridge_owner_staff_credentials(uuid,uuid,uuid,text,uuid,text,text) to service_role;

create function public.daybridge_owner_finish_staff_credentials(
 p_actor uuid,p_court uuid,p_user uuid,p_version uuid,p_action text,p_success boolean
) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not daybridge_private.platform_owner(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_action not in ('create','reset') or p_success is null then raise exception 'Invalid credential action'; end if;
 update public.daybridge_court_staff set credential_operation_until=null
 where court_id=p_court and user_id=p_user and credential_version=p_version and active;
 if not found then return false; end if;
 insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values(p_court,p_actor,p_user,case when p_success then
   case when p_action='create' then 'owner_staff_created' else 'owner_staff_password_reset' end
   else 'owner_staff_credentials_failed' end);
 return true;
end;
$$;
revoke all on function public.daybridge_owner_finish_staff_credentials(uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.daybridge_owner_finish_staff_credentials(uuid,uuid,uuid,uuid,text,boolean) to service_role;

-- A pre-reset session never regains court access after password setup completes.
-- The browser cannot choose an arbitrary session: HTTP verifies signed JWT claims.
create function daybridge_private.staff_session_current(p_user uuid,p_session uuid,p_after timestamptz)
 returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_user and created_at>=p_after);
$$;
revoke all on function daybridge_private.staff_session_current(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function daybridge_private.staff_session_current(uuid,uuid,timestamptz) to service_role;
create function public.daybridge_staff_session_current(p_user uuid,p_court uuid,p_session uuid)
 returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select s.active and (s.credential_valid_after is null or
  daybridge_private.staff_session_current(p_user,p_session,s.credential_valid_after))
  from public.daybridge_court_staff s where s.user_id=p_user and s.court_id=p_court),false);
$$;
revoke all on function public.daybridge_staff_session_current(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.daybridge_staff_session_current(uuid,uuid,uuid) to service_role;

-- The server calls this only AFTER Auth verifies the current password and rotates it.
-- A reset/revocation that races completion cannot be undone by an older request.
create function public.daybridge_complete_staff_password(p_user uuid,p_court uuid,p_version uuid)
 returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.daybridge_court_staff set password_change_required=false
 where user_id=p_user and court_id=p_court and active and password_change_required
  and credential_version=p_version and (credential_operation_until is null or credential_operation_until<=now());
 if not found then return false; end if;
 insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values(p_court,p_user,p_user,'staff_password_changed');
 return true;
end;
$$;
revoke all on function public.daybridge_complete_staff_password(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.daybridge_complete_staff_password(uuid,uuid,uuid) to service_role;

create or replace function public.daybridge_owner_directory(p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not daybridge_private.platform_owner(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'states',(select coalesce(jsonb_agg(to_jsonb(s) order by s.name),'[]') from public.daybridge_states s),
  'circuits',(select coalesce(jsonb_agg(to_jsonb(j) order by j.name),'[]') from public.daybridge_judicial_circuits j),
  'courts',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'circuit_id',c.circuit_id,'court_name',c.court_name,
   'login_slug',c.login_slug,'seat_limit',c.seat_limit,'subscription_status',c.subscription_status,
   'listed',c.listed,'enabled',c.enabled,'is_demo',c.is_demo,'occupied_seats',
   (select count(*) from public.daybridge_court_participants p where p.court_id=c.id and p.status in ('active','suspended'))) order by c.court_name),'[]') from public.daybridge_courts c),
  'staff',(select coalesce(jsonb_agg(jsonb_build_object('court_id',s.court_id,'user_id',s.user_id,'role',s.role,'active',s.active,'password_change_required',s.password_change_required,'username',daybridge_private.staff_username(s.user_id))),'[]') from public.daybridge_court_staff s)
 );
end;
$$;
revoke all on function public.daybridge_owner_directory(uuid) from public,anon,authenticated;
grant execute on function public.daybridge_owner_directory(uuid) to service_role;

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
    where s.court_id = p_court_id and s.user_id = p_actor_id and s.active and not s.password_change_required
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
    where s.court_id = p_court_id and s.user_id = p_actor_id and s.active and not s.password_change_required
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
