import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime hook, older repository type declarations.
import {registerHooks} from 'node:module';
const user='a1000000-0000-4000-8000-000000000001',court='a1000000-0000-4000-8000-000000000002';
const state={denied:false,member:true,queries:[] as Array<{name:string;value:unknown}>,rows:Array.from({length:26},(_,i)=>({id:'audit-'+i,action:'participant_created',actor_id:user,created_at:'2026-11-06T12:00:00.000Z'}))};
Object.assign(globalThis,{__staffHistoryRoute:state});
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(context.parentURL?.endsWith('/api/owner/staff/activity/route.ts')){
  const stubModule=(source:string)=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
  if(specifier==='next/server')return stubModule('export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)}');
  if(specifier.endsWith('/admin/courts'))return stubModule('export class CourtAccessError extends Error{constructor(status,message){super(message);this.status=status}};globalThis.__staffHistoryError=CourtAccessError;');
  if(specifier.endsWith('/admin/owner'))return stubModule(`export async function requirePlatformOwner(){const s=globalThis.__staffHistoryRoute;if(s.denied){throw new globalThis.__staffHistoryError(403,'Owner access required');}return {service:{from:(table)=>{
   const chain={select:(v)=>{s.queries.push({name:table+'.select',value:v});return chain;},eq:(key,value)=>{s.queries.push({name:table+'.'+key,value});return chain;},or:(value)=>{s.queries.push({name:'filter',value});return chain;},order:()=>chain,limit:async()=>({data:s.rows,error:null}),maybeSingle:async()=>({data:s.member?{user_id:'staff'}:null,error:null})};return chain;
  }}}}`);
 }
 return next(specifier,context);
}});
const {GET}=await import('../app/api/owner/staff/activity/route.ts');
const request=(extra='')=>new Request(`https://daybridge.test/api/owner/staff/activity?court_id=${court}&user_id=${user}${extra}`);
test('staff history includes retained assignments, scopes actor/subject to the court and paginates without private fields',async()=>{
 const response=await GET(request()),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.entries.length,25);assert.equal(data.entries[0].relation,'Performed by this staff member');
 assert.equal('actor_id' in data.entries[0],false);assert.equal(data.nextCursor.id,'audit-24');
 assert.ok(state.queries.some(q=>q.name==='daybridge_court_audit.court_id'&&q.value===court));
 assert.equal(state.queries.find(q=>q.name==='filter')?.value,`actor_id.eq.${user},subject_user_id.eq.${user}`);
 state.queries=[];
 assert.equal((await GET(request('&before=2026-11-06T12:00:00.000Z&before_id='+court))).status,200);
 assert.match(String(state.queries.find(q=>q.name==='filter')?.value),/^and\(actor_id.eq\./);assert.match(String(state.queries.find(q=>q.name==='filter')?.value),/subject_user_id.eq/);
 state.queries=[];assert.equal((await GET(request('&before=bad,filter'))).status,400);assert.equal(state.queries.length,0);
 state.member=false;assert.equal((await GET(request())).status,404);
 state.queries=[];state.denied=true;assert.equal((await GET(request())).status,403);assert.equal(state.queries.length,0);
});
