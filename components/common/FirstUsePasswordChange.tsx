'use client';
import React,{useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

export function FirstUsePasswordChange({client}:{client:SupabaseClient}){
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(password.length<12||password!==confirm){
      setMessage('Choose a matching password with at least 12 characters.');return;
    }
    setBusy(true);setMessage('');
    try{
      // The authenticated server performs password rotation and only then clears
      // the one-time onboarding flag. No other endpoint can skip this check.
      const response=await fetch('/api/account/complete-onboarding',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password})
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not finish account setup');
      setPassword('');setConfirm('');
      const {error:refreshError}=await client.auth.refreshSession();
      if(refreshError)throw new Error('Password saved. Please sign out and sign in again.');
    }catch(e){setMessage(e instanceof Error?e.message:'Account setup unavailable');}
    finally{setBusy(false);}
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
    <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-extrabold text-slate-950">Set your private password</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">This is your first DayBridge sign-in or a court-initiated password reset. Your case manager will not know the new password.</p>
      <form onSubmit={e=>void submit(e)} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">New password
          <input required className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/>
        </label>
        <label className="block text-sm font-semibold">Confirm password
          <input required className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3" type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        </label>
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-teal-800 px-4 py-3 font-bold text-white disabled:opacity-60">{busy?'Saving…':'Save new password'}</button>
      </form>
      {message&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    </section>
  </main>;
}
