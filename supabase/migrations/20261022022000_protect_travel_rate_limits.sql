
revoke insert,update,delete on public.travel_api_limits from authenticated;
drop policy if exists "owner api limit insert" on public.travel_api_limits;
drop policy if exists "owner api limit update" on public.travel_api_limits;
-- Read-only RLS remains for an authenticated owner. Server-only writes use a verified user id and service-role credentials.
