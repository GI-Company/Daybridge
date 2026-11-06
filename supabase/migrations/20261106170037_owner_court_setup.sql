-- Owner setup only. No owner, court, staff identity or membership is seeded.
create function daybridge_private.platform_owner(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_actor
  and raw_app_meta_data->'daybridge_platform_owner'='true'::jsonb);
$$;
revoke all on function daybridge_private.platform_owner(uuid) from public,anon,authenticated;
grant execute on function daybridge_private.platform_owner(uuid) to service_role;

-- Exact alias lookup only; no browser Auth directory and no identity creation.
create function daybridge_private.confirmed_staff(p_email text) returns uuid
language sql stable security definer set search_path='' as $$
 select id from auth.users where lower(email)=lower(p_email) and email_confirmed_at is not null
  and coalesce(raw_app_meta_data->>'daybridge_managed','false')<>'true';
$$;
revoke all on function daybridge_private.confirmed_staff(text) from public,anon,authenticated;
grant execute on function daybridge_private.confirmed_staff(text) to service_role;

create function public.daybridge_owner_setup(p_actor uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
 v_action text:=p_input->>'action'; v_court uuid; v_circuit uuid; v_staff uuid;
 v_state text; v_state_name text; v_name text; v_slug text; v_limit int;
 v_count int; v_alias text; v_role text;
begin
 if not daybridge_private.platform_owner(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 if v_action='create' then
  v_state:=upper(trim(p_input->>'state_code')); v_state_name:=trim(p_input->>'state_name');
  if v_state !~ '^[A-Z]{2}$' or length(v_state_name) not between 2 and 80 or v_state_name is null then raise exception 'Invalid state'; end if;
  insert into public.daybridge_states(code,name) values(v_state,v_state_name) on conflict(code) do nothing;
  if not exists(select 1 from public.daybridge_states where code=v_state and name=v_state_name) then raise exception 'State code already has a different name'; end if;
  v_name:=trim(p_input->>'circuit_name'); v_slug:=p_input->>'circuit_slug';
  if length(v_name) not between 3 and 120 or v_name is null or v_slug is null or v_slug !~ '^[a-z][a-z0-9-]{1,62}$' then raise exception 'Invalid circuit'; end if;
  insert into public.daybridge_judicial_circuits(state_code,name,login_slug) values(v_state,v_name,v_slug)
   on conflict(state_code,name) do nothing;
  select id into v_circuit from public.daybridge_judicial_circuits where state_code=v_state and name=v_name and login_slug=v_slug;
  if v_circuit is null then raise exception 'Circuit name or sign-in code already exists'; end if;
  insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit,is_demo,listed)
   values(v_circuit,trim(p_input->>'court_name'),p_input->>'court_slug',(p_input->>'seat_limit')::int,
    coalesce((p_input->>'is_demo')::boolean,false),coalesce((p_input->>'listed')::boolean,false)) returning id into v_court;
 elsif v_action='update' then
  v_court:=(p_input->>'court_id')::uuid;
  perform 1 from public.daybridge_courts where id=v_court for update;
  if not found then raise exception 'Court not found'; end if;
  v_limit:=(p_input->>'seat_limit')::int;
  select count(*) into v_count from public.daybridge_court_participants where court_id=v_court and status in ('active','suspended');
  if v_limit<v_count then raise exception 'Seat limit cannot be below assigned seats'; end if;
  update public.daybridge_courts set court_name=trim(p_input->>'court_name'),seat_limit=v_limit,
   subscription_status=p_input->>'subscription_status',listed=(p_input->>'listed')::boolean,
   enabled=(p_input->>'enabled')::boolean where id=v_court;
 elsif v_action in ('assign_staff','revoke_staff') then
  v_court:=(p_input->>'court_id')::uuid;
  perform 1 from public.daybridge_courts where id=v_court for update;
  if not found then raise exception 'Court not found'; end if;
  if v_action='assign_staff' then
   if p_input->>'username' is null or p_input->>'username' !~ '^[a-z][a-z0-9_-]{2,31}$' then raise exception 'Invalid staff username'; end if;
   v_role:=p_input->>'role';
   if v_role not in ('coordinator','case_manager') or v_role is null then raise exception 'Invalid staff role'; end if;
   select (p_input->>'username')||'@'||lower(j.state_code)||'.'||j.login_slug||'.'||c.login_slug into v_alias
    from public.daybridge_courts c join public.daybridge_judicial_circuits j on j.id=c.circuit_id where c.id=v_court;
   v_staff:=daybridge_private.confirmed_staff(v_alias);
   if v_staff is null then raise exception 'Create and confirm this exact staff sign-in in Supabase first'; end if;
   insert into public.daybridge_court_staff(court_id,user_id,role) values(v_court,v_staff,v_role)
    on conflict(court_id,user_id) do update set role=excluded.role,active=true;
  else
   v_staff:=(p_input->>'user_id')::uuid;
   update public.daybridge_court_staff set active=false where court_id=v_court and user_id=v_staff;
   if not found then raise exception 'Staff member not assigned to this court'; end if;
  end if;
 else raise exception 'Unsupported setup action'; end if;
 insert into public.daybridge_court_audit(court_id,actor_id,subject_user_id,action)
  values(v_court,p_actor,v_staff,'owner_'||v_action);
 return v_court;
end;
$$;
revoke all on function public.daybridge_owner_setup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.daybridge_owner_setup(uuid,jsonb) to service_role;

create function daybridge_private.staff_username(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
 select split_part(email,'@',1) from auth.users where id=p_user;
$$;
revoke all on function daybridge_private.staff_username(uuid) from public,anon,authenticated;
grant execute on function daybridge_private.staff_username(uuid) to service_role;

-- Aggregate occupied seats inside PostgreSQL; REST row caps must not undercount.
create function public.daybridge_owner_directory(p_actor uuid) returns jsonb
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
  'staff',(select coalesce(jsonb_agg(jsonb_build_object('court_id',s.court_id,'user_id',s.user_id,'role',s.role,'active',s.active,'username',daybridge_private.staff_username(s.user_id))),'[]') from public.daybridge_court_staff s)
 );
end;
$$;
revoke all on function public.daybridge_owner_directory(uuid) from public,anon,authenticated;
grant execute on function public.daybridge_owner_directory(uuid) to service_role;
