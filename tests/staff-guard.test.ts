import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime hook, older repository type declarations.
import {registerHooks} from 'node:module';
const state={member:{role:'coordinator',password_change_required:false,credential_version:'version',credential_valid_after:null as string|null},current:true,claimsError:false,claims:{sub:'staff',session_id:'session'},email:'manager@ga.beta.court',sessionChecks:0};
Object.assign(globalThis,{__staffGuard:state});
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
 if(context.parentURL?.endsWith('/lib/admin/courts.ts')){
  const stub=(source:string)=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
  if(specifier==='../supabase/server')return stub(`export async function serverSupabase(){const s=globalThis.__staffGuard;return {auth:{getUser:async()=>({data:{user:{id:'staff',email:s.email}},error:null}),getClaims:async()=>({data:{claims:s.claims},error:s.claimsError?{}:null})}}}`);
  if(specifier==='../auth/court-staff')return next(specifier+'.ts',context);
  if(specifier==='@supabase/supabase-js')return stub(`export function createClient(){const s=globalThis.__staffGuard;return {from:(table)=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:s.member,error:null}),single:async()=>({data:table==='daybridge_courts'?{id:'court',circuit_id:'circuit',login_slug:'court',enabled:true}:{state_code:'GA',login_slug:'beta'},error:null})};return chain;},rpc:async()=>{s.sessionChecks++;return {data:s.current,error:null}}}}`);
 }
 return next(specifier,context);
}});
const {requireCourtAdmin}=await import('../lib/admin/courts.ts');
const status=(n:number)=>(error:unknown)=>(error as {status:number}).status===n;
test('court guard restricts temporary credentials and rejects pre-reset or forged session claims',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fictional-test-service';
 assert.equal((await requireCourtAdmin('court')).userId,'staff');assert.equal(state.sessionChecks,0);
 state.member.password_change_required=true;await assert.rejects(requireCourtAdmin('court'),status(403));
 assert.equal((await requireCourtAdmin('court',{allowPasswordChange:true})).passwordChangeRequired,true);
 state.member.password_change_required=false;state.member.credential_valid_after='2026-11-06T12:00:00Z';state.current=false;
 await assert.rejects(requireCourtAdmin('court'),status(401));assert.equal(state.sessionChecks,1);
 state.current=true;assert.equal((await requireCourtAdmin('court')).userId,'staff');
 state.claims.sub='other';await assert.rejects(requireCourtAdmin('court'),status(401));
 state.claims.sub='staff';state.claimsError=true;await assert.rejects(requireCourtAdmin('court'),status(401));
 state.claimsError=false;state.email='manager@ga.other.court';await assert.rejects(requireCourtAdmin('court'),status(403));
});
