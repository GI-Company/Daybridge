-- Run after the reliable-notification-delivery migration. All fixture writes roll back.
begin;
do $$
declare owner_id uuid; delivery uuid; first_device uuid; second_device uuid; changed int;
begin
 select user_id into owner_id from public.private_snapshots limit 1;
 if owner_id is null then raise exception 'A fixture account is required'; end if;
 insert into public.notification_deliveries(user_id,dedupe_key,kind,status)
 values(owner_id,'notification-contract-'||gen_random_uuid(),'task','pending') returning id into delivery;
 update public.notification_deliveries set status='sending',attempt_count=1 where id=delivery and status='pending' and attempt_count=0;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'First queue claim failed'; end if;
 update public.notification_deliveries set status='sending',attempt_count=1 where id=delivery and status='pending' and attempt_count=0;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Duplicate queue claim succeeded'; end if;
 insert into public.push_subscriptions(user_id,endpoint,keys_p256dh,keys_auth,disabled_at)
 values(owner_id,'https://fcm.googleapis.com/contract-'||gen_random_uuid(),'fixture','fixture',now()) returning id into first_device;
 insert into public.push_subscriptions(user_id,endpoint,keys_p256dh,keys_auth,disabled_at)
 values(owner_id,'https://fcm.googleapis.com/contract-'||gen_random_uuid(),'fixture','fixture',now()) returning id into second_device;
 insert into public.notification_device_receipts(delivery_id,subscription_id) values(delivery,first_device),(delivery,second_device);
 insert into public.notification_device_receipts(delivery_id,subscription_id) values(delivery,first_device) on conflict do nothing;
 if (select count(*) from public.notification_device_receipts where delivery_id=delivery)<>2 then raise exception 'Per-device receipt dedupe failed'; end if;
 if has_table_privilege('authenticated','public.notification_device_receipts','SELECT') or has_table_privilege('anon','public.notification_device_receipts','INSERT') then raise exception 'Device receipts must remain server-only'; end if;
 if not (select relrowsecurity from pg_class where oid='public.notification_device_receipts'::regclass) then raise exception 'Receipt RLS is disabled'; end if;
end $$;
rollback;
select 'Queue claims, per-device receipt deduplication and access controls passed; fixture writes rolled back.' as result;
