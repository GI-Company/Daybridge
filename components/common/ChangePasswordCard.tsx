'use client';

import React, {useState} from 'react';
import {KeyRound} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';

export function ChangePasswordCard(){
 const [current,setCurrent]=useState('');
 const [next,setNext]=useState('');
 const [confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 const submit=async(event:React.FormEvent)=>{
   event.preventDefault();
   if(next.length<12){setMessage('Use a new password of at least 12 characters.');return;}
   if(next!==confirm){setMessage('New passwords do not match.');return;}
   if(next===current){setMessage('Choose a different password.');return;}
   const client=createClient();
   if(!client){setMessage('Authentication is unavailable.');return;}
   setBusy(true);setMessage('');
   try{
     const {error}=await client.auth.updateUser({password:next,current_password:current});
     if(error)setMessage('Password could not be changed. Confirm your current password and try again.');
     else setMessage('Password updated. Use the new password on other devices.');
   }catch{
     setMessage('Password update unavailable. Try again.');
   }finally{
     setCurrent('');setNext('');setConfirm('');setBusy(false);
   }
 };
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4" aria-labelledby="change-password-heading">
  <h3 id="change-password-heading" className="flex items-center gap-2 font-bold text-slate-900"><KeyRound className="h-5 w-5 text-teal-800"/>Change password</h3>
  <p className="text-sm leading-6 text-slate-700">Username accounts do not have an email recovery inbox. You can change your password while signed in. If you lose access, contact the administrator for an account reset.</p>
  <form onSubmit={submit} className="space-y-3">
    <label className="block text-sm font-semibold text-slate-800">Current password
      <input required type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"/>
    </label>
    <label className="block text-sm font-semibold text-slate-800">New password
      <input required type="password" minLength={12} autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"/>
    </label>
    <label className="block text-sm font-semibold text-slate-800">Confirm new password
      <input required type="password" minLength={12} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"/>
    </label>
    <button type="submit" disabled={busy} className="rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy?'Updating…':'Change password'}</button>
  </form>
  {message&&<p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{message}</p>}
 </section>;
}
