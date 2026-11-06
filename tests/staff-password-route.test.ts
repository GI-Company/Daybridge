import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime hook, older repository type declarations.
import {registerHooks} from 'node:module';
const state={calls:[] as string[],denied:false,wrongPassword:false,passwordError:false,completion:false};
Object.assign(globalThis,{__staffPasswordRoute:state});
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(context.parentURL?.endsWith('/api/admin/staff-password/route.ts')){
  const stubModule=(source:string)=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
  if(specifier==='next/server')return stubModule('export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)}');
  if(specifier==='@supabase/supabase-js')return stubModule(`export function createClient(){const s=globalThis.__staffPasswordRoute;return {auth:{
   signInWithPassword:async()=>{s.calls.push('verify');return {data:{user:{id:'staff'}},error:s.wrongPassword?{}:null}},
   updateUser:async()=>{s.calls.push('rotate');return {error:s.passwordError?{}:null}},
   signOut:async()=>{s.calls.push('signout');return {error:null}}
  }}}`);
  if(specifier.endsWith('/admin/courts'))return stubModule(`export class CourtAccessError extends Error{constructor(status,message){super(message);this.status=status}};
   export async function requireCourtAdmin(){const s=globalThis.__staffPasswordRoute;s.calls.push('guard');if(s.denied)throw new CourtAccessError(401,'Not signed in');return {
    passwordChangeRequired:true,credentialVersion:'version',credentialOperationUntil:null,email:'manager@ga.beta.court',userId:'staff',
    service:{rpc:async()=>{s.calls.push('complete');return {data:s.completion,error:null}}}
   }}`);
  if(specifier.startsWith('../../../../lib/'))return next(specifier+'.ts',context);
 }
 return next(specifier,context);
}});
const {POST}=await import('../app/api/admin/staff-password/route.ts');
const request=(origin='https://daybridge.test')=>new Request('https://daybridge.test/api/admin/staff-password',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({court_id:'a1000000-0000-4000-8000-000000000001',current_password:'temporary-secret',password:'different-private-password'})});
test('staff password endpoint enforces origin, signed membership, password proof and version completion in order',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-public-key';
 assert.equal((await POST(request('https://other.test'))).status,403);assert.equal(state.calls.length,0);
 state.denied=true;assert.equal((await POST(request())).status,401);assert.deepEqual(state.calls,['guard']);
 state.denied=false;state.calls=[];state.wrongPassword=true;
 assert.equal((await POST(request())).status,400);assert.deepEqual(state.calls,['guard','verify','signout']);
 state.wrongPassword=false;state.calls=[];state.passwordError=true;
 assert.equal((await POST(request())).status,400);assert.deepEqual(state.calls,['guard','verify','rotate','signout']);
 state.passwordError=false;state.calls=[];state.completion=false;
 assert.equal((await POST(request())).status,409);assert.deepEqual(state.calls,['guard','verify','rotate','complete','signout']);
 state.completion=true;state.calls=[];assert.equal((await POST(request())).status,200);assert.deepEqual(state.calls,['guard','verify','rotate','complete','signout']);
});
