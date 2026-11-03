-- DayBridge institution-only account registry. NOT a deployment/seed operation.
-- Apply only after reviewing the pilot readiness checklist and preserving backups.
-- Court administrators never receive SELECT grants on participant private records.
create table if not exists public.daybridge_courts (
  id uuid primary key default gen_random_uuid(),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null,
  circuit_name text not null,
  seat_limit integer not null check (seat_limit between 1 and 100000),
  listed boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (state_code, circuit_name)
);

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

alter table public.daybridge_courts enable row level security;
alter table public.daybridge_court_staff enable row level security;
alter table public.daybridge_court_participants enable row level security;
alter table public.daybridge_court_audit enable row level security;

-- No direct browser writes or reads for any administrative registry.
revoke all on public.daybridge_courts, public.daybridge_court_staff,
  public.daybridge_court_participants, public.daybridge_court_audit
  from public, anon, authenticated;
grant select, insert, update, delete on public.daybridge_courts,
  public.daybridge_court_staff, public.daybridge_court_participants,
  public.daybridge_court_audit to service_role;

-- Explicit opt-in public directory, containing no staff/user data or seat counts.
create or replace function public.daybridge_list_courts()
returns table(id uuid, state_code text, state_name text, circuit_name text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.state_code, c.state_name, c.circuit_name
  from public.daybridge_courts as c
  where c.enabled and c.listed
  order by c.state_name, c.circuit_name;
$$;
revoke all on function public.daybridge_list_courts() from public;
grant execute on function public.daybridge_list_courts() to anon, authenticated;

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
