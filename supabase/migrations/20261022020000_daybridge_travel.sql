
-- DayBridge optional appointment travel. Existing domain and auth settings untouched.
create table if not exists public.travel_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 navigation_enabled boolean not null default false,
 traffic_notifications boolean not null default true,
 lockscreen_private boolean not null default true,
 origin_kind text not null default 'current' check(origin_kind in ('current','saved')),
 saved_origin_label text,
 saved_origin_lat double precision check(saved_origin_lat between -90 and 90),
 saved_origin_lon double precision check(saved_origin_lon between -180 and 180),
 travel_mode text not null default 'car' check(travel_mode in ('car','pedestrian','bicycle')),
 arrival_buffer_minutes int not null default 15 check(arrival_buffer_minutes between 0 and 120),
 updated_at timestamptz not null default now(),
 check ((saved_origin_lat is null) = (saved_origin_lon is null))
);
create table if not exists public.travel_appointments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_event_id text not null,
 occurrence_start timestamptz not null,
 end_time timestamptz,
 timezone text not null default 'America/New_York',
 destination_address text not null,
 destination_lat double precision not null check(destination_lat between -90 and 90),
 destination_lon double precision not null check(destination_lon between -180 and 180),
 origin_label text,
 origin_lat double precision check(origin_lat between -90 and 90),
 origin_lon double precision check(origin_lon between -180 and 180),
 travel_mode text not null default 'car' check(travel_mode in ('car','pedestrian','bicycle')),
 arrival_buffer_minutes int not null default 15 check(arrival_buffer_minutes between 0 and 120),
 enabled boolean not null default true,
 cancelled boolean not null default false,
 source_revision text not null,
 last_travel_seconds int check(last_travel_seconds >= 0),
 last_delay_seconds int check(last_delay_seconds >= 0),
 last_checked_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(user_id, source_event_id, occurrence_start),
 check((origin_lat is null)=(origin_lon is null))
);
create table if not exists public.travel_estimates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 appointment_id uuid not null references public.travel_appointments(id) on delete cascade,
 observed_at timestamptz not null default now(),
 travel_seconds integer not null check(travel_seconds between 0 and 86400),
 traffic_delay_seconds integer not null default 0 check(traffic_delay_seconds >= 0),
 historic_seconds integer check(historic_seconds >= 0),
 leave_by timestamptz not null,
 traffic_basis text not null check(traffic_basis in ('live','historical','estimated'))
);
create table if not exists public.notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 appointment_id uuid references public.travel_appointments(id) on delete cascade,
 dedupe_key text not null,
 kind text not null check(kind in ('preliminary','preparation','leave_now','traffic_change')),
 status text not null default 'pending' check(status in ('pending','sent','failed','cancelled','no_subscription')),
 attempt_count integer not null default 0,
 last_attempt_at timestamptz,
 sent_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(user_id,dedupe_key)
);
create table if not exists public.travel_api_limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket timestamptz not null,
 count int not null default 0,
 primary key(user_id,bucket)
);
alter table public.push_subscriptions add column if not exists disabled_at timestamptz;
alter table public.push_subscriptions add column if not exists last_failure_at timestamptz;
create index if not exists travel_appointments_due on public.travel_appointments(occurrence_start) where enabled and not cancelled;
create index if not exists travel_estimates_owner_appointment on public.travel_estimates(user_id,appointment_id,observed_at desc);
create index if not exists notification_deliveries_pending on public.notification_deliveries(status,last_attempt_at);
create index if not exists push_subscriptions_active on public.push_subscriptions(user_id) where disabled_at is null;
create index if not exists travel_limits_bucket on public.travel_api_limits(bucket);
do $$
declare t text;
begin
 foreach t in array array['travel_preferences','travel_appointments','travel_estimates','notification_deliveries','travel_api_limits']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,public',t);
 end loop;
end $$;
grant select,insert,update,delete on public.travel_preferences,public.travel_appointments to authenticated;
grant select on public.travel_estimates,public.notification_deliveries to authenticated;
grant select,insert,update on public.travel_api_limits to authenticated;
create policy "owner travel prefs read" on public.travel_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "owner travel prefs insert" on public.travel_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy "owner travel prefs update" on public.travel_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "owner travel appointments read" on public.travel_appointments for select to authenticated using ((select auth.uid())=user_id);
create policy "owner travel appointments insert" on public.travel_appointments for insert to authenticated with check ((select auth.uid())=user_id);
create policy "owner travel appointments update" on public.travel_appointments for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "owner travel appointments delete" on public.travel_appointments for delete to authenticated using ((select auth.uid())=user_id);
create policy "owner travel estimates read" on public.travel_estimates for select to authenticated using ((select auth.uid())=user_id);
create policy "owner travel deliveries read" on public.notification_deliveries for select to authenticated using ((select auth.uid())=user_id);
create policy "owner api limit read" on public.travel_api_limits for select to authenticated using ((select auth.uid())=user_id);
create policy "owner api limit insert" on public.travel_api_limits for insert to authenticated with check ((select auth.uid())=user_id);
create policy "owner api limit update" on public.travel_api_limits for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
