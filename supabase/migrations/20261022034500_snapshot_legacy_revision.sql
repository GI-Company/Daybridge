-- Make even legacy direct-upsert clients advance snapshot revisions.
-- A new-client CAS write already supplies revision = old + 1, so it is unchanged.
create or replace function public.bump_private_snapshot_revision()
returns trigger language plpgsql security invoker set search_path=''
as $f$
begin
 if new.revision <= old.revision then
  new.revision := old.revision + 1;
 end if;
 return new;
end
$f$;
revoke all on function public.bump_private_snapshot_revision() from public,anon,authenticated;
drop trigger if exists daybridge_snapshot_bump_revision on public.private_snapshots;
create trigger daybridge_snapshot_bump_revision before update on public.private_snapshots
 for each row execute function public.bump_private_snapshot_revision();