-- Run against a migrated project. All test writes are rolled back.
begin;
do $$
declare
  owner_id uuid;
  test_bucket timestamptz := date_trunc('minute', now()) - interval '2 hours';
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then raise exception 'Rate-limit integration test needs a user'; end if;
  if not public.take_scoped_travel_api_slot(owner_id, test_bucket, 'map-streets', 2) then raise exception 'First tile rejected'; end if;
  if not public.take_scoped_travel_api_slot(owner_id, test_bucket, 'map-streets', 2) then raise exception 'Second tile rejected'; end if;
  if public.take_scoped_travel_api_slot(owner_id, test_bucket, 'map-streets', 2) then raise exception 'Budget exceeded'; end if;
  if not public.take_scoped_travel_api_slot(owner_id, test_bucket, 'places', 1) then raise exception 'Tiles blocked search'; end if;
  if not public.take_scoped_travel_api_slot(owner_id, test_bucket, 'route', 1) then raise exception 'Tiles blocked routing'; end if;
  if not public.take_scoped_travel_api_slot(owner_id, test_bucket, 'map-flow', 1) then raise exception 'Streets blocked traffic'; end if;
  if public.take_scoped_travel_api_slot(owner_id, test_bucket, 'invalid', 1) then raise exception 'Unknown scope allowed'; end if;
  if public.take_scoped_travel_api_slot(owner_id, test_bucket, 'route', null) then raise exception 'Null limit allowed'; end if;
  if has_function_privilege('anon','public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer)','EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
  if has_function_privilege('authenticated','public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer)','EXECUTE') then raise exception 'Client execution allowed'; end if;
  if not has_function_privilege('service_role','public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer)','EXECUTE') then raise exception 'Server cannot execute limiter'; end if;
end;
$$;
rollback;
