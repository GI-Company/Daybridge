import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
const independent='b0000000-0000-4000-8000-000000000001',sponsored='b0000000-0000-4000-8000-000000000002',removed='b0000000-0000-4000-8000-000000000003',suspended='b0000000-0000-4000-8000-000000000004';
test('removed accounts require paid access at the database while identities and records remain intact',async()=>{
 const {db}=await isolatedDatabase();
 try{
  const court=(await db.query('select id from public.daybridge_courts limit 1')).rows[0].id;
  for(const id of [independent,sponsored,removed,suspended]){
   await db.query('insert into auth.users(id) values($1)',[id]);
   await db.query('insert into public.private_snapshots(user_id,payload,revision) values($1,$2,1)',[id,JSON.stringify({events:[{id:'event-'+id,title:'Preserved'}]})]);
  }
  for(const [id,status] of [[sponsored,'active'],[removed,'removed'],[suspended,'suspended']])await db.query('insert into public.daybridge_court_participants(user_id,court_id,username,status,created_by) values($1,$2,$3,$4,$1)',[id,court,'participant_'+status,status]);
  for(const [id,allowed] of [[independent,true],[sponsored,true],[removed,false],[suspended,false]])await asRole(db,'authenticated',id,async()=>{
   assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,allowed);
   assert.equal((await db.query('select * from public.private_snapshots')).rows.length,allowed?1:0);
   if(!allowed)await assert.rejects(db.query("select public.save_private_snapshot_for_user($1,'{}',1)",[id]));
   for(const table of ['daybridge_billing_customers','daybridge_billing_subscriptions','daybridge_billing_events','daybridge_billing_risks'])await assert.rejects(db.query('select * from public.'+table));
   await assert.rejects(db.query("select public.daybridge_begin_billing_sync('cus_fixture')"));
  });
  await db.query("insert into public.daybridge_billing_customers(user_id,customer_id) values($1,'cus_fixture'),($2,'cus_suspended')",[removed,suspended]);
  await asRole(db,'service_role','',async()=>{
   const first=(await db.query("select public.daybridge_begin_billing_sync('cus_fixture') as n")).rows[0].n;
   const second=(await db.query("select public.daybridge_begin_billing_sync('cus_fixture') as n")).rows[0].n;
   const payload=[{subscription_id:'sub_fixture',status:'active',access_until:new Date(Date.now()+86400000).toISOString(),cancel_at_period_end:true}];
   assert.equal((await db.query('select public.daybridge_finish_billing_sync($1,$2,$3,$4,$5) as ok',['cus_fixture',first,JSON.stringify(payload),'evt_stale','invoice.paid'])).rows[0].ok,false);
   assert.equal((await db.query("select count(*)::int as n from public.daybridge_billing_events where event_id='evt_stale'")).rows[0].n,0);
   assert.equal((await db.query('select public.daybridge_finish_billing_sync($1,$2,$3,$4,$5) as ok',['cus_fixture',second,JSON.stringify(payload),'evt_paid','invoice.paid'])).rows[0].ok,true);
  });
  await asRole(db,'authenticated',removed,async()=>{
   assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,true);
   assert.equal((await db.query('select payload from public.private_snapshots')).rows[0].payload.events[0].title,'Preserved');
  });
  await db.query("insert into public.daybridge_billing_subscriptions(subscription_id,user_id,status,access_until) values('sub_suspended',$1,'active',now()+interval '1 month')",[suspended]);
  await asRole(db,'authenticated',suspended,async()=>assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,false));
  await db.query("insert into public.daybridge_billing_events(event_id,event_type) values('evt_risk','charge.dispute.created')");
  await db.query("insert into public.daybridge_billing_risks values('evt_risk','sub_fixture','charge.dispute.created',true)");
  await asRole(db,'authenticated',removed,async()=>assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,false));
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int as n from public.private_snapshots')).rows[0].n,4);
  await db.query("update public.daybridge_court_participants set status='active' where user_id=$1",[removed]);
  await asRole(db,'authenticated',removed,async()=>assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,true));
 }finally{await db.close();}
});
