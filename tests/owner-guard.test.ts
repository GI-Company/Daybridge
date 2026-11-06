import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; repository uses older Node type declarations.
import {registerHooks} from 'node:module';
type Identity={id:string;app_metadata?:Record<string,unknown>;user_metadata?:Record<string,unknown>};
const state={user:null as Identity|null,current:null as Identity|null,lookupError:false,lookups:0};
Object.assign(globalThis,{__ownerGuardTest:state});
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
 if(context.parentURL?.endsWith('/lib/admin/owner.ts')){
  if(specifier==='../supabase/server')return {url:'data:text/javascript,'+encodeURIComponent('export async function serverSupabase(){return {auth:{getUser:async()=>({data:{user:globalThis.__ownerGuardTest.user},error:null})}}}'),shortCircuit:true};
  if(specifier==='./courts')return {url:'data:text/javascript,'+encodeURIComponent('export class CourtAccessError extends Error{constructor(status,message){super(message);this.status=status}};export function serviceClient(){return {auth:{admin:{getUserById:async()=>{const s=globalThis.__ownerGuardTest;s.lookups++;return {data:{user:s.current},error:s.lookupError?{}:null}}}}}}'),shortCircuit:true};
 }
 return next(specifier,context);
}});
const {requirePlatformOwner}=await import('../lib/admin/owner.ts');
const status=(expected:number)=>(error:unknown)=>(error as {status:number}).status===expected;
test('owner HTTP guard rejects anonymous, user-editable roles, stale grants and lookup failures',async()=>{
 await assert.rejects(requirePlatformOwner(),status(401));assert.equal(state.lookups,0);
 state.user={id:'one',app_metadata:{daybridge_platform_owner:true}};
 state.current={id:'one',user_metadata:{daybridge_platform_owner:true}};
 await assert.rejects(requirePlatformOwner(),status(403));
 state.current.app_metadata={daybridge_platform_owner:'true'};await assert.rejects(requirePlatformOwner(),status(403));
 state.current.app_metadata={daybridge_platform_owner:true};assert.equal((await requirePlatformOwner()).userId,'one');
 state.current.app_metadata={};await assert.rejects(requirePlatformOwner(),status(403));
 state.lookupError=true;await assert.rejects(requirePlatformOwner(),status(503));
});
