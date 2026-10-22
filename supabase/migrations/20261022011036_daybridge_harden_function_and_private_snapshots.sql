-- Mirrors deployed DayBridge Supabase hardening migration; use only once per project.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
create table if not exists public.private_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
 updated_at timestamptz not null default now()
);
alter table public.private_snapshots enable row level security;
revoke all on public.private_snapshots from anon, public;
grant select,insert,update,delete on public.private_snapshots to authenticated;
create policy "snapshot_owner_read" on public.private_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy "snapshot_owner_insert" on public.private_snapshots for insert to authenticated with check ((select auth.uid())=user_id);
create policy "snapshot_owner_update" on public.private_snapshots for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "snapshot_owner_delete" on public.private_snapshots for delete to authenticated using ((select auth.uid())=user_id);
