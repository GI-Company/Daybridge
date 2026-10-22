'use client';
import React,{useState} from 'react';
import {BellRing, Fingerprint, LogOut, ShieldCheck} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';

function toBytes(value:string){
 const base=value.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(base.padEnd(Math.ceil(base.length/4)*4,'='));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
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
   if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setMessage('Web Push is not supported here. Install DayBridge using your home screen and use a compatible browser.');return}
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){setMessage('Notifications not enabled. You can change this in the device settings.');return}
   const reg=await navigator.serviceWorker.ready;
   await reg.showNotification('DayBridge reminders',{body:'Notifications are ready on this device.',icon:'/icon.svg',tag:'daybridge-test'});
   const vapid=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
   if(!vapid){setMessage('Device notifications work, but scheduled remote push still needs a VAPID key and delivery worker.');return}
   const existing=await reg.pushManager.getSubscription();
   const subscription=existing??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(vapid).buffer as ArrayBuffer});
   const user=await client?.auth.getUser();
   if(!client||!user?.data.user){setMessage('Please sign in before enabling remote reminders.');return}
   const json=subscription.toJSON();
   const {error}=await client.from('push_subscriptions').upsert({
     user_id:user.data.user.id,endpoint:subscription.endpoint,
     keys_p256dh:json.keys?.p256dh??'',keys_auth:json.keys?.auth??'',
     user_agent:navigator.userAgent,updated_at:new Date().toISOString()
   },{onConflict:'user_id,endpoint'});
   setMessage(error?'Notification permission granted, but server subscription could not be saved.':'Device subscribed for scheduled notifications. Delivery still depends on the reminder worker.');
  }catch{setMessage('Unable to set up notifications. Check app installation, browser support and system settings.')}
  finally{setBusy(false)}
 };
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4" aria-labelledby="device-heading">
  <div className="flex items-center gap-2 text-teal-800"><ShieldCheck className="h-5 w-5"/><h3 id="device-heading" className="font-bold text-slate-900">Device access & security</h3></div>
  <p className="text-sm leading-6 text-slate-700">These are optional, permission-based capabilities. DayBridge never requests your camera, location, photos, or contact list for basic use.</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <button type="button" disabled={busy} onClick={enroll} className="flex items-center justify-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 font-semibold text-teal-950 hover:bg-teal-100 disabled:opacity-50"><Fingerprint className="h-5 w-5"/>Register device passkey</button>
   <button type="button" disabled={busy} onClick={subscribe} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"><BellRing className="h-5 w-5"/>Enable notifications</button>
  </div>
  <button type="button" onClick={async()=>{await client?.auth.signOut()}} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><LogOut className="h-4 w-4"/>Sign out of this device</button>
  {message&&<p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-800">{message}</p>}
 </section>;
}
