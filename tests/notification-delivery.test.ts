import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; the repository still uses the Node 20 type declarations.
import {registerHooks} from 'node:module';
import type {SupabaseClient} from '@supabase/supabase-js';
// Preserve the production server-only guard; the test runner imports this server module explicitly.
registerHooks({resolve(specifier:string,context:unknown,next:(specifier:string,context:unknown)=>unknown){return specifier==='server-only'?{url:'data:text/javascript,export{}',shortCircuit:true}:next(specifier,context);}});
const {deliverNotification}=await import('../lib/notifications/delivery.ts');
type Row=Record<string,unknown>;
function database(){
 const tables:Record<string,Row[]>={push_subscriptions:[{id:'device-a',user_id:'owner',endpoint:'https://push.test/a',keys_auth:'auth',keys_p256dh:'key',disabled_at:null},{id:'device-b',user_id:'owner',endpoint:'https://push.test/b',keys_auth:'auth',keys_p256dh:'key',disabled_at:null}],notification_deliveries:[],notification_device_receipts:[]};
 function from(name:string){
  let mode='select',value:Row={},filters:((row:Row)=>boolean)[]=[],options:{ignoreDuplicates?:boolean;onConflict?:string}={};
  const query={select(){return query;},eq(key:string,target:unknown){filters.push(row=>row[key]===target);return query;},is(key:string,target:unknown){return query.eq(key,target);},update(row:Row){mode='update';value=row;return query;},upsert(row:Row,opts:typeof options){mode='upsert';value=row;options=opts;return query;},maybeSingle(){return Promise.resolve(execute(true));},then(resolve:(value:unknown)=>unknown){return Promise.resolve(execute(false)).then(resolve);}};
  function execute(single:boolean){
   let rows=tables[name].filter(row=>filters.every(match=>match(row)));
   if(mode==='upsert'){
    const keys=(options.onConflict||'id').split(',');const prior=tables[name].find(row=>keys.every(key=>row[key]===value[key]));
    if(prior){rows=options.ignoreDuplicates?[]:[Object.assign(prior,value)];}
    else {const row={id:'delivery-1',attempt_count:0,...value};tables[name].push(row);rows=[row];}
   }else if(mode==='update')rows.forEach(row=>Object.assign(row,value));
   return {data:single?rows[0]||null:rows,error:null};
  }
  return query;
 }
 return {admin:{from} as unknown as SupabaseClient,tables};
}
const now=Date.parse('2026-10-23T14:00:00Z');
const delivery={userId:'owner',key:'event:1:slot',kind:'event',expires:now+30*60000,message:{kind:'event',title:'DayBridge reminder',body:'Open the appointment',url:'/?tab=schedule&event=1'}};
test('partial delivery retries only the failed device and becomes complete after acceptance',async()=>{
 const db=database(),calls:string[]=[];
 const send=async(subscription:{endpoint:string})=>{calls.push(subscription.endpoint);if(subscription.endpoint.endsWith('/b'))throw Object.assign(Error('temporary'),{statusCode:503});return {statusCode:201,body:'',headers:{}};};
 assert.deepEqual(await deliverNotification(db.admin,delivery,now,send),{accepted:1,failed:1});
 assert.equal(db.tables.notification_deliveries[0].status,'failed');assert.equal(db.tables.notification_device_receipts.length,1);
 const retry=async(subscription:{endpoint:string})=>{calls.push(subscription.endpoint);return {statusCode:201,body:'',headers:{}};};
 assert.deepEqual(await deliverNotification(db.admin,delivery,now+60000,retry),{accepted:0,failed:0});
 assert.deepEqual(await deliverNotification(db.admin,delivery,now+180000,retry),{accepted:1,failed:0});
 assert.deepEqual(calls,['https://push.test/a','https://push.test/b','https://push.test/b']);
 assert.equal(db.tables.notification_deliveries[0].status,'sent');
 await deliverNotification(db.admin,delivery,now+360000,retry);assert.equal(calls.length,3);
});
test('expired device subscriptions are disabled and expired reminders are never sent',async()=>{
 const db=database();let calls=0;
 const send=async()=>{calls++;throw Object.assign(Error('gone'),{statusCode:410});};
 assert.deepEqual(await deliverNotification(db.admin,{...delivery,expires:now},now,send),{accepted:0,failed:0});assert.equal(calls,0);
 await deliverNotification(db.admin,delivery,now,send);assert.equal(calls,2);
 assert.ok(db.tables.push_subscriptions.every(row=>row.disabled_at));assert.equal(db.tables.notification_deliveries[0].status,'no_subscription');
});
