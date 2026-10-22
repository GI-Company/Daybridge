
alter table public.travel_preferences alter column navigation_enabled set default true;
alter table public.notification_deliveries drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries add constraint notification_deliveries_status_check
check (status in ('pending','sending','sent','failed','cancelled','no_subscription'));
create index if not exists idx_notification_owner_status on public.notification_deliveries(user_id,status,appointment_id);
