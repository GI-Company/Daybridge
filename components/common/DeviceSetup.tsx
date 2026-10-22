'use client';
import React,{useState} from 'react';
import {BellRing, Fingerprint, LogOut, ShieldCheck} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {enableDevicePush} from '../../lib/notifications/device-push';

export function DeviceSetup(){
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const client=createClient();
 const enroll=async()=>{
  if(!client)return;
  setBusy(true);setMessage('');
  try{const {error}=await client.auth.registerPasskey();setMessage(error?'Passkey enrollment could not be completed. Enable WebAuthn in the Supabase dashboard first.':'Passkey enrolled successfully. You can now use device biometric/PIN sign-in.')}
  catch{setMessage('Passkeys are not available on this device or domain.')}
  finally{setBusy(false)}
 };
 const subscribe=async()=>{
  setBusy(true);setMessage('');
  try{
   await enableDevicePush();
   setMessage('This device is registered to receive DayBridge background reminders.');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Could not enable remote push notifications.');
  }finally{setBusy(false);}
 };
 const testRemote=async()=>{
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/travel/push-test',{method:'POST'});const data=await r.json();setMessage(r.ok?'Push sent to '+data.sent+' registered device(s).':'Push test unavailable: '+(data.error??'Check server configuration.'))}
  catch{setMessage('Remote Web Push test failed.')}finally{setBusy(false)}
 };
 const stopPush=async()=>{
  setBusy(true);setMessage('');
  try{
   const registration=await navigator.serviceWorker.ready;
   const sub=await registration.pushManager.getSubscription();
   if(sub){const user=await client?.auth.getUser();await sub.unsubscribe();if(user?.data.user&&client)await client.from('push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('user_id',user.data.user.id).eq('endpoint',sub.endpoint)}
   setMessage('This device was unsubscribed from Web Push.');
  }catch{setMessage('Could not unsubscribe. Check notification settings.')}finally{setBusy(false)}
 };
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4" aria-labelledby="device-heading">
  <div className="flex items-center gap-2 text-teal-800"><ShieldCheck className="h-5 w-5"/><h3 id="device-heading" className="font-bold text-slate-900">Device access & security</h3></div>
  <p className="text-sm leading-6 text-slate-700">These are optional, permission-based capabilities. DayBridge never requests your camera, location, photos, or contact list for basic use.</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <button type="button" disabled={busy} onClick={enroll} className="flex items-center justify-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 font-semibold text-teal-950 hover:bg-teal-100 disabled:opacity-50"><Fingerprint className="h-5 w-5"/>Register device passkey</button>
   <button type="button" disabled={busy} onClick={subscribe} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"><BellRing className="h-5 w-5"/>Enable notifications</button>
  </div>
  <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void testRemote()} className="rounded-xl border border-teal-400 px-4 py-2 text-sm font-semibold text-teal-900">Send real push test</button><button type="button" disabled={busy} onClick={()=>void stopPush()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Disable push on this device</button></div>
  <button type="button" onClick={async()=>{await client?.auth.signOut()}} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><LogOut className="h-4 w-4"/>Sign out of this device</button>
  {message&&<p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-800">{message}</p>}
 </section>;
}
