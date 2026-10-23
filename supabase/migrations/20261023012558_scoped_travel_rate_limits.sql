-- Independent budgets prevent tile bursts from blocking search, routing or push.
-- Additive: older deployments can continue using travel_api_limits unchanged.
create table public.travel_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  scope text not null check (scope in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, scope, bucket)
);
alter table public.travel_request_limits enable row level security;
revoke all on table public.travel_request_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.travel_request_limits to service_role;
create policy "service role request budgets" on public.travel_request_limits
  for all to service_role using (true) with check (true);

create function public.take_scoped_travel_api_slot(
  p_user_id uuid, p_bucket timestamptz, p_scope text, p_limit integer
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare consumed integer;
begin
  if p_user_id is null or p_bucket is null or p_scope is null or p_limit is null or
     p_limit < 1 or p_limit > 1000 or
     p_scope not in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test') then
    return false;
  end if;
  delete from public.travel_request_limits
    where user_id = p_user_id and scope = p_scope and bucket < p_bucket - interval '1 day';
  insert into public.travel_request_limits(user_id, bucket, scope, count)
    values (p_user_id, p_bucket, p_scope, 1)
    on conflict (user_id, scope, bucket) do update
      set count = public.travel_request_limits.count + 1
      where public.travel_request_limits.count < p_limit
    returning count into consumed;
  return consumed is not null;
end;
$$;
revoke all on function public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer)
  from public, anon, authenticated;
grant execute on function public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer)
  to service_role;
