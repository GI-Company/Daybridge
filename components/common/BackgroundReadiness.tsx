'use client';

import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {BellRing,CheckCircle2,HardDrive,MapPin,ShieldCheck,X} from 'lucide-react';
import {isDurableStorage,requestDurableStorage} from '../../lib/storage/device-cache';
import {enableDevicePush,sendDevicePushTest,getPushReadiness,type PushReadiness} from '../../lib/notifications/device-push';

type SetupState={push:PushReadiness|'checking';storage:boolean|null};
const initial:SetupState={push:'checking',storage:null};
const userNotice=(push:SetupState['push'])=>{
 switch(push){
 case 'denied':return 'Notifications are blocked. Use your device’s notification settings or your browser’s DayBridge site settings to allow notifications, then tap Recheck.';
 case 'unsupported':return 'This browser cannot register background Web Push. Try an installed, supported browser app.';
 case 'server_unavailable':return 'The notification service cannot be verified. Check your connection and retry.';
 case 'not_subscribed':return 'Notifications are allowed, but this device has not registered for remote alerts.';
 default:return 'Enable device notifications to receive server-generated appointment and traffic reminders while DayBridge is closed.';
 }
};

/** Notification and storage setup. Foreground GPS is managed automatically by the workspace. */
export function BackgroundReadiness({userId,suppressed=false}:{userId:string;suppressed?:boolean}){
 const key=useMemo(()=>{
  const version=typeof document!=='undefined'?document.documentElement.dataset.daybridgeVersion||'v1':'v1';
  return 'daybridge-background-ready-'+userId+'-'+version;
 },[userId]);
 const [state,setState]=useState<SetupState>(initial);
 const [loaded,setLoaded]=useState(false);
 const [dismissed,setDismissed]=useState(true);
 const [manualOpen,setManualOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const refresh=useCallback(async()=>{
  const [push,storage]=await Promise.all([getPushReadiness(),isDurableStorage().catch(()=>false)]);
  setState({push,storage});
  setLoaded(true);
 },[userId]);
 useEffect(()=>{
  try{setDismissed(localStorage.getItem(key)==='dismissed');}catch{setDismissed(false)}
  void refresh();
  const onReturn=()=>{if(document.visibilityState==='visible')void refresh()};
  const onChanged=()=>void refresh();
  document.addEventListener('visibilitychange',onReturn);
  window.addEventListener('focus',onChanged);
  window.addEventListener('daybridge:travel-prefs-updated',onChanged);
  window.addEventListener('daybridge:push-updated',onChanged);
  const reopen=()=>{setManualOpen(true);setDismissed(false);void refresh();};
  window.addEventListener('daybridge:open-background-setup',reopen);
  return()=>{
   document.removeEventListener('visibilitychange',onReturn);
   window.removeEventListener('focus',onChanged);
   window.removeEventListener('daybridge:travel-prefs-updated',onChanged);
   window.removeEventListener('daybridge:push-updated',onChanged);
   window.removeEventListener('daybridge:open-background-setup',reopen);
  };
 },[key,refresh]);
 function dismiss(){
  setManualOpen(false);
  try{localStorage.setItem(key,'dismissed')}catch{}
  setDismissed(true);
 }
 async function pushClick(){
  setBusy(true);setMessage('');
  try{
   await enableDevicePush();
   await sendDevicePushTest();
   setMessage('This device is connected. The push service accepted a test; check that it arrives and tap it to open notification settings.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not register background notifications.')}
  finally{await refresh();setBusy(false);}
 }
 async function protectStorage(){
  setBusy(true);setMessage('');
  try{
   const granted=await requestDurableStorage();
   setMessage(granted?'Persistent storage enabled.':'Persistent storage was not granted. Encrypted local saving and cloud sync still work.');
  }catch{setMessage('Could not request persistent storage.');}
  finally{await refresh();setBusy(false)}
 }
 const needsPush=state.push!=='ready';
 if(!loaded||(!manualOpen&&(suppressed||dismissed||!needsPush)))return null;
 return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3" role="presentation">
  <section role="dialog" aria-modal="true" aria-label="DayBridge background alert setup"
   className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-teal-200 bg-white p-5 shadow-2xl sm:p-6">
   <div className="flex items-start gap-3">
    <div className="rounded-xl bg-teal-50 p-2 text-teal-900"><ShieldCheck className="h-6 w-6"/></div>
    <div className="flex-1">
     <h2 className="text-xl font-bold text-slate-950">Keep DayBridge working when closed</h2>
     <p className="mt-1 text-sm text-slate-700">Appointment reminders continue when closed. Open a reminder to refresh GPS and get current travel timing.</p>
    </div>
    <button type="button" onClick={dismiss} aria-label="Remind me later"
     className="min-h-11 min-w-11 rounded-lg border border-slate-200 p-2 text-slate-700"><X className="mx-auto h-5 w-5"/></button>
   </div>

   <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
     {needsPush?<BellRing className="h-5 w-5 text-amber-800"/>:<CheckCircle2 className="h-5 w-5 text-emerald-800"/>}
     1. Background notifications {needsPush?'— needs attention':'— ready'}
    </div>
    {!needsPush&&<p role="status" className="text-xs text-teal-800">Background push is registered. This panel remains available so you can review device storage, location limits and notification setup.</p>}
    {needsPush&&<>
     <p className="text-xs leading-5 text-slate-700">{userNotice(state.push)}</p>
     {state.push!=='denied'&&state.push!=='unsupported'&&<button disabled={busy} type="button"
      onClick={()=>void pushClick()} className="min-h-11 w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
      {state.push==='not_granted'?'Allow notifications':'Connect background alerts'}
     </button>}
    </>}
   </div>

   <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
    <p className="flex items-center gap-2 text-sm font-bold text-slate-950"><MapPin className="h-5 w-5 text-teal-800"/>Automatic current location</p>
    <p className="mt-2">Location starts automatically after permission. Live departure timing uses fresh GPS from this device while DayBridge is open. A saved starting point is optional for planning forecasts in Travel settings.</p>
   </div>

   <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
     <HardDrive className="h-5 w-5 text-slate-700"/>
     2. Offline data protection {state.storage?'— enabled':'— optional'}
    </div>
    {!state.storage&&<button disabled={busy} type="button" onClick={()=>void protectStorage()}
     className="mt-2 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50">
     Protect encrypted device storage
    </button>}
    <p className="mt-2 text-xs text-slate-600">Cloud sync and encrypted local records remain available regardless of this browser storage permission.</p>
   </div>
   {message&&<p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{message}</p>}
   <div className="flex flex-wrap items-center justify-between gap-2">
    <button disabled={busy} type="button" onClick={()=>void refresh()}
     className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Recheck setup</button>
    <button type="button" onClick={dismiss} className="min-h-11 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white">
     {needsPush?'Remind me later':'Done'}
    </button>
   </div>
  </section>
 </div>;
}
