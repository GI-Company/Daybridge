'use client';
import React,{useEffect,useMemo,useState} from 'react';
import type {User,Session,AuthChangeEvent,SupabaseClient} from '@supabase/supabase-js';
import {Fingerprint,KeyRound,ShieldCheck} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {SessionLock} from './SessionLock';
import {DeviceLockSettings} from './DeviceLockSettings';
import {loginIdentifierToEmail} from '../../lib/auth/username';

export function SecureAppGate({children,backend}:{children:(id:string)=>React.ReactNode;backend?:SupabaseClient|null}){
 const client=useMemo(()=>backend===undefined?createClient():backend,[backend]);
 const [user,setUser]=useState<User|null>(null);
 const [pending,setPending]=useState(true);
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [passkeyAvailable,setPasskeyAvailable]=useState(false);
 useEffect(()=>{
   let active=true;
   if(!client||!user){setPasskeyAvailable(false);return;}
   void client.auth.passkey.list().then(({data,error})=>{
     if(active)setPasskeyAvailable(!error&&Array.isArray(data)&&data.length>0);
   }).catch(()=>{if(active)setPasskeyAvailable(false);});
   return()=>{active=false;};
 },[client,user?.id]);
 useEffect(()=>{
   if(!client){setPending(false);return}
   let active=true;
   const offlineUser=async():Promise<User|null>=>{
     // A cached, not-yet-expired Supabase session only unlocks this device's
     // encrypted offline snapshot. Cloud operations still require a valid JWT.
     if(navigator.onLine)return null;
     try{
       const {data}=await client.auth.getSession();
       const session=data.session;
       return session?.expires_at&&session.expires_at>Date.now()/1000 ? session.user:null;
     }catch{return null}
   };
   if(!navigator.onLine){
     void offlineUser().then(user=>{if(active){setUser(user);setPending(false)}});
   }else{
     void client.auth.getUser().then(async(result: {data:{user:User|null};error:unknown})=>{
       const user=result.error?await offlineUser():result.data.user;
       if(active){setUser(user);setPending(false)}
     }).catch(async()=>{
       const user=await offlineUser();
       if(active){setUser(user);setPending(false)}
     });
   }
   const {data:{subscription}}=client.auth.onAuthStateChange((_event:AuthChangeEvent,session:Session|null)=>{if(active){setUser(session?.user??null);setPending(false)}});
   return()=>{active=false;subscription.unsubscribe()};
 },[client]);
 if(!client)return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-5"><section className="max-w-md rounded-2xl border border-amber-300 bg-white p-6"><h1 className="font-bold text-slate-900">Private backend not configured</h1><p className="mt-2 text-sm text-slate-700">Configure the public Supabase project URL and publishable key in Vercel. No personal records are available until sign-in is configured.</p></section></main>;
 if(pending)return <main role="status" className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">Checking your private session…</main>;
 if(user)return <DeviceLockSettings key={user.id} userId={user.id}>{idleMilliseconds=><SessionLock key={user.id} idleMilliseconds={idleMilliseconds} userId={user.id} verify={async password=>{
  if(!user.email)return false;
  const {data,error}=await client.auth.signInWithPassword({email:user.email,password});
  return !error&&data.user?.id===user.id;
 }} verifyPasskey={passkeyAvailable?async()=>{
  const {data,error}=await client.auth.signInWithPasskey();
  return !error&&data.user?.id===user.id;
 }:undefined}>{children(user.id)}</SessionLock>}</DeviceLockSettings>;
 const login=async(e:React.FormEvent)=>{
  e.preventDefault();
  const email=loginIdentifierToEmail(username);
  if(!email){setMessage('Enter your assigned username or the email used for an existing Supabase account.');return;}
  setBusy(true);setMessage('');
  try{
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error)setMessage('Username or password not recognized. Contact the DayBridge administrator if you need help.');
  }catch{
    setMessage('Sign-in is temporarily unavailable. Try again later.');
  }finally{
    setPassword('');setBusy(false);
  }
 };
 const passkey=async()=>{setBusy(true);setMessage('');try{const {error}=await client.auth.signInWithPasskey();if(error)setMessage('Passkey sign-in is unavailable. Use your account password instead.')}catch{setMessage('This browser or project does not support passkeys yet.')}finally{setBusy(false)}};
 return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-5">
 <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
  <div className="inline-flex rounded-xl bg-teal-50 p-3 text-teal-800"><ShieldCheck className="h-7 w-7"/></div>
  <h1 className="mt-4 text-2xl font-bold text-slate-950">Unlock DayBridge</h1>
  <p className="mt-2 text-sm leading-6 text-slate-700">Sign in with your assigned username and password. If your account was originally created using a regular email address in Supabase, you can also sign in with that email. Only approved accounts can access this workspace.</p>
  <form onSubmit={login} className="mt-6 space-y-4">
   <label className="block text-sm font-semibold text-slate-800">Username or email<input required type="text" autoCapitalize="none" spellCheck={false} maxLength={254} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"/></label>
   <label className="block text-sm font-semibold text-slate-800">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"/></label>
   <button disabled={busy} type="submit" className="w-full rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"><KeyRound className="mr-2 inline h-4 w-4"/>Sign in</button>
  </form>
  <button disabled={busy} type="button" onClick={passkey} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"><Fingerprint className="mr-2 inline h-5 w-5"/>Use device passkey</button>
  {message&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
  <p className="mt-5 text-xs text-slate-600">Accounts are created by the administrator in Supabase. There is no public sign-up or email-based password recovery for username accounts. You can change your password in Settings.</p>
 </section></main>;
}
