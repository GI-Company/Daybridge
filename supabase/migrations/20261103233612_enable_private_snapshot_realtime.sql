-- Add the existing snapshot table to Realtime. No records, RLS policies, or grants change.
-- Environments without Supabase Realtime (including disposable PostgreSQL tests) skip this.
do $$
begin
 if exists (select 1 from pg_publication where pubname='supabase_realtime')
 and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_snapshots') then
  alter publication supabase_realtime add table public.private_snapshots;
 end if;
end;
$$;
