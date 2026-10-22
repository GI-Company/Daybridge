-- DayBridge: departure acknowledgement is user intent only; never GPS proof.
alter table public.travel_appointments
 add column if not exists departed_at timestamptz,
 add column if not exists departure_ack_source text;
do $migration$
begin
 if not exists (select 1 from pg_constraint where conname='travel_appointments_departure_ack_source_check'
                and conrelid='public.travel_appointments'::regclass) then
  alter table public.travel_appointments
   add constraint travel_appointments_departure_ack_source_check
   check (departure_ack_source is null or departure_ack_source in ('notification','app'));
 end if;
end $migration$;
