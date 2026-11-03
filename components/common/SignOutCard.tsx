'use client';

import React,{useState} from 'react';
import {LogOut,ShieldAlert} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import {createClient} from '../../lib/supabase/client';
import {signOutBlockReason} from '../../lib/auth/sign-out';

/** A local session sign-out; cloud and encrypted device records are retained. */
export function SignOutCard(){
 const {syncStatus,retrySync}=useDayBridge();
 const [confirming,setConfirming]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const canProceed=()=>{
  const draftOpen=Boolean(document.querySelector('[data-daybridge-draft="true"]'));
  const reason=signOutBlockReason(syncStatus,draftOpen);
  if(!reason)return true;
  setError(reason);
  setConfirming(false);
  if(syncStatus!=='synced')retrySync();
  return false;
 };
 const begin=()=>{
  setError('');
  if(canProceed())setConfirming(true);
 };
 const finish=async()=>{
  setError('');
  if(!canProceed())return;
  const client=createClient();
  if(!client){setError('Authentication is unavailable. Reconnect and try again.');return;}
  setBusy(true);
  try{
   // 'local' signs out this device only; other signed-in devices keep working.
   const {error:signOutError}=await client.auth.signOut({scope:'local'});
   if(signOutError)throw signOutError;
   // Recreate a clean browser session so no private in-memory state remains.
   window.location.replace('/');
  }catch{
   setError('Sign out could not be completed. Your session may still be active; check your connection and try again.');
   setConfirming(false);
   setBusy(false);
  }
 };
 return <section aria-labelledby="daybridge-session-heading" className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
   <h3 id="daybridge-session-heading" className="font-bold text-slate-950">Account &amp; session</h3>
   <p className="text-sm text-slate-700">Sign out of DayBridge on this device. Your cloud records and encrypted local copy are not deleted. Other devices stay signed in.</p>
   {!confirming?<button type="button" onClick={begin} disabled={busy}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50">
     <LogOut className="h-4 w-4" aria-hidden="true"/>Sign out
   </button>:<div role="group" aria-label="Confirm sign out" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="flex items-start gap-2 text-sm text-amber-950"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>You will need your username and password to open DayBridge again on this device.</p>
      <div className="flex flex-wrap gap-2">
       <button type="button" onClick={()=>{setConfirming(false);setError('');}} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Cancel</button>
       <button type="button" onClick={()=>void finish()} disabled={busy} className="min-h-11 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Signing out…':'Confirm sign out'}</button>
      </div>
    </div>}
   {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
   {syncStatus!=='synced'&&<p className="text-xs text-amber-900">Current save status: {syncStatus.replaceAll('_',' ')}. Finish cloud sync before signing out.</p>}
  </section>;
}
