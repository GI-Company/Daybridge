-- Personal-use security baseline. No records are deleted and no encryption keys are rotated.
-- The shipped app uses private_snapshots; close unused legacy Data API surfaces.
revoke all on public.profiles,public.calendar_events,public.event_occurrences,public.tasks,public.medications,public.medication_schedules,public.medication_logs,public.budget_accounts,public.money_transactions,public.paycheck_plans,public.wage_advances,public.bills,public.budget_reserves,public.reminder_rules,public.reminder_occurrences,public.resource_contacts from public,anon,authenticated;
-- Device credentials and server-generated delivery state are not client-writable.
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select(user_id,endpoint,disabled_at) on public.push_subscriptions to authenticated;
alter policy "Owner read push_subscriptions" on public.push_subscriptions to authenticated;
revoke all on public.notification_deliveries,public.travel_estimates from public,anon,authenticated;
grant select on public.notification_deliveries,public.travel_estimates to authenticated;
revoke delete on public.private_snapshots from authenticated;
create policy "service role device receipts" on public.notification_device_receipts for all to service_role using(true) with check(true);

create table public.private_security_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid,
 action text not null check(action in ('snapshot_saved','device_registered','device_disabled')),
 revision bigint,
 created_at timestamptz not null default now()
);
create index private_security_audit_owner_recent on public.private_security_audit(user_id,created_at desc);
alter table public.private_security_audit enable row level security;
revoke all on public.private_security_audit from public,anon,authenticated,service_role;
grant select on public.private_security_audit to authenticated;
grant select,insert on public.private_security_audit to service_role;
revoke all on sequence public.private_security_audit_id_seq,public.private_snapshot_history_id_seq from public,anon,authenticated,service_role;
grant usage on sequence public.private_security_audit_id_seq,public.private_snapshot_history_id_seq to service_role;
create policy "owner security activity" on public.private_security_audit for select to authenticated using((select auth.uid())=user_id);
create policy "service security activity read" on public.private_security_audit for select to service_role using(true);
create policy "service security activity append" on public.private_security_audit for insert to service_role with check(true);

create function public.audit_private_snapshot_write() returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' or old.payload is distinct from new.payload then
  insert into public.private_security_audit(user_id,actor_id,action,revision)
  values(new.user_id,(select auth.uid()),'snapshot_saved',new.revision);
 end if;
 return new;
end;
$$;
revoke all on function public.audit_private_snapshot_write() from public,anon,authenticated;
create trigger audit_private_snapshot after insert or update of payload on public.private_snapshots
 for each row execute function public.audit_private_snapshot_write();

-- The backend serializes a browser endpoint's ownership transition and requires
-- the existing subscription's encryption keys before moving it to another account.
create function public.register_private_push_device(p_user_id uuid,p_endpoint text,p_p256dh text,p_auth text)
returns boolean language plpgsql security invoker set search_path=''
as $$
declare prior public.push_subscriptions%rowtype;
begin
 if p_user_id is null or p_endpoint is null or p_p256dh is null or p_auth is null or length(p_endpoint)>4096 or
  p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/[^[:space:]#]*$' or
  p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_endpoint,0));
 select * into prior from public.push_subscriptions where endpoint=p_endpoint and disabled_at is null for update;
 if prior.id is not null and prior.user_id<>p_user_id and (prior.keys_auth<>p_auth or prior.keys_p256dh<>p_p256dh) then return false; end if;
 update public.push_subscriptions set disabled_at=now() where endpoint=p_endpoint and user_id<>p_user_id and disabled_at is null;
 insert into public.push_subscriptions(user_id,endpoint,keys_p256dh,keys_auth,disabled_at,last_failure_at,updated_at)
 values(p_user_id,p_endpoint,p_p256dh,p_auth,null,null,now())
 on conflict(user_id,endpoint) do update set keys_p256dh=excluded.keys_p256dh,keys_auth=excluded.keys_auth,disabled_at=null,last_failure_at=null,updated_at=now();
 if prior.id is null or prior.user_id<>p_user_id then
  insert into public.private_security_audit(user_id,actor_id,action) values(p_user_id,p_user_id,'device_registered');
 end if;
 return true;
end;
$$;
revoke all on function public.register_private_push_device(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_private_push_device(uuid,text,text,text) to service_role;

create function public.disable_private_push_device(p_user_id uuid,p_endpoint text)
returns void language plpgsql security invoker set search_path=''
as $$
begin
 update public.push_subscriptions set disabled_at=now() where user_id=p_user_id and endpoint=p_endpoint and disabled_at is null;
 if found then insert into public.private_security_audit(user_id,actor_id,action) values(p_user_id,p_user_id,'device_disabled'); end if;
end;
$$;
revoke all on function public.disable_private_push_device(uuid,text) from public,anon,authenticated;
grant execute on function public.disable_private_push_device(uuid,text) to service_role;

alter table public.travel_request_limits drop constraint travel_request_limits_scope_check;
alter table public.travel_request_limits add constraint travel_request_limits_scope_check
 check(scope in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test','device'));
create or replace function public.take_scoped_travel_api_slot(
  p_user_id uuid, p_bucket timestamptz, p_scope text, p_limit integer
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare consumed integer;
begin
  if p_user_id is null or p_bucket is null or p_scope is null or p_limit is null or
     p_limit < 1 or p_limit > 1000 or
     p_scope not in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test','device') then
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

-- Bind every queued client snapshot write to the account that created it.
-- The older two-argument RPC remains for rollback/older app compatibility.
create function public.save_private_snapshot_for_user(p_user_id uuid,p_payload jsonb,p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path=''
as $$
begin
 if (select auth.uid()) is null or p_user_id is distinct from (select auth.uid()) then
  raise exception 'snapshot_owner_mismatch' using errcode='42501';
 end if;
 return public.save_private_snapshot(p_payload,p_expected_revision);
end;
$$;
revoke all on function public.save_private_snapshot_for_user(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_private_snapshot_for_user(uuid,jsonb,bigint) to authenticated;
