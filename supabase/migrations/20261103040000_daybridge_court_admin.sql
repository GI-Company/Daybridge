-- DayBridge institution-only account registry. NOT a deployment/seed operation.
-- Apply only after reviewing the pilot readiness checklist and preserving backups.
-- Court administrators never receive SELECT grants on participant private records.
-- Normalize the organization hierarchy: one state -> many circuits -> many courts.
-- Circuit and court names are unique only within their parent; separate courts
-- in the same judicial circuit must not share seats or participant accounts.
create table if not exists public.daybridge_states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null unique
);

create table if not exists public.daybridge_judicial_circuits (
  id uuid primary key default gen_random_uuid(),
  state_code text not null references public.daybridge_states(code) on delete restrict,
  name text not null check (length(trim(name)) between 3 and 120),
  login_slug text not null check (login_slug ~ '^[a-z][a-z0-9-]{1,62}$'),
  unique (state_code, name),
  unique (state_code, login_slug)
);
create index if not exists daybridge_circuits_state_idx
  on public.daybridge_judicial_circuits (state_code);

create table if not exists public.daybridge_courts (
  id uuid primary key default gen_random_uuid(),
  circuit_id uuid not null references public.daybridge_judicial_circuits(id) on delete restrict,
  court_name text not null check (length(trim(court_name)) between 3 and 120),
  login_slug text not null check (login_slug ~ '^[a-z][a-z0-9-]{1,62}$'),
  seat_limit integer not null check (seat_limit between 1 and 100000),
  subscription_plan text not null default 'pilot' check (subscription_plan in ('pilot','starter','growth','scale')),
  subscription_status text not null default 'pilot' check (subscription_status in ('pilot','active','paused','canceled')),
  listed boolean not null default false,
  enabled boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circuit_id, court_name),
  unique (circuit_id, login_slug)
);
create index if not exists daybridge_courts_circuit_idx
  on public.daybridge_courts (circuit_id);

-- FICTIONAL DEMONSTRATION DIRECTORY ONLY. Never seed real judicial staff or
-- participant data, or assign anonymous/default-password admin credentials.
-- When this migration is approved for a staging database, staff can provision
-- actual Supabase Auth test users only AFTER a verified staff member is enrolled.
insert into public.daybridge_states(code,name)
values ('ZZ','Sample State') on conflict (code) do nothing;

insert into public.daybridge_judicial_circuits(state_code,name,login_slug)
values ('ZZ','Sample Judicial Circuit','samplecircuit') on conflict (state_code,name) do nothing;

insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit,listed,enabled,is_demo)
select c.id, 'Sample Court','samplecourt',25,true,true,true
from public.daybridge_judicial_circuits as c
where c.state_code='ZZ' and c.name='Sample Judicial Circuit'
on conflict (circuit_id,court_name) do nothing;

create table if not exists public.daybridge_court_staff (
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('coordinator','case_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (court_id, user_id)
);

create table if not exists public.daybridge_court_participants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z][a-z0-9_-]{2,31}$'),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daybridge_participants_court_status_idx
  on public.daybridge_court_participants (court_id, status);
create index if not exists daybridge_staff_user_active_idx
  on public.daybridge_court_staff (user_id, active);

create table if not exists public.daybridge_court_audit (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists daybridge_court_audit_court_created_idx
  on public.daybridge_court_audit (court_id, created_at desc);

alter table public.daybridge_states enable row level security;
alter table public.daybridge_judicial_circuits enable row level security;
alter table public.daybridge_courts enable row level security;
alter table public.daybridge_court_staff enable row level security;
alter table public.daybridge_court_participants enable row level security;
alter table public.daybridge_court_audit enable row level security;

-- No direct browser writes or reads for any administrative registry.
revoke all on public.daybridge_states, public.daybridge_judicial_circuits,
  public.daybridge_courts, public.daybridge_court_staff,
  public.daybridge_court_participants, public.daybridge_court_audit
  from public, anon, authenticated;
grant select, insert, update, delete on public.daybridge_states,
  public.daybridge_judicial_circuits, public.daybridge_courts,
  public.daybridge_court_staff, public.daybridge_court_participants,
  public.daybridge_court_audit to service_role;

-- Court selection directory is read through a server-only service client.
-- No public SECURITY DEFINER function is required or granted.

-- Use a court-row lock to enforce the seat limit when staff provision concurrently.
-- Only the server-held service_role can execute this privileged operation.
create or replace function public.daybridge_assign_participant(
  p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
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
$$;
revoke all on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  to service_role;
),
  unique (state_code, name),
  unique (state_code, login_slug)
);
create index if not exists daybridge_circuits_state_idx
  on public.daybridge_judicial_circuits (state_code);

create table if not exists public.daybridge_courts (
  id uuid primary key default gen_random_uuid(),
  circuit_id uuid not null references public.daybridge_judicial_circuits(id) on delete restrict,
  court_name text not null check (length(trim(court_name)) between 3 and 120),
  seat_limit integer not null check (seat_limit between 1 and 100000),
  listed boolean not null default false,
  enabled boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circuit_id, court_name)
);
create index if not exists daybridge_courts_circuit_idx
  on public.daybridge_courts (circuit_id);

-- FICTIONAL DEMONSTRATION DIRECTORY ONLY. Never seed real judicial staff or
-- participant data, or assign anonymous/default-password admin credentials.
-- When this migration is approved for a staging database, staff can provision
-- actual Supabase Auth test users only AFTER a verified staff member is enrolled.
insert into public.daybridge_states(code,name)
values ('ZZ','Sample State') on conflict (code) do nothing;

insert into public.daybridge_judicial_circuits(state_code,name)
values ('ZZ','Sample Judicial Circuit') on conflict (state_code,name) do nothing;

insert into public.daybridge_courts(circuit_id,court_name,seat_limit,listed,enabled,is_demo)
select c.id, 'Sample Court',25,true,true,true
from public.daybridge_judicial_circuits as c
where c.state_code='ZZ' and c.name='Sample Judicial Circuit'
on conflict (circuit_id,court_name) do nothing;

create table if not exists public.daybridge_court_staff (
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('coordinator','case_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (court_id, user_id)
);

create table if not exists public.daybridge_court_participants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z][a-z0-9_-]{2,31}$'),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daybridge_participants_court_status_idx
  on public.daybridge_court_participants (court_id, status);
create index if not exists daybridge_staff_user_active_idx
  on public.daybridge_court_staff (user_id, active);

create table if not exists public.daybridge_court_audit (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists daybridge_court_audit_court_created_idx
  on public.daybridge_court_audit (court_id, created_at desc);

alter table public.daybridge_states enable row level security;
alter table public.daybridge_judicial_circuits enable row level security;
alter table public.daybridge_courts enable row level security;
alter table public.daybridge_court_staff enable row level security;
alter table public.daybridge_court_participants enable row level security;
alter table public.daybridge_court_audit enable row level security;

-- No direct browser writes or reads for any administrative registry.
revoke all on public.daybridge_states, public.daybridge_judicial_circuits,
  public.daybridge_courts, public.daybridge_court_staff,
  public.daybridge_court_participants, public.daybridge_court_audit
  from public, anon, authenticated;
grant select, insert, update, delete on public.daybridge_states,
  public.daybridge_judicial_circuits, public.daybridge_courts,
  public.daybridge_court_staff, public.daybridge_court_participants,
  public.daybridge_court_audit to service_role;

-- Court selection directory is read through a server-only service client.
-- No public SECURITY DEFINER function is required or granted.

-- Use a court-row lock to enforce the seat limit when staff provision concurrently.
-- Only the server-held service_role can execute this privileged operation.
create or replace function public.daybridge_assign_participant(
  p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
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
$$;
revoke all on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  to service_role;
),
  seat_limit integer not null check (seat_limit between 1 and 100000),
  listed boolean not null default false,
  enabled boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circuit_id, court_name)
);
create index if not exists daybridge_courts_circuit_idx
  on public.daybridge_courts (circuit_id);

-- FICTIONAL DEMONSTRATION DIRECTORY ONLY. Never seed real judicial staff or
-- participant data, or assign anonymous/default-password admin credentials.
-- When this migration is approved for a staging database, staff can provision
-- actual Supabase Auth test users only AFTER a verified staff member is enrolled.
insert into public.daybridge_states(code,name)
values ('ZZ','Sample State') on conflict (code) do nothing;

insert into public.daybridge_judicial_circuits(state_code,name)
values ('ZZ','Sample Judicial Circuit') on conflict (state_code,name) do nothing;

insert into public.daybridge_courts(circuit_id,court_name,seat_limit,listed,enabled,is_demo)
select c.id, 'Sample Court',25,true,true,true
from public.daybridge_judicial_circuits as c
where c.state_code='ZZ' and c.name='Sample Judicial Circuit'
on conflict (circuit_id,court_name) do nothing;

create table if not exists public.daybridge_court_staff (
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('coordinator','case_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (court_id, user_id)
);

create table if not exists public.daybridge_court_participants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z][a-z0-9_-]{2,31}$'),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daybridge_participants_court_status_idx
  on public.daybridge_court_participants (court_id, status);
create index if not exists daybridge_staff_user_active_idx
  on public.daybridge_court_staff (user_id, active);

create table if not exists public.daybridge_court_audit (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists daybridge_court_audit_court_created_idx
  on public.daybridge_court_audit (court_id, created_at desc);

alter table public.daybridge_states enable row level security;
alter table public.daybridge_judicial_circuits enable row level security;
alter table public.daybridge_courts enable row level security;
alter table public.daybridge_court_staff enable row level security;
alter table public.daybridge_court_participants enable row level security;
alter table public.daybridge_court_audit enable row level security;

-- No direct browser writes or reads for any administrative registry.
revoke all on public.daybridge_states, public.daybridge_judicial_circuits,
  public.daybridge_courts, public.daybridge_court_staff,
  public.daybridge_court_participants, public.daybridge_court_audit
  from public, anon, authenticated;
grant select, insert, update, delete on public.daybridge_states,
  public.daybridge_judicial_circuits, public.daybridge_courts,
  public.daybridge_court_staff, public.daybridge_court_participants,
  public.daybridge_court_audit to service_role;

-- Court selection directory is read through a server-only service client.
-- No public SECURITY DEFINER function is required or granted.

-- Use a court-row lock to enforce the seat limit when staff provision concurrently.
-- Only the server-held service_role can execute this privileged operation.
create or replace function public.daybridge_assign_participant(
  p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
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
$$;
revoke all on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  to service_role;
),
  unique (state_code, name),
  unique (state_code, login_slug)
);
create index if not exists daybridge_circuits_state_idx
  on public.daybridge_judicial_circuits (state_code);

create table if not exists public.daybridge_courts (
  id uuid primary key default gen_random_uuid(),
  circuit_id uuid not null references public.daybridge_judicial_circuits(id) on delete restrict,
  court_name text not null check (length(trim(court_name)) between 3 and 120),
  seat_limit integer not null check (seat_limit between 1 and 100000),
  listed boolean not null default false,
  enabled boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circuit_id, court_name)
);
create index if not exists daybridge_courts_circuit_idx
  on public.daybridge_courts (circuit_id);

-- FICTIONAL DEMONSTRATION DIRECTORY ONLY. Never seed real judicial staff or
-- participant data, or assign anonymous/default-password admin credentials.
-- When this migration is approved for a staging database, staff can provision
-- actual Supabase Auth test users only AFTER a verified staff member is enrolled.
insert into public.daybridge_states(code,name)
values ('ZZ','Sample State') on conflict (code) do nothing;

insert into public.daybridge_judicial_circuits(state_code,name)
values ('ZZ','Sample Judicial Circuit') on conflict (state_code,name) do nothing;

insert into public.daybridge_courts(circuit_id,court_name,seat_limit,listed,enabled,is_demo)
select c.id, 'Sample Court',25,true,true,true
from public.daybridge_judicial_circuits as c
where c.state_code='ZZ' and c.name='Sample Judicial Circuit'
on conflict (circuit_id,court_name) do nothing;

create table if not exists public.daybridge_court_staff (
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('coordinator','case_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (court_id, user_id)
);

create table if not exists public.daybridge_court_participants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z][a-z0-9_-]{2,31}$'),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daybridge_participants_court_status_idx
  on public.daybridge_court_participants (court_id, status);
create index if not exists daybridge_staff_user_active_idx
  on public.daybridge_court_staff (user_id, active);

create table if not exists public.daybridge_court_audit (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.daybridge_courts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists daybridge_court_audit_court_created_idx
  on public.daybridge_court_audit (court_id, created_at desc);

alter table public.daybridge_states enable row level security;
alter table public.daybridge_judicial_circuits enable row level security;
alter table public.daybridge_courts enable row level security;
alter table public.daybridge_court_staff enable row level security;
alter table public.daybridge_court_participants enable row level security;
alter table public.daybridge_court_audit enable row level security;

-- No direct browser writes or reads for any administrative registry.
revoke all on public.daybridge_states, public.daybridge_judicial_circuits,
  public.daybridge_courts, public.daybridge_court_staff,
  public.daybridge_court_participants, public.daybridge_court_audit
  from public, anon, authenticated;
grant select, insert, update, delete on public.daybridge_states,
  public.daybridge_judicial_circuits, public.daybridge_courts,
  public.daybridge_court_staff, public.daybridge_court_participants,
  public.daybridge_court_audit to service_role;

-- Court selection directory is read through a server-only service client.
-- No public SECURITY DEFINER function is required or granted.

-- Use a court-row lock to enforce the seat limit when staff provision concurrently.
-- Only the server-held service_role can execute this privileged operation.
create or replace function public.daybridge_assign_participant(
  p_court_id uuid, p_user_id uuid, p_username text, p_actor_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
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
$$;
revoke all on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_transition_participant(uuid,uuid,uuid,text)
  to service_role;

-- Link a trusted staff identity already created in Supabase Authentication.
-- Only privileged operators can invoke this, never public site visitors.
-- The alias selects a REGISTERED hierarchy; it does not create organizations
-- from arbitrary login strings. No shared/public staff invite endpoint.
create or replace function public.daybridge_link_court_staff(
  p_staff_email text, p_role text
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_email text := lower(trim(p_staff_email));
  v_domain text;
  v_state text;
  v_circuit text;
  v_court text;
  v_court_id uuid;
  v_staff_id uuid;
begin
  if p_role not in ('coordinator','case_manager') then
    raise exception 'Invalid staff role';
  end if;
  if v_email !~ '^[a-z][a-z0-9_-]{2,31}@[a-z]{2}\.[a-z][a-z0-9-]{1,62}\.[a-z][a-z0-9-]{1,62}$' then
    raise exception 'Invalid court staff identity format';
  end if;

  v_domain := split_part(v_email,'@',2);
  v_state := split_part(v_domain,'.',1);
  v_circuit := split_part(v_domain,'.',2);
  v_court := split_part(v_domain,'.',3);

  select c.id into v_court_id
  from public.daybridge_courts c
  join public.daybridge_judicial_circuits j on j.id=c.circuit_id
  join public.daybridge_states s on s.code=j.state_code
  where lower(s.code)=v_state and j.login_slug=v_circuit
    and c.login_slug=v_court and c.enabled and c.listed;
  if v_court_id is null then raise exception 'Court is not registered'; end if;

  select u.id into v_staff_id from auth.users u
  where lower(u.email)=v_email and u.email_confirmed_at is not null;
  if v_staff_id is null then
    raise exception 'Confirmed staff authentication identity not found';
  end if;

  insert into public.daybridge_court_staff(court_id,user_id,role,active)
  values (v_court_id,v_staff_id,p_role,true)
  on conflict (court_id,user_id) do update
  set role=excluded.role,active=true;
  return v_court_id;
end;
$$;
revoke all on function public.daybridge_link_court_staff(text,text)
  from public, anon, authenticated;
grant execute on function public.daybridge_link_court_staff(text,text)
  to service_role;
