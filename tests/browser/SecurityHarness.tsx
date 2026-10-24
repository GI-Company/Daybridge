'use client';
import React,{useEffect,useMemo,useState} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {DayBridgeProvider,useDayBridge} from '../../lib/storage/store';
import {SessionLock} from '../../components/common/SessionLock';
import {SecureAppGate} from '../../components/common/SecureAppGate';
import {SettingsView} from '../../components/settings/SettingsView';
import {UpdateMonitor} from '../../components/common/UpdateMonitor';
const slot='2026-10-23T12:00:00Z';
const seed=(id:string)=>({profile:{id,fullName:'Synthetic '+id},tasks:[],medications:[{id:'synthetic-med',userId:id,name:'Synthetic medication',inventoryCount:1,isActive:true,isPrn:false}],medicationLogs:[],events:[{id:'synthetic-event',userId:id,title:'Synthetic event',startTime:'2026-10-23T12:00:00Z',endTime:'2026-10-23T13:00:00Z'}]});
// Simulated transport only. The production provider and encrypted IndexedDB are used unchanged.
export function simulatedBackend(id:string,initialPayload:unknown=seed(id)):SupabaseClient{
 const key='synthetic-remote-'+id;
 const read=()=>JSON.parse(sessionStorage.getItem(key)||JSON.stringify({payload:initialPayload,revision:1}));
 return {from(){const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:read(),error:null};}};return query;},async rpc(name:string,args:Record<string,unknown>){
  if(!navigator.onLine)return {data:null,error:{message:'Synthetic offline'}};
  if(name!=='save_private_snapshot_for_user'||args.p_user_id!==id)return {data:null,error:{message:'owner mismatch'}};
  const prior=read();
  if(args.p_expected_revision!==prior.revision)return {data:null,error:{message:'snapshot_conflict'}};
  const revision=prior.revision+1;sessionStorage.setItem(key,JSON.stringify({revision,payload:args.p_payload}));
  return {data:revision,error:null};
 }} as unknown as SupabaseClient;
}
function Workspace(){
 const data=useDayBridge();
 return <>
  <p data-testid="sync-status">{data.syncStatus}</p><p data-testid="sync-issue">{data.syncIssue}</p>
  <pre className="max-w-full whitespace-pre-wrap break-all" data-testid="records">{JSON.stringify({tasks:data.tasks,medications:data.medications,logs:data.medicationLogs,occurrences:data.eventOccurrences})}</pre>
  <button onClick={()=>{data.addTask({title:'Synthetic offline task',priority:'medium',isRecurring:false,subtasks:[]});}}>Create synthetic task</button>
  <button onClick={()=>{for(let i=0;i<20;i++)data.addTask({title:'Synthetic batch '+i,priority:'medium',isRecurring:false,subtasks:[]});}}>Create batch</button>
  <button onClick={()=>data.tasks.forEach(task=>data.deleteTask(task.id))}>Delete tasks</button>
  <button onClick={()=>{data.logDose('synthetic-med',slot,'taken');data.logDose('synthetic-med',slot,'taken');}}>Confirm dose twice</button>
  <button onClick={()=>data.undoDose('synthetic-med',slot)}>Undo dose</button>
  <button onClick={()=>{data.recordAttendance('synthetic-event-1792756800000','synthetic-event','attended_self_reported','','2026-10-23T12:00:00Z','2026-10-23T13:00:00Z');data.recordAttendance('synthetic-event-1793361600000','synthetic-event','not_attended_self_reported','','2026-10-30T12:00:00Z','2026-10-30T13:00:00Z');}}>Report separate occurrences</button>
  <button onClick={data.retrySync}>Flush edits</button>
  <SettingsView/>
 </>;
}
export function StorageHarness(){
 const [id,setId]=useState('synthetic-a');const backend=useMemo(()=>simulatedBackend(id),[id]);
 return <main className="mx-auto max-w-3xl p-3"><button onClick={()=>setId(id==='synthetic-a'?'synthetic-b':'synthetic-a')}>Switch synthetic account</button>
  <button onClick={()=>{const key='synthetic-remote-'+id;const prior=JSON.parse(sessionStorage.getItem(key)||JSON.stringify({payload:seed(id),revision:1}));sessionStorage.setItem(key,JSON.stringify({...prior,revision:prior.revision+1}));}}>Other device advances revision</button>
  <p data-testid="owner">{id}</p><DayBridgeProvider key={id} userId={id} backend={backend}><Workspace/></DayBridgeProvider></main>;
}
export function LockHarness(){
 const [idle,setIdle]=useState(0);
 return <><button onClick={()=>setIdle(1000)}>Enable synthetic short idle timer</button><button onClick={()=>window.dispatchEvent(new Event('daybridge:lock'))}>Lock test workspace</button>
  <SessionLock userId="synthetic-lock" idleMilliseconds={idle} verify={async password=>password==='synthetic-password'}><label>Unsaved synthetic draft<input aria-label="Unsaved synthetic draft"/></label></SessionLock></>;
}
export function UpdateHarness(){
 const [draft,setDraft]=useState(true);
 useEffect(()=>{document.documentElement.dataset.daybridgeVersion='synthetic-old-release';window.dispatchEvent(new Event('focus'));},[]);
 return <><UpdateMonitor/><p>Update safety harness</p>{draft&&<input aria-label="Synthetic update draft" data-daybridge-draft="true"/>}
  <button onClick={()=>window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:'device_saved'}))}>Set unsynced device state</button>
  <button onClick={()=>window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:'synced'}))}>Set cloud saved state</button>
  <button onClick={()=>setDraft(false)}>Finish synthetic draft</button></>;
}
export function AuthHarness(){
 const [identity,setIdentity]=useState<User|null>(null);
 const backend=useMemo(()=>{
  let callback:((event:string,session:unknown)=>void)|undefined;
  const user={id:'synthetic-auth',email:'synthetic@example.invalid'} as User;
  const auth={getUser:async()=>({data:{user:sessionStorage.getItem('synthetic-auth-valid')==='yes'?user:null},error:null}),getSession:async()=>({data:{session:sessionStorage.getItem('synthetic-auth-valid')==='yes'?{user,expires_at:sessionStorage.getItem('synthetic-auth-expired')==='yes'?1:Date.now()/1000+300}:null}}),onAuthStateChange(fn:typeof callback){callback=fn;return {data:{subscription:{unsubscribe(){callback=undefined;}}}};},async signInWithPassword({password}:{password:string}){if(password!=='synthetic-password')return {data:{user:null},error:{message:'Synthetic denial'}};sessionStorage.setItem('synthetic-auth-valid','yes');callback?.('SIGNED_IN',{user});return {data:{user},error:null};}};
  return {auth} as unknown as SupabaseClient;
 },[]);
 return <SecureAppGate backend={backend}>{id=><><p>Authorized synthetic identity: {id}</p><button onClick={()=>setIdentity({id} as User)}>Observe identity</button><p>{identity?.id}</p></>}</SecureAppGate>;
}
