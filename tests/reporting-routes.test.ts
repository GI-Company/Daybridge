import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
// @ts-expect-error Node 24 runtime API; repository types target Node 20.
import {registerHooks} from 'node:module';
const court='d6000000-0000-4000-8000-000000000001',actor='d6000000-0000-4000-8000-000000000003';
const state={user:{id:actor,email:'manager@zz.samplecircuit.samplecourt',app_metadata:{}} as {id:string;email:string;app_metadata:Record<string,unknown>}|null,member:true,passwordRequired:false,rpcError:null as {code:string}|null,calls:[] as {name:string;input:Record<string,unknown>}[]};
Object.assign(globalThis,{__reportingRoutes:state});
const stub=(s:string)=>({url:'data:text/javascript,'+encodeURIComponent(s),shortCircuit:true});
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(specifier==='server-only')return stub('export{}');
 if(specifier==='next/server')return next('next/server.js',context);
 if(specifier.endsWith('/supabase/server'))return stub('export async function serverSupabase(){return {auth:{getUser:async()=>({data:{user:globalThis.__reportingRoutes.user},error:null})}}}');
 if(context.parentURL?.endsWith('/lib/admin/courts.ts')&&specifier==='@supabase/supabase-js')return stub(`export function createClient(){const s=globalThis.__reportingRoutes;return {auth:{admin:{getUserById:async()=>({data:{user:s.user},error:null})}},from:(table)=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:s.member?{role:'coordinator',password_change_required:s.passwordRequired}:null,error:null}),single:async()=>({data:table==='daybridge_courts'?{id:'${court}',circuit_id:'circuit',login_slug:'samplecourt',enabled:true}:{state_code:'ZZ',login_slug:'samplecircuit'},error:null})};return chain;},rpc:async(name,input)=>{s.calls.push({name,input});return {data:{enabled:false},error:s.rpcError}}}}`);
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')&&!specifier.endsWith('.ts')){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};}
 return next(specifier,context);
}});
const staff=await import('../app/api/admin/progress/route.ts');
const participant=await import('../app/api/participant/reporting/route.ts');
const owner=await import('../app/api/owner/reporting/route.ts');
const url='https://example.test';
const get=()=>new Request(url+'/api/admin/progress?'+new URLSearchParams({court_id:court,start:'2026-11-01T00:00:00Z',end:'2026-12-01T00:00:00Z'}));
const post=(body:unknown,origin=url)=>new Request(url+'/api/participant/reporting',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('staff progress API rejects absent, revoked, mismatched, temporary and SQL-denied access',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fictional-route-key';
 const signed=state.user;state.user=null;assert.equal((await staff.GET(get())).status,401);assert.equal(state.calls.length,0);
 state.user=signed;state.member=false;assert.equal((await staff.GET(get())).status,403);assert.equal(state.calls.length,0);
 state.member=true;state.passwordRequired=true;const temp=await staff.GET(get());assert.equal(temp.status,403);assert.equal((await temp.json()).password_change_required,true);
 state.passwordRequired=false;state.user!.email='manager@zz.other.samplecourt';assert.equal((await staff.GET(get())).status,403);
 state.user!.email='manager@zz.samplecircuit.samplecourt';state.rpcError={code:'42501'};assert.equal((await staff.GET(get())).status,403);
 state.rpcError=null;const r=await staff.GET(get());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 assert.equal(state.calls.at(-1)?.input.p_actor,actor);assert.equal(state.calls.at(-1)?.input.p_court,court);
});
test('participant API derives identity from session and rejects role bypass, secret payloads and CSRF',async()=>{
 const consent={action:'consent',category:'meeting',enabled:true};
 for(const extra of [{user_id:'other'},{court_id:court},{description:'secret'},{medication:'secret'}])assert.equal((await participant.POST(post({...consent,...extra}))).status,400);
 assert.equal((await participant.POST(post(consent,'https://evil.invalid'))).status,403);
 state.rpcError={code:'42501'};assert.equal((await participant.POST(post(consent))).status,403);
 state.rpcError={code:'P0001'};assert.equal((await participant.POST(post(consent))).status,400);
 state.rpcError=null;const r=await participant.POST(post(consent));assert.equal(r.status,200);assert.equal(state.calls.at(-1)?.input.p_actor,actor);
 assert.deepEqual(state.calls.at(-1)?.input.p_input,consent);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 const signed=state.user;state.user=null;assert.equal((await participant.GET()).status,401);state.user=signed;
});
test('owner reporting endpoint configures availability only, with a fresh owner check',async()=>{
 assert.equal((await owner.GET(new Request(url+'/api/owner/reporting?court_id='+court))).status,403);
 state.user!.app_metadata={daybridge_platform_owner:true};const r=await owner.PATCH(post({court_id:court,enabled:false}));assert.equal(r.status,200);
 assert.equal(state.calls.at(-1)?.name,'daybridge_owner_reporting');assert.equal(state.calls.at(-1)?.input.p_enabled,false);
 assert.deepEqual(await r.json(),{enabled:false});state.user!.app_metadata={};
});
