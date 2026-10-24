'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {LockKeyhole} from 'lucide-react';

type SessionLockProps={userId:string;verify:(password:string)=>Promise<boolean>;children:React.ReactNode;idleMilliseconds?:number};
/** Hide the mounted workspace while locked; its encrypted save queue continues, so drafts are not discarded. */
export function SessionLock({userId,verify,children,idleMilliseconds=0}:SessionLockProps){
 const [locked,setLocked]=useState(true),[ready,setReady]=useState(false),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lastActivity=useRef(Date.now()),lockedRef=useRef(true),channel=useRef<BroadcastChannel|null>(null);
 const storageKey='daybridge-session-lock-'+userId;
 const lock=useCallback(()=>{
  lockedRef.current=true;setLocked(true);setPassword('');setMessage('');
  try{sessionStorage.setItem(storageKey,JSON.stringify({locked:true,at:lastActivity.current}));localStorage.setItem(storageKey,'locked');}catch{}
 },[storageKey]);
 useEffect(()=>{
  let shouldLock=false;
  try{shouldLock=localStorage.getItem(storageKey)==='locked';const stored=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(stored){shouldLock=shouldLock||stored.locked===true||!Number.isFinite(stored.at)||(idleMilliseconds>0&&Date.now()-stored.at>=idleMilliseconds);if(Number.isFinite(stored.at))lastActivity.current=stored.at;}}
  catch{shouldLock=true;}
  lockedRef.current=shouldLock;setLocked(shouldLock);setReady(true);
  const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({locked:lockedRef.current,at:lastActivity.current}));}catch{lock();}};
  let lastWrite=0;
  const activity=()=>{if(lockedRef.current)return;lastActivity.current=Date.now();if(Date.now()-lastWrite>1000){persist();lastWrite=Date.now();}};
  const lockEverywhere=()=>{lock();channel.current?.postMessage({type:'lock'});};
  const check=()=>{if(idleMilliseconds>0&&!lockedRef.current&&Date.now()-lastActivity.current>=idleMilliseconds)lockEverywhere();};
  const visibility=()=>{check();persist();};
  if('BroadcastChannel' in window){channel.current=new BroadcastChannel(storageKey);channel.current.onmessage=event=>{if(event.data?.type==='lock')lock();};}
  const storage=(event:StorageEvent)=>{if(event.key===storageKey&&event.newValue==='locked')lock();};
  window.addEventListener('storage',storage);
  const timer=setInterval(check,1000);
  window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);window.addEventListener('wheel',activity,{passive:true});
  window.addEventListener('daybridge:lock',lockEverywhere);window.addEventListener('pagehide',visibility);document.addEventListener('visibilitychange',visibility);
  persist();
  return()=>{window.removeEventListener('storage',storage);clearInterval(timer);channel.current?.close();channel.current=null;window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('wheel',activity);window.removeEventListener('daybridge:lock',lockEverywhere);window.removeEventListener('pagehide',visibility);document.removeEventListener('visibilitychange',visibility);};
 },[idleMilliseconds,lock,storageKey]);
 const unlock=async(event:React.FormEvent)=>{
  event.preventDefault();setBusy(true);setMessage('');
  try{
   if(!navigator.onLine)throw Error('Connect to the internet to verify your password and unlock.');
   if(!await verify(password))throw Error('Password not recognized. Your records remain locked.');
   lastActivity.current=Date.now();
   sessionStorage.setItem(storageKey,JSON.stringify({locked:false,at:lastActivity.current}));
   localStorage.removeItem(storageKey);
   lockedRef.current=false;setLocked(false);
  }catch(error){setMessage(error instanceof Error?error.message:'Unlock is unavailable. Retry when connected.');}
  finally{setPassword('');setBusy(false);}
 };
 return <>
  <div hidden={!ready||locked} inert={!ready||locked?true:undefined} aria-hidden={!ready||locked?true:undefined}>{children}</div>
  {ready&&locked&&<main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
   <section aria-labelledby="locked-title" className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
    <LockKeyhole className="h-8 w-8 text-teal-800" aria-hidden="true"/>
    <h1 id="locked-title" className="mt-4 text-2xl font-bold text-slate-950">DayBridge locked</h1>
    <p className="mt-2 text-sm leading-6 text-slate-700">Enter your account password to return to your private workspace. Your saved records and open work stay in place.</p>
    <form onSubmit={unlock} className="mt-5 space-y-4">
     <label className="block text-sm font-semibold text-slate-800">Account password<input autoFocus required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"/></label>
     <button disabled={busy} type="submit" className="min-h-11 w-full rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Verifying…':'Unlock'}</button>
    </form>
    {message&&<p role="alert" className="mt-3 text-sm text-rose-800">{message}</p>}
   </section>
  </main>}
 </>;
}
