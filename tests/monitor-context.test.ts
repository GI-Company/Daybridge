import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; repository currently uses Node 20 declarations.
import {registerHooks} from 'node:module';
import type {SupabaseClient} from '@supabase/supabase-js';
registerHooks({resolve(specifier:string,context:unknown,next:(specifier:string,context:unknown)=>unknown){return specifier==='server-only'?{url:'data:text/javascript,export{}',shortCircuit:true}:next(specifier,context);}});
const {monitorContext,eachAccount}=await import('../lib/notifications/monitor-context.ts');
test('pipelines share one authorized read per account and never share caches across runs',async()=>{
 let calls=0;
 const admin={async rpc(name:string,args:{p_user_id:string}){calls++;assert.equal(name,'daybridge_reminder_snapshot');return {data:args.p_user_id==='blocked'?[]:[{payload:{tasks:[{id:args.p_user_id}]}}],error:null};}} as unknown as SupabaseClient;
 const context=monitorContext(admin);const [a,b,c]=await Promise.all([context.snapshot('one'),context.snapshot('one'),context.snapshot('two')]);
 assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.equal(calls,2);assert.equal(await context.snapshot('blocked'),null);
 await monitorContext(admin).snapshot('one');assert.equal(calls,4);
});
test('authorization lookup failures never fall back to unrestricted snapshot reads',async()=>{
 const admin={async rpc(){return {data:null,error:{message:'unavailable'}};}} as unknown as SupabaseClient;
 await assert.rejects(monitorContext(admin).snapshot('one'),/authorized reminder records/);
});
test('all 25 accounts complete with bounded concurrency and independent failures',async()=>{
 let active=0,peak=0,failed=0;const completed:number[]=[];
 await eachAccount(Array.from({length:25},(_,i)=>i),async account=>{
  active++;peak=Math.max(peak,active);
  try{await new Promise(resolve=>setTimeout(resolve,2));if(account===3)throw Error('provider outage');completed.push(account);}catch{failed++;}finally{active--;}
 });
 assert.equal(peak,4);assert.equal(active,0);assert.equal(failed,1);assert.equal(completed.length,24);assert.ok(completed.includes(24));
});
