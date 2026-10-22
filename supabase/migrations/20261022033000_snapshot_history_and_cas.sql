-- Revisioned personal snapshots; created in live DayBridge Supabase before this source commit.
-- RLS and owner-scoped invoker RPC prevent stale current-client writes.
alter table public.private_snapshots add column if not exists revision bigint not null default 0;

create table if not exists public.private_snapshot_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 recorded_at timestamptz not null default now(),
 unique(user_id,revision)
);
create index if not exists private_snapshot_history_recent on public.private_snapshot_history(user_id,revision desc);
alter table public.private_snapshot_history enable row level security;
revoke all on public.private_snapshot_history from public,anon,authenticated;
grant select on public.private_snapshot_history to authenticated;
drop policy if exists "owner can read snapshot history" on public.private_snapshot_history;
create policy "owner can read snapshot history" on public.private_snapshot_history
 for select to authenticated using((select auth.uid())=user_id);

create or replace function public.capture_previous_private_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $f$
begin
 if old.payload is distinct from new.payload then
  insert into public.private_snapshot_history(user_id,revision,payload)
  values(old.user_id,old.revision,old.payload)
  on conflict(user_id,revision) do nothing;
 end if;
 return new;
end
$f$;
revoke all on function public.capture_previous_private_snapshot() from public,anon,authenticated;
drop trigger if exists daybridge_snapshot_history on public.private_snapshots;
create trigger daybridge_snapshot_history after update of payload on public.private_snapshots
 for each row execute function public.capture_previous_private_snapshot();

create or replace function public.save_private_snapshot(p_payload jsonb,p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path=''
as $f$
declare v_user uuid := (select auth.uid()); v_revision bigint;
begin
 if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid snapshot' using errcode='22023'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 insert into public.private_snapshots(user_id,payload,revision,updated_at)
 values(v_user,p_payload,p_expected_revision+1,now())
 on conflict(user_id) do update
 set payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at
 where public.private_snapshots.revision=p_expected_revision
 returning revision into v_revision;
 if v_revision is null then raise exception 'snapshot_conflict' using errcode='P0001'; end if;
 return v_revision;
end
$f$;
revoke all on function public.save_private_snapshot(jsonb,bigint) from public,anon;
grant execute on function public.save_private_snapshot(jsonb,bigint) to authenticated;

-- Keep the pre-rollout snapshot as a first recoverable history revision.
insert into public.private_snapshot_history(user_id,revision,payload)
 select user_id,revision,payload from public.private_snapshots
 on conflict(user_id,revision) do nothing;
