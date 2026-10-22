-- Atomic travel tile rate limit, service-role only.
-- A concurrent MapLibre tile burst must not fail on the initial bucket insert.
create or replace function public.take_travel_api_slot(
 p_user_id uuid,p_bucket timestamptz,p_limit integer
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare consumed integer;
begin
 if p_user_id is null or p_bucket is null or p_limit<1 or p_limit>1000 then
  return false;
 end if;
 insert into public.travel_api_limits(user_id,bucket,count)
 values (p_user_id,p_bucket,1)
 on conflict(user_id,bucket) do update
  set count=public.travel_api_limits.count+1
  where public.travel_api_limits.count<p_limit
 returning count into consumed;
 return consumed is not null;
end;
$$;
revoke all on function public.take_travel_api_slot(uuid,timestamptz,integer)
 from public,anon,authenticated;
grant execute on function public.take_travel_api_slot(uuid,timestamptz,integer)
 to service_role;
