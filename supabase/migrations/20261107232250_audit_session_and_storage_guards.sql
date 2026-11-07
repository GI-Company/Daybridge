-- Audit hardening. Existing snapshots and recovery history remain intact.
set lock_timeout = '5s';
-- Keep the preservation check in the same transaction and block concurrent saves
-- only for the short migration, rather than comparing changing production data.
lock table public.private_snapshots,public.private_snapshot_history in share row exclusive mode;
create temporary table daybridge_audit_preserved on commit drop as
 select 'snapshots' as relation,md5(coalesce(string_agg(to_jsonb(s)::text,'' order by user_id),'')) as fingerprint from public.private_snapshots s
 union all select 'history',md5(coalesce(string_agg(to_jsonb(h)::text,'' order by id),'')) from public.private_snapshot_history h;

-- PostgREST accepts signed, unexpired JWTs after Auth revokes their sessions.
-- Require the session to still exist as well as current workspace entitlement.
-- Background jobs deliberately retain the separate, service-only user helper.
create or replace function daybridge_private.workspace_access() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.user_id=(select auth.uid())
  and s.id::text=(select auth.jwt()->>'session_id'))
  and daybridge_private.workspace_access_for_user((select auth.uid()));
$$;
revoke all on function daybridge_private.workspace_access() from public,anon,service_role;
grant execute on function daybridge_private.workspace_access() to authenticated;

-- Bound new snapshot storage. No existing recovery copy is removed by this policy.
create table daybridge_private.snapshot_storage_policy (
 singleton boolean primary key default true check(singleton),
 protected_before timestamptz not null
);
insert into daybridge_private.snapshot_storage_policy values(true,clock_timestamp());
create table daybridge_private.snapshot_write_budget (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 writes integer not null
);
alter table daybridge_private.snapshot_storage_policy enable row level security;
alter table daybridge_private.snapshot_write_budget enable row level security;
revoke all on daybridge_private.snapshot_storage_policy,daybridge_private.snapshot_write_budget from public,anon,authenticated,service_role;

create function daybridge_private.enforce_snapshot_budget() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- INSERT ... ON CONFLICT fires both insert and update triggers. Charge only the
 -- final row operation, once, in the AFTER trigger; reject oversized data here.
 if octet_length(new.payload::text)>2097152 then
  raise exception 'snapshot_too_large: Cloud records are limited to 2 MiB. Export a backup and reduce large notes; your device copy is preserved.' using errcode='54000';
 end if;
 return new;
end $$;
revoke all on function daybridge_private.enforce_snapshot_budget() from public,anon,authenticated,service_role;
create trigger daybridge_snapshot_size before insert or update of payload on public.private_snapshots
 for each row execute function daybridge_private.enforce_snapshot_budget();

create function daybridge_private.charge_snapshot_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_window timestamptz:=date_trunc('minute',clock_timestamp()); v_count integer;
begin
 if tg_op='UPDATE' then if old.payload is not distinct from new.payload then return new; end if; end if;
 insert into daybridge_private.snapshot_write_budget(user_id,window_start,writes)
 values(new.user_id,v_window,1) on conflict(user_id) do update set
 writes=case when snapshot_write_budget.window_start=excluded.window_start then snapshot_write_budget.writes+1 else 1 end,
 window_start=excluded.window_start returning writes into v_count;
 if v_count>120 then raise exception 'snapshot_rate_limited: Cloud save limit reached. Your device copy is preserved; retry next minute.' using errcode='54000'; end if;
 return new;
end $$;
revoke all on function daybridge_private.charge_snapshot_write() from public,anon,authenticated,service_role;
create trigger daybridge_snapshot_write_budget after insert or update of payload on public.private_snapshots
 for each row execute function daybridge_private.charge_snapshot_write();

create or replace function public.capture_previous_private_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.payload is distinct from new.payload then
  insert into public.private_snapshot_history(user_id,revision,payload)
  values(old.user_id,old.revision,old.payload) on conflict(user_id,revision) do nothing;
  -- Preserve all pre-policy history, plus the newest 50 new revisions within
  -- 8 MiB per user. Current snapshots and encrypted device recoveries are separate.
  delete from public.private_snapshot_history h where h.user_id=new.user_id and h.id in (
   select id from (
    select id,row_number() over(order by revision desc) as position,
     sum(octet_length(payload::text)) over(order by revision desc) as bytes
    from public.private_snapshot_history
    where user_id=new.user_id and recorded_at>(select protected_before from daybridge_private.snapshot_storage_policy where singleton)
   ) ranked where position>50 or bytes>8388608
  );
 end if;
 return new;
end $$;
revoke all on function public.capture_previous_private_snapshot() from public,anon,authenticated,service_role;

-- Select due work before the cost cap. Oldest attempted work rotates first, so
-- recently checked or repeatedly failing early appointments cannot starve others.
alter table public.travel_appointments add column last_attempted_at timestamptz;
create index daybridge_travel_work on public.travel_appointments(last_attempted_at,occurrence_start) where enabled and not cancelled;
-- JSON records are user data: malformed legacy fields must not break the worker.
create function daybridge_private.travel_reminder_lead(value jsonb) returns integer
language sql immutable security invoker set search_path='' as $$
 select case when jsonb_typeof(value)='number' and value::text~'^[0-9]{1,3}$'
  then greatest(0,least(300,(value::text)::integer)) else 30 end;
$$;
revoke all on function daybridge_private.travel_reminder_lead(jsonb) from public,anon,authenticated;
grant execute on function daybridge_private.travel_reminder_lead(jsonb) to service_role;
create function public.daybridge_due_travel_plans(p_now timestamptz) returns setof public.travel_appointments
language sql stable security invoker set search_path='' as $$
 select p.* from public.travel_appointments p
 join public.travel_preferences f on f.user_id=p.user_id
 join public.private_snapshots s on s.user_id=p.user_id
 where p.enabled and not p.cancelled
 and p.occurrence_start>p_now-interval '1 minute' and p.occurrence_start<p_now+interval '36 hours'
 and p.origin_lat is not null and p.origin_lon is not null
 and f.traffic_notifications and f.origin_kind='saved'
 and f.saved_origin_lat=p.origin_lat and f.saved_origin_lon=p.origin_lon
 and (p.last_attempted_at is null or p.last_attempted_at<=p_now-interval '1 minute')
 and (p.last_checked_at is null or p.last_checked_at<=p_now-(case
  when p.occurrence_start<=p_now+interval '1 hour'
   or p_now>=p.occurrence_start-make_interval(secs=>coalesce(p.last_travel_seconds,0))-make_interval(mins=>p.arrival_buffer_minutes)
    -make_interval(mins=>daybridge_private.travel_reminder_lead(coalesce(
      (select e->'reminderLeadMinutes' from jsonb_array_elements(case when jsonb_typeof(s.payload->'events')='array' then s.payload->'events' else '[]' end) e
       where e->>'id'=p.source_event_id limit 1),
      s.payload->'profile'->'reminderLeadMinutes')))
   then interval '1 minute'
  when p.occurrence_start<=p_now+interval '4 hours' then interval '5 minutes'
  else interval '30 minutes' end))
 order by coalesce(p.last_attempted_at,p.last_checked_at) nulls first,p.occurrence_start,p.id
 limit 60;
$$;
revoke all on function public.daybridge_due_travel_plans(timestamptz) from public,anon,authenticated;
grant execute on function public.daybridge_due_travel_plans(timestamptz) to service_role;

-- Refuse the rollout if it changed any pre-existing private record or backup.
do $$ begin
 if exists(
  select * from daybridge_audit_preserved
  except
  (select 'snapshots',md5(coalesce(string_agg(to_jsonb(s)::text,'' order by user_id),'')) from public.private_snapshots s
   union all select 'history',md5(coalesce(string_agg(to_jsonb(h)::text,'' order by id),'')) from public.private_snapshot_history h)
 ) then raise exception 'audit_record_preservation_guard_failed'; end if;
end $$;
