import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; project type declarations target Node 20.
import {registerHooks} from 'node:module';
const nextServer=new URL('../node_modules/next/server.js',import.meta.url).href;
const accessModule='data:text/javascript,'+encodeURIComponent(`export class CourtAccessError extends Error {constructor(status,message){super(message);this.status=status;}};export const requireCourtAdmin=(id)=>globalThis.__activityAccess(id);`);
registerHooks({resolve(specifier:string,context:unknown,next:(specifier:string,context:unknown)=>unknown){
 if(specifier.endsWith('/lib/admin/courts'))return {url:accessModule,shortCircuit:true};
 if(specifier==='next/server')return {url:nextServer,shortCircuit:true};return next(specifier,context);
}});
const {GET}=await import('../app/api/admin/activity/route.ts');
const court='da730f6c-165a-4af2-b135-4fc06993e46b';
const global=globalThis as unknown as {__activityAccess:(id:string)=>Promise<unknown>};
test('activity rejects invalid cursors before authorization and enforces the existing court guard',async()=>{
 let calls=0;global.__activityAccess=async()=>{calls++;const {CourtAccessError}=await import(accessModule);throw new CourtAccessError(403,'Court denied');};
 const invalid=await GET(new Request('https://example.test/api/admin/activity?court_id='+court+'&before=invalid'));
 assert.equal(invalid.status,400);assert.equal(calls,0);
 const denied=await GET(new Request('https://example.test/api/admin/activity?court_id='+court));assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{error:'Court denied'});assert.equal(denied.headers.get('Cache-Control'),'private, no-store');
});
test('activity pagination returns only court-scoped audit metadata and filters usernames by the same court',async()=>{
 const calls:Array<{table:string;method:string;args:unknown[]}>=[];
 const rows=Array.from({length:51},(_,index)=>({id:`d0000000-0000-4000-8000-${String(100-index).padStart(12,'0')}`,action:'participant_created',actor_id:'staff',subject_user_id:'participant',created_at:'2026-11-03T12:00:00+00:00'}));
 global.__activityAccess=async id=>{assert.equal(id,court);return {userId:'staff',service:{from(table:string){
  const builder={select(...args:unknown[]){calls.push({table,method:'select',args});return builder;},eq(...args:unknown[]){calls.push({table,method:'eq',args});return builder;},order(){return builder;},limit(){return builder;},or(...args:unknown[]){calls.push({table,method:'or',args});return builder;},in(){return builder;},then(resolve:(value:unknown)=>unknown){return Promise.resolve(resolve({data:table==='daybridge_court_audit'?rows:[{user_id:'participant',username:'participant001'}],error:null}));}};return builder;}
 }}};
 const response=await GET(new Request('https://example.test/api/admin/activity?court_id='+court));assert.equal(response.status,200);const result=await response.json();assert.equal(result.entries.length,50);assert.equal(result.entries[0].username,'participant001');assert.equal(result.entries[0].actor_label,'You');assert.deepEqual(Object.keys(result.entries[0]).sort(),['action','actor_label','created_at','id','username']);
 assert.deepEqual(result.nextCursor,{time:rows[49].created_at,id:rows[49].id});
 for(const table of ['daybridge_court_audit','daybridge_court_participants'])assert.ok(calls.some(call=>call.table===table&&call.method==='eq'&&call.args[0]==='court_id'&&call.args[1]===court));
 await GET(new Request('https://example.test/api/admin/activity?'+new URLSearchParams({court_id:court,before:result.nextCursor.time,before_id:result.nextCursor.id})));
 assert.ok(calls.some(call=>call.method==='or'&&String(call.args[0]).includes('id.lt.'+rows[49].id)));
});
