import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; project type declarations target Node 20.
import {registerHooks} from 'node:module';
import {generateParticipantUsername as realUsername} from '../lib/admin/participant-username.ts';
import {participantCreateInput,validBirthDate} from '../lib/admin/participant-input.ts';

const root=new URL('../',import.meta.url).href;
const access='data:text/javascript,'+encodeURIComponent(`export class CourtAccessError extends Error {constructor(status,message){super(message);this.status=status;}};export class StaffPasswordRequired extends CourtAccessError {};export const requireCourtAdmin=id=>globalThis.__participantAccess(id);`);
const generator='data:text/javascript,'+encodeURIComponent('export const generateParticipantUsername=()=>globalThis.__participantUsername();');
registerHooks({resolve(specifier:string,context:{parentURL?:string},next:(specifier:string,context:unknown)=>unknown){
 if(specifier.endsWith('/lib/admin/courts'))return {url:access,shortCircuit:true};
 if(specifier.endsWith('/lib/admin/participant-username'))return {url:generator,shortCircuit:true};
 if(specifier==='next/server')return {url:new URL('../node_modules/next/server.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith(root)&&!context.parentURL.includes('/node_modules/')&&! /\.[cm]?[jt]sx?$/.test(specifier))return next(new URL(specifier+'.ts',context.parentURL).href,context);
 return next(specifier,context);
}});
const {POST}=await import('../app/api/admin/participants/route.ts');
const globals=globalThis as unknown as {__participantAccess:(id:string)=>Promise<unknown>;__participantUsername:()=>string};
const court='da730f6c-165a-4af2-b135-4fc06993e46b';
const profile={court_id:court,participant_name:'  Alex   Sample  ',birth_date:'1990-01-15'};
const request=(body:unknown=profile)=>new Request('https://example.test/api/admin/participants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
type Failure={code:string};
function fixture({taken=[] as string[],authErrors=[] as (Failure|null)[],seatErrors=[] as (Failure|null)[],lookupError=false,denied=false}={}){
 const creates:Record<string,unknown>[]=[],assignments:Record<string,unknown>[]=[],deleted:string[]=[],lookups:string[]=[];
 let sequence=0;
 globals.__participantUsername=()=>['aaaa0001','bbbb0002','cccc0003','dddd0004','eeee0005','ffff0006','gggg0007','hhhh0008'][sequence++];
 globals.__participantAccess=async id=>{
  assert.equal(id,court);if(denied){const {CourtAccessError}=await import(access);throw new CourtAccessError(403,'Court access denied');}
  return {userId:'staff',court:{id:court,subscription_status:'pilot'},service:{
   from(table:string){assert.equal(table,'daybridge_court_participants');let username='';const query={select(){return query;},eq(key:string,value:string){assert.equal(key,'username');username=value;return query;},async maybeSingle(){lookups.push(username);return {data:taken.includes(username)?{user_id:'existing'}:null,error:lookupError?{code:'unavailable'}:null};}};return query;},
   auth:{admin:{async createUser(input:Record<string,unknown>){creates.push(input);const error=authErrors.shift()||null;return {data:{user:error?null:{id:'created-'+creates.length}},error};},async deleteUser(id:string){deleted.push(id);return {error:null};}}},
   async rpc(name:string,input:Record<string,unknown>){assert.equal(name,'daybridge_assign_participant_profile');assignments.push(input);return {error:seatErrors.shift()||null};}
  }};
 };
 return {creates,assignments,deleted,lookups};
}
test('generated participant usernames contain exactly four letters followed by four digits',()=>{
 for(let i=0;i<1000;i++)assert.match(realUsername(),/^[a-z]{4}[0-9]{4}$/);
});
test('profile input accepts matching names and validates real birthdays without taking a username',()=>{
 assert.equal(participantCreateInput.parse(profile).participant_name,'Alex Sample');
 assert.equal(validBirthDate('2000-02-29'),true);
 for(const value of ['2001-02-29','1990-02-30','2999-01-01','not-a-date','1990-1-1'])assert.equal(validBirthDate(value),false);
 assert.equal(participantCreateInput.safeParse({...profile,username:'chooseme'}).success,false);
 assert.equal(participantCreateInput.safeParse({...profile,participant_name:'Alex\u0000Sample'}).success,false);
});
test('provisioning retries registry and Auth collisions without touching existing users',async()=>{
 const state=fixture({taken:['aaaa0001'],authErrors:[{code:'email_exists'},null]});
 const response=await POST(request());assert.equal(response.status,201);const body=await response.json();
 assert.equal(body.username,'cccc0003');assert.match(body.temporaryPassword,/^[A-Za-z0-9_-]{32}$/);
 assert.deepEqual(Object.keys(body).sort(),['temporaryPassword','username']);
 assert.equal(state.creates.length,2);assert.deepEqual(state.deleted,[]);
 assert.deepEqual(state.assignments,[{p_court_id:court,p_user_id:'created-2',p_username:'cccc0003',p_actor_id:'staff',p_participant_name:'Alex Sample',p_birth_date:'1990-01-15'}]);
 assert.deepEqual(state.creates[1].app_metadata,{daybridge_managed:true,daybridge_must_change_password:true});
 assert.equal(state.creates[1].email,'cccc0003@accounts.daybridge.example.com');
 assert.equal(JSON.stringify(state.creates).includes('1990-01-15'),false);
});
test('a unique-index race cleans up only its new identity and retries with another username',async()=>{
 const state=fixture({seatErrors:[{code:'23505'},null]});
 const response=await POST(request());assert.equal(response.status,201);assert.equal((await response.json()).username,'bbbb0002');
 assert.deepEqual(state.deleted,['created-1']);assert.equal(state.assignments.length,2);
});
test('capacity failure rolls back the new identity and returns no credentials',async()=>{
 const state=fixture({seatErrors:[{code:'P0001'}]});const response=await POST(request());assert.equal(response.status,409);
 assert.deepEqual(state.deleted,['created-1']);assert.equal(state.creates.length,1);
 assert.deepEqual(Object.keys(await response.json()),['error']);
});
test('provider failure, unavailable registry and exhausted collisions fail closed',async()=>{
 let state=fixture({authErrors:[{code:'unexpected_failure'}]});let response=await POST(request());assert.equal(response.status,503);assert.equal(state.creates.length,1);assert.equal(state.assignments.length,0);
 state=fixture({lookupError:true});response=await POST(request());assert.equal(response.status,503);assert.equal(state.creates.length,0);
 state=fixture({authErrors:Array.from({length:8},()=>({code:'user_already_exists'}))});response=await POST(request());assert.equal(response.status,503);assert.equal(state.creates.length,8);assert.equal(state.assignments.length,0);assert.deepEqual(state.deleted,[]);
});
test('invalid input and unauthorized staff cannot create Auth users',async()=>{
 const state=fixture({denied:true});
 assert.equal((await POST(request({...profile,birth_date:'2999-01-01'}))).status,400);
 assert.equal((await POST(request({...profile,username:'attacker1234'}))).status,400);
 assert.equal((await POST(request())).status,403);assert.equal(state.creates.length,0);
});
