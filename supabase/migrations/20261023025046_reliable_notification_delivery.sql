-- Shared queue for calendar, task, medication, bill, refill and travel reminders.
alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries add constraint notification_deliveries_kind_check
 check(kind in ('preliminary','preparation','leave_now','traffic_change','event','task','medication','bill','refill'));
create table public.notification_device_receipts (
 delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 accepted_at timestamptz not null default now(),
 primary key(delivery_id,subscription_id)
);
alter table public.notification_device_receipts enable row level security;
revoke all on public.notification_device_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.notification_device_receipts to service_role;
create index notification_device_receipts_subscription on public.notification_device_receipts(subscription_id);
-- One active account per browser endpoint, including existing registrations.
update public.push_subscriptions old set disabled_at=now()
where old.disabled_at is null and exists (
 select 1 from public.push_subscriptions newer where newer.endpoint=old.endpoint and newer.disabled_at is null
 and (newer.updated_at,newer.id)>(old.updated_at,old.id)
);
create unique index push_subscriptions_one_active_account on public.push_subscriptions(endpoint) where disabled_at is null;
-- The dispatch Edge Function can take longer than pg_net's 5-second default.
-- Keep the existing schedule/authentication and allow the HTTP response to finish.
do $$
declare job record;
begin
 for job in select jobid,command from cron.job where jobname='daybridge-travel-every-five-min'
 loop
  if position('timeout_milliseconds' in job.command)=0 then
   perform cron.alter_job(job.jobid,schedule:='* * * * *',command:=regexp_replace(job.command,'body\s*:=','timeout_milliseconds := 60000, body :=','i'));
  end if;
 end loop;
end $$;
