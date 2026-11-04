-- Additive billing records. Auth identities, private snapshots, and history are retained.
-- Old releases banned removed accounts. Queue a one-time repair through the Auth
-- Admin API after deployment; never edit auth.users credentials directly in SQL.
create table public.daybridge_personal_signin_releases (
 user_id uuid primary key references auth.users(id) on delete cascade,
 completed_at timestamptz,
 claimed_at timestamptz
);
alter table public.daybridge_personal_signin_releases enable row level security;
revoke all on public.daybridge_personal_signin_releases from public,anon,authenticated;
grant select,update on public.daybridge_personal_signin_releases to service_role;
insert into public.daybridge_personal_signin_releases(user_id)
 select user_id from public.daybridge_court_participants where status='removed';
create function public.daybridge_claim_signin_releases() returns setof public.daybridge_personal_signin_releases
language sql security invoker set search_path='' as $$
 update public.daybridge_personal_signin_releases set claimed_at=now()
 where user_id in (select user_id from public.daybridge_personal_signin_releases
  where completed_at is null and (claimed_at is null or claimed_at<now()-interval '5 minutes') limit 20 for update skip locked)
 returning *;
$$;
revoke all on function public.daybridge_claim_signin_releases() from public,anon,authenticated;
grant execute on function public.daybridge_claim_signin_releases() to service_role;
create table public.daybridge_billing_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 customer_id text not null unique check(customer_id like 'cus_%'),
 sync_version bigint not null default 0,
 checkout_generation bigint not null default 0,
 checkout_session_id text,
 checkout_url text,
 checkout_expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.daybridge_billing_subscriptions (
 subscription_id text primary key,
 user_id uuid not null references public.daybridge_billing_customers(user_id) on delete cascade,
 status text not null,
 access_until timestamptz,
 cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null default now()
);
create index daybridge_billing_subscriptions_owner on public.daybridge_billing_subscriptions(user_id);
create table public.daybridge_billing_events (
 event_id text primary key,
 event_type text not null,
 processed_at timestamptz not null default now()
);
create table public.daybridge_billing_risks (
 event_id text not null references public.daybridge_billing_events(event_id),
 subscription_id text not null,
 reason text not null,
 blocks_access boolean not null,
 primary key(event_id,subscription_id)
);
create index daybridge_billing_risks_subscription on public.daybridge_billing_risks(subscription_id) where blocks_access;
alter table public.daybridge_billing_customers enable row level security;
alter table public.daybridge_billing_subscriptions enable row level security;
alter table public.daybridge_billing_events enable row level security;
alter table public.daybridge_billing_risks enable row level security;
revoke all on public.daybridge_billing_customers,public.daybridge_billing_subscriptions,public.daybridge_billing_events,public.daybridge_billing_risks from public,anon,authenticated;
grant select,insert,update on public.daybridge_billing_customers,public.daybridge_billing_subscriptions,public.daybridge_billing_events,public.daybridge_billing_risks to service_role;

-- Internal, no caller-supplied user ID. Required because clients cannot inspect
-- court or billing tables. Authorization is read fresh, never from editable JWT metadata.
create schema if not exists daybridge_private;
revoke all on schema daybridge_private from public,anon;
grant usage on schema daybridge_private to authenticated;
create function daybridge_private.workspace_access() returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_status text;
begin
 if v_user is null then return false; end if;
 select status into v_status from public.daybridge_court_participants where user_id=v_user;
 if v_status is null then
  return not exists(select 1 from auth.users where id=v_user and raw_app_meta_data->>'daybridge_managed'='true');
 end if; -- existing independent personal accounts retain access; unassigned managed users do not
 if v_status='active' then return true; end if;
 if v_status<>'removed' then return false; end if; -- suspension cannot be bypassed by paying
 return exists(select 1 from public.daybridge_billing_subscriptions s
  where s.user_id=v_user and s.status in ('active','past_due') and s.access_until>now()
  and not exists(select 1 from public.daybridge_billing_risks r where r.subscription_id=s.subscription_id and r.blocks_access));
end;
$$;
revoke all on function daybridge_private.workspace_access() from public,anon,service_role;
grant execute on function daybridge_private.workspace_access() to authenticated;
create function public.daybridge_workspace_access() returns boolean
language sql stable security invoker set search_path=''
as $$ select daybridge_private.workspace_access() $$;
revoke all on function public.daybridge_workspace_access() from public,anon;
grant execute on function public.daybridge_workspace_access() to authenticated;
create policy "workspace entitlement" on public.private_snapshots as restrictive for all to authenticated
 using((select daybridge_private.workspace_access())) with check((select daybridge_private.workspace_access()));
create policy "history entitlement" on public.private_snapshot_history as restrictive for select to authenticated
 using((select daybridge_private.workspace_access()));
-- Export is an authenticated, owner-bound server endpoint, available without payment.
grant select on public.private_snapshots,public.private_snapshot_history to service_role;

-- A monotonic token makes overlapping webhook refreshes compare-and-swap, rather
-- than trusting event delivery order or replacing newer state with an older response.
create function public.daybridge_begin_billing_sync(p_customer_id text) returns bigint
language sql security invoker set search_path='' as $$
 update public.daybridge_billing_customers set sync_version=sync_version+1
 where customer_id=p_customer_id returning sync_version;
$$;
revoke all on function public.daybridge_begin_billing_sync(text) from public,anon,authenticated;
grant execute on function public.daybridge_begin_billing_sync(text) to service_role;
create function public.daybridge_finish_billing_sync(p_customer_id text,p_version bigint,p_subscriptions jsonb,p_event_id text default null,p_event_type text default null,p_risks jsonb default '[]') returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_user uuid; v_version bigint; item jsonb;
begin
 select user_id,sync_version into v_user,v_version from public.daybridge_billing_customers where customer_id=p_customer_id for update;
 if v_user is null then return false; end if;
 if p_version<>v_version then return false; end if;
 if p_event_id is not null then
  insert into public.daybridge_billing_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  for item in select value from jsonb_array_elements(p_risks) loop
   insert into public.daybridge_billing_risks(event_id,subscription_id,reason,blocks_access)
   values(p_event_id,item->>'subscription_id',p_event_type,(item->>'blocks_access')::boolean) on conflict do nothing;
  end loop;
 end if;
 for item in select value from jsonb_array_elements(p_subscriptions) loop
  insert into public.daybridge_billing_subscriptions(subscription_id,user_id,status,access_until,cancel_at_period_end)
  values(item->>'subscription_id',v_user,item->>'status',(item->>'access_until')::timestamptz,(item->>'cancel_at_period_end')::boolean)
  on conflict(subscription_id) do update set status=excluded.status,access_until=excluded.access_until,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()
   where public.daybridge_billing_subscriptions.user_id=v_user;
 end loop;
 return true;
end;
$$;
revoke all on function public.daybridge_finish_billing_sync(text,bigint,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.daybridge_finish_billing_sync(text,bigint,jsonb,text,text,jsonb) to service_role;

create function public.daybridge_reserve_checkout(p_user_id uuid) returns setof public.daybridge_billing_customers
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.daybridge_billing_customers where user_id=p_user_id for update;
 update public.daybridge_billing_customers set checkout_generation=checkout_generation+1,
  checkout_session_id=null,checkout_url=null,checkout_expires_at=date_trunc('second',now())+interval '35 minutes'
 where user_id=p_user_id and (checkout_expires_at is null or checkout_expires_at<now()+interval '1 minute');
 return query select * from public.daybridge_billing_customers where user_id=p_user_id;
end;
$$;
revoke all on function public.daybridge_reserve_checkout(uuid) from public,anon,authenticated;
grant execute on function public.daybridge_reserve_checkout(uuid) to service_role;

alter table public.travel_request_limits drop constraint travel_request_limits_scope_check;
alter table public.travel_request_limits add constraint travel_request_limits_scope_check
 check(scope in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test','device','billing'));
create or replace function public.take_scoped_travel_api_slot(p_user_id uuid,p_bucket timestamptz,p_scope text,p_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare consumed integer;
begin
 if p_user_id is null or p_bucket is null or p_scope is null or p_limit is null or p_limit<1 or p_limit>1000 or
  p_scope not in ('map-streets','map-flow','map-incidents','places','geocode','route','push-test','device','billing') then return false; end if;
 delete from public.travel_request_limits where user_id=p_user_id and scope=p_scope and bucket<p_bucket-interval '1 day';
 insert into public.travel_request_limits(user_id,bucket,scope,count) values(p_user_id,p_bucket,p_scope,1)
 on conflict(user_id,scope,bucket) do update set count=public.travel_request_limits.count+1 where public.travel_request_limits.count<p_limit
 returning count into consumed;
 return consumed is not null;
end;
$$;
revoke all on function public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.take_scoped_travel_api_slot(uuid,timestamptz,text,integer) to service_role;
