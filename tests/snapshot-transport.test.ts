import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {snapshotTransport} from '../lib/storage/snapshot-transport.ts';
function fixture(){
 let row:{payload:Record<string,unknown>;revision:number}|null={payload:{tasks:[{id:'one'}]},revision:1},allowed=true;
 const fields:string[]=[];
 const backend={from(table:string){assert.equal(table,'private_snapshots');let field='';return {select(value:string){field=value;fields.push(value);return this;},eq(key:string,value:string){assert.equal(key,'user_id');assert.equal(value,'owner');return this;},async maybeSingle(){return {data:row?(field==='revision'?{revision:row.revision}:structuredClone(row)):null,error:null};}};},async rpc(name:string,args?:Record<string,unknown>){if(name==='daybridge_workspace_access')return {data:allowed,error:null};assert.equal(args?.p_user_id,'owner');row={payload:args?.p_payload as Record<string,unknown>,revision:Number(args?.p_expected_revision)+1};return {data:row.revision,error:null};}} as unknown as SupabaseClient;
 return {transport:snapshotTransport(backend,'owner'),fields,setRow(value:typeof row){row=value;},deny(){allowed=false;row=null;}};
}
test('unchanged cloud polls read revisions, and a remote edit fetches the current payload',async()=>{
 const f=fixture();const first=await f.transport.read();first.payload.tasks=[];
 assert.equal((await f.transport.read()).payload.tasks instanceof Array,true);
 assert.deepEqual((await f.transport.read()).payload.tasks,[{id:'one'}]);
 f.setRow({payload:{tasks:[{id:'two'}]},revision:2});
 assert.deepEqual(await f.transport.read(),{payload:{tasks:[{id:'two'}]},revision:2});
 assert.deepEqual(f.fields,['payload,revision','revision','revision','revision','payload,revision']);
});
test('RLS-hidden records fail closed rather than becoming an empty cloud workspace',async()=>{
 const f=fixture();await f.transport.read();f.deny();await assert.rejects(f.transport.read(),/Cloud access unavailable/);
 const initial=fixture();initial.deny();await assert.rejects(initial.transport.read(),/Cloud access unavailable/);
 const fresh=fixture();fresh.setRow(null);assert.deepEqual(await fresh.transport.read(),{payload:{},revision:0});
});
test('a successful save updates the cache without confusing subsequent remote revisions',async()=>{
 const f=fixture();await f.transport.read();const value={tasks:[{id:'saved'}]};assert.equal(await f.transport.save(value,1),2);value.tasks=[];
 assert.deepEqual((await f.transport.read()).payload.tasks,[{id:'saved'}]);
 f.setRow({payload:{tasks:[{id:'another-device'}]},revision:3});assert.deepEqual((await f.transport.read()).payload.tasks,[{id:'another-device'}]);
});
