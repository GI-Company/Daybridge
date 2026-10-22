
create or replace function public.daybridge_valid_cron_secret(provided text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select provided is not null and exists (
   select 1 from vault.decrypted_secrets s
   where s.name='daybridge_worker_secret' and s.decrypted_secret=provided
 );
$$;
revoke all on function public.daybridge_valid_cron_secret(text) from public, anon, authenticated;
grant execute on function public.daybridge_valid_cron_secret(text) to service_role;
