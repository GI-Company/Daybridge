'use client';
import React,{useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {Fingerprint,KeyRound,ShieldCheck} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';

export function SecureAppGate({children}:{children:(id:string)=>React.ReactNode}){
 const client=useMemo(()=>createClient(),[]);
 const [user,setUser]=useState<User|null>(null);
 const [pending,setPending]=useState(true);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
   if(!client){setPending(false);return}
   let active=true;
   client.auth.getUser().then(({data,error})=>{if(active){setUser(error?null:data.user);setPending(false)}});
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);setPending(false)}});
   return()=>{active=false;subscription.unsubscribe()};
 },[client]);
 if(!client)return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-5"><section className="max-w-md rounded-2xl border border-amber-300 bg-white p-6"><h1 className="font-bold text-slate-900">Private backend not configured</h1><p className="mt-2 text-sm text-slate-700">Configure the public Supabase project URL and publishable key in Vercel. No personal records are available until sign-in is configured.</p></section></main>;
 if(pending)return <main role="status" className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">Checking your private session…</main>;
 if(user)return <>{children(user.id)}</>;
 const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');const {error}=await client.auth.signInWithPassword({email,password});if(error)setMessage('Could not sign in. Check your invited account credentials.');setPassword('');setBusy(false)};
 const passkey=async()=>{setBusy(true);setMessage('');try{const {error}=await client.auth.signInWithPasskey();if(error)setMessage('Passkey sign-in is unavailable. Use your account password instead.')}catch{setMessage('This browser or project does not support passkeys yet.')}finally{setBusy(false)}};
 return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-5">
 <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
  <div className="inline-flex rounded-xl bg-teal-50 p-3 text-teal-800"><ShieldCheck className="h-7 w-7"/></div>
  <h1 className="mt-4 text-2xl font-bold text-slate-950">Unlock DayBridge</h1>
  <p className="mt-2 text-sm leading-6 text-slate-700">This private workspace requires your approved account. You can stay signed in on your device, then use a passkey for convenient access.</p>
  <form onSubmit={login} className="mt-6 space-y-4">
   <label className="block text-sm font-semibold text-slate-800">Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"/></label>
   <label className="block text-sm font-semibold text-slate-800">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"/></label>
   <button disabled={busy} type="submit" className="w-full rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"><KeyRound className="mr-2 inline h-4 w-4"/>Sign in</button>
  </form>
  <button disabled={busy} type="button" onClick={passkey} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"><Fingerprint className="mr-2 inline h-5 w-5"/>Use device passkey</button>
  {message&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
  <p className="mt-5 text-xs text-slate-600">There is no public sign-up. Passkeys must first be enabled in Supabase and registered in app settings.</p>
 </section></main>;
}
