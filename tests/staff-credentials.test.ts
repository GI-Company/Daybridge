import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime hook, older repository type declarations.
import {registerHooks} from 'node:module';
import type {SupabaseClient} from '@supabase/supabase-js';
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
 if(context.parentURL?.endsWith('/lib/admin/staff-credentials.ts')){
  if(specifier==='./courts')return {url:'data:text/javascript,'+encodeURIComponent('export class CourtAccessError extends Error{constructor(status,message){super(message);this.status=status}}'),shortCircuit:true};
  if(specifier==='../auth/court-staff')return next(specifier+'.ts',context);
 }
 return next(specifier,context);
}});
const {createStaffCredentials,resetStaffCredentials}=await import('../lib/admin/staff-credentials.ts');
function fixture(){
 const calls:Array<{name:string;input:Record<string,unknown>}>=[];
 const state={rpcError:false,authError:false,finishError:false,createdError:false};
 const client={from:(name:string)=>({select:()=>({eq:()=>({single:async()=>({data:name==='daybridge_courts'?{circuit_id:'circuit',login_slug:'court'}:{state_code:'GA',login_slug:'circuit'},error:null})})})}),
  auth:{admin:{createUser:async(input:Record<string,unknown>)=>{calls.push({name:'create',input});return {data:{user:state.createdError?null:{id:'new-staff'}},error:state.createdError?{}:null};},deleteUser:async(id:string)=>{calls.push({name:'delete',input:{id}});return {error:null};},updateUserById:async(id:string,input:Record<string,unknown>)=>{calls.push({name:'reset',input:{id,...input}});return {error:state.authError?{}:null};}}},
  rpc:async(name:string,input:Record<string,unknown>)=>{calls.push({name,input});return {data:name==='daybridge_owner_staff_credentials'?'manager@ga.circuit.court':!state.finishError,error:state.rpcError&&name==='daybridge_owner_staff_credentials'?{code:'42501'}:null};}} as unknown as SupabaseClient;
 return {client,calls,state};
}
test('staff creation uses server-generated credentials, assigns only the created identity, and returns once',async()=>{
 const {client,calls}=fixture();
 const result=await createStaffCredentials(client,'owner',{court_id:'court',username:'manager',role:'case_manager'});
 assert.equal(result.email,'manager@ga.circuit.court');assert.match(result.temporaryPassword,/^[A-Za-z0-9_-]{32}$/);
 assert.deepEqual(calls.map(c=>c.name),['create','daybridge_owner_staff_credentials','daybridge_owner_finish_staff_credentials']);
 assert.deepEqual(calls[0].input.app_metadata,{daybridge_staff_managed:true});assert.equal(calls[1].input.p_user,'new-staff');
 assert.equal(JSON.stringify(calls.slice(1)).includes(result.temporaryPassword),false);
});
test('failed assignment cleans up only the newly created identity; duplicate creation cannot reset an existing user',async()=>{
 const {client,calls,state}=fixture();state.rpcError=true;
 await assert.rejects(createStaffCredentials(client,'owner',{court_id:'court',username:'manager',role:'coordinator'}));
 assert.equal(calls.at(-1)?.name,'delete');assert.equal(calls.at(-1)?.input.id,'new-staff');
 calls.length=0;state.createdError=true;
 await assert.rejects(createStaffCredentials(client,'owner',{court_id:'court',username:'manager',role:'coordinator'}));
 assert.deepEqual(calls.map(c=>c.name),['create']);
});
test('resets restrict access before Auth mutation and do not issue credentials when validation or Auth fails',async()=>{
 const {client,calls,state}=fixture();
 state.rpcError=true;await assert.rejects(resetStaffCredentials(client,'owner',{court_id:'court',user_id:'staff'}));assert.equal(calls.length,1);
 calls.length=0;state.rpcError=false;state.authError=true;
 await assert.rejects(resetStaffCredentials(client,'owner',{court_id:'court',user_id:'staff'}),/stays restricted/);
 assert.deepEqual(calls.map(c=>c.name),['daybridge_owner_staff_credentials','reset','daybridge_owner_finish_staff_credentials']);
 assert.equal(calls[2].input.p_success,false);
 calls.length=0;state.authError=false;
 const result=await resetStaffCredentials(client,'owner',{court_id:'court',user_id:'staff'});assert.match(result.temporaryPassword,/^[A-Za-z0-9_-]{32}$/);assert.equal(calls[2].input.p_success,true);
});
