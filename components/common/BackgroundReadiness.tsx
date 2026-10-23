'use client';

import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {BellRing,CheckCircle2,HardDrive,MapPin,ShieldCheck,X} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {isDurableStorage,requestDurableStorage} from '../../lib/storage/device-cache';
import {enableDevicePush,sendDevicePushTest,getPushReadiness,type PushReadiness} from '../../lib/notifications/device-push';
import {defaults,type TravelPrefs} from '../../lib/travel/types';

type OriginStatus='ready'|'missing'|'disabled'|'unknown';
type AddressMatch={label:string;lat:number;lon:number};
type SetupState={push:PushReadiness|'checking';origin:OriginStatus;storage:boolean|null};
const initial:SetupState={push:'checking',origin:'unknown',storage:null};
const userNotice=(push:SetupState['push'])=>{
 switch(push){
 case 'denied':return 'Notifications are blocked. Use your device’s notification settings or your browser’s DayBridge site settings to allow notifications, then tap Recheck.';
 case 'unsupported':return 'This browser cannot register background Web Push. Try an installed, supported browser app.';
 case 'server_unavailable':return 'The notification service cannot be verified. Check your connection and retry.';
 case 'not_subscribed':return 'Notifications are allowed, but this device has not registered for remote alerts.';
 default:return 'Enable device notifications to receive server-generated appointment and traffic reminders while DayBridge is closed.';
 }
};

/** First-run and post-update setup; never asks for GPS or push without a user tap. */
export function BackgroundReadiness({userId,suppressed=false}:{userId:string;suppressed?:boolean}){
 const key=useMemo(()=>{
  const version=typeof document!=='undefined'?document.documentElement.dataset.daybridgeVersion||'v1':'v1';
  return 'daybridge-background-ready-'+userId+'-'+version;
 },[userId]);
 const [state,setState]=useState<SetupState>(initial);
 const [loaded,setLoaded]=useState(false);
 const [dismissed,setDismissed]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [address,setAddress]=useState('');
 const [matches,setMatches]=useState<AddressMatch[]>([]);
 const [showAddress,setShowAddress]=useState(false);
 const refresh=useCallback(async()=>{
  const db=createClient();
  const [push,storage,prefs]=await Promise.all([
   getPushReadiness(),
   isDurableStorage().catch(()=>false),
   db?db.from('travel_preferences').select('saved_origin_lat,saved_origin_lon,traffic_notifications')
    .eq('user_id',userId).maybeSingle():Promise.resolve({data:null,error:true})
  ]);
  const origin:OriginStatus=prefs.error?'unknown':
   prefs.data?.saved_origin_lat!=null&&prefs.data?.saved_origin_lon!=null
    ?prefs.data.traffic_notifications?'ready':'disabled':'missing';
  setState({push,origin,storage});
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
  const reopen=()=>{setDismissed(false);void refresh();};
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
 async function approveOrigin(point:AddressMatch){
  const db=createClient();
  if(!db){setMessage('Cloud connection is unavailable.');return}
  setBusy(true);setMessage('');
  try{
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||user?.id!==userId)throw Error('Sign in again before approving a starting location.');
   const {data:existing,error:readError}=await db.from('travel_preferences')
    .select('*').eq('user_id',userId).maybeSingle();
   if(readError)throw Error('Could not read travel preferences. Try again when online.');
   // The explicit approval enables background traffic checks, but never enables GPS tracking.
   const {error}=await db.from('travel_preferences').upsert({
    ...defaults,...(existing||{}),user_id:userId,origin_kind:'saved',
    saved_origin_label:point.label,saved_origin_lat:point.lat,saved_origin_lon:point.lon,
    traffic_notifications:true,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw Error('Could not save your approved starting location.');
   setMessage('Starting point approved. Background traffic checks can now use this saved location.');
   setShowAddress(false);setMatches([]);
   window.dispatchEvent(new Event('daybridge:travel-prefs-updated'));
  }catch(error){setMessage(error instanceof Error?error.message:'Location approval failed.')}
  finally{await refresh();setBusy(false);}
 }
 function saveCurrentOrigin(){
  if(!navigator.geolocation){setMessage('GPS is unavailable. Enter a starting address instead.');return;}
  setBusy(true);setMessage('Requesting location for this one-time starting-point approval…');
  navigator.geolocation.getCurrentPosition(
   position=>void approveOrigin({
    label:'Approved starting location',
    lat:position.coords.latitude,lon:position.coords.longitude
   }),
   ()=>{setBusy(false);setMessage('GPS permission is unavailable or declined. You can enter a starting address instead.');},
   {enableHighAccuracy:false,timeout:12000,maximumAge:60000}
  );
 }
 async function searchOrigin(){
  if(address.trim().length<6)return;
  setBusy(true);setMessage('');setMatches([]);
  try{
   const response=await fetch('/api/travel/geocode',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({address:address.trim()})});
   if(!response.ok)throw Error();
   const data=await response.json() as {results?:AddressMatch[]};
   const options=(data.results||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
   setMatches(options);
   if(!options.length)setMessage('No address match found. Enter a street, city, and state.');
  }catch{setMessage('Address lookup unavailable. Try again later.');}
  finally{setBusy(false);}
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
 const needsOrigin=state.origin!=='ready';
 if(suppressed||!loaded||dismissed||(!needsPush&&!needsOrigin))return null;
 return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3" role="presentation">
  <section role="dialog" aria-modal="true" aria-label="DayBridge background alert setup"
   className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-teal-200 bg-white p-5 shadow-2xl sm:p-6">
   <div className="flex items-start gap-3">
    <div className="rounded-xl bg-teal-50 p-2 text-teal-900"><ShieldCheck className="h-6 w-6"/></div>
    <div className="flex-1">
     <h2 className="text-xl font-bold text-slate-950">Keep DayBridge working when closed</h2>
     <p className="mt-1 text-sm text-slate-700">Set up background reminders once. DayBridge checks appointment traffic on its server, not by continuously tracking your phone.</p>
    </div>
    <button type="button" onClick={dismiss} aria-label="Remind me later"
     className="min-h-11 min-w-11 rounded-lg border border-slate-200 p-2 text-slate-700"><X className="mx-auto h-5 w-5"/></button>
   </div>

   <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
     {needsPush?<BellRing className="h-5 w-5 text-amber-800"/>:<CheckCircle2 className="h-5 w-5 text-emerald-800"/>}
     1. Background notifications {needsPush?'— needs attention':'— ready'}
    </div>
    {needsPush&&<>
     <p className="text-xs leading-5 text-slate-700">{userNotice(state.push)}</p>
     {state.push!=='denied'&&state.push!=='unsupported'&&<button disabled={busy} type="button"
      onClick={()=>void pushClick()} className="min-h-11 w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
      {state.push==='not_granted'?'Allow notifications':'Connect background alerts'}
     </button>}
    </>}
   </div>

   <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
     {needsOrigin?<MapPin className="h-5 w-5 text-amber-800"/>:<CheckCircle2 className="h-5 w-5 text-emerald-800"/>}
     2. Appointment starting point {needsOrigin?'— needs attention':'— ready'}
    </div>
    {needsOrigin&&<>
     <p className="text-xs leading-5 text-slate-700">
      {state.origin==='disabled'?'Traffic reminders are disabled in your travel preferences. Approving a starting point below will also enable them.':
       'Approve one default starting point for closed-app route estimates. You can change it anytime, and DayBridge will not track your background GPS.'}
     </p>
     <button disabled={busy} type="button" onClick={saveCurrentOrigin}
      className="min-h-11 w-full rounded-xl border border-teal-300 bg-white px-3 py-3 text-sm font-semibold text-teal-900 disabled:opacity-50">
      Use this location as my approved starting point
     </button>
     <button disabled={busy} type="button" onClick={()=>setShowAddress(v=>!v)}
      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50">
      Enter a starting address instead
     </button>
     {showAddress&&<div className="space-y-2 pt-2">
      <label className="block text-sm font-medium text-slate-800">Starting address
       <input value={address} onChange={e=>{setAddress(e.target.value);setMatches([]);}}
        placeholder="Street, city, state" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"/>
      </label>
      <button type="button" disabled={busy||address.trim().length<6} onClick={()=>void searchOrigin()}
       className="min-h-11 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Find address</button>
      {matches.map((p,i)=><button type="button" key={i} disabled={busy} onClick={()=>void approveOrigin(p)}
       className="block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-left text-sm text-slate-800 disabled:opacity-50">
       Approve {p.label}
      </button>)}
     </div>}
    </>}
   </div>

   <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
     <HardDrive className="h-5 w-5 text-slate-700"/>
     3. Offline data protection {state.storage?'— enabled':'— optional'}
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
     {needsOrigin||needsPush?'Remind me later':'Done'}
    </button>
   </div>
  </section>
 </div>;
}
