'use client';

import {createClient} from '../supabase/client';

export type PushReadiness='ready'|'not_granted'|'denied'|'unsupported'|'not_subscribed'|'server_unavailable';

function toBytes(value:string):ArrayBuffer{
 const base=value.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(base.padEnd(Math.ceil(base.length/4)*4,'='));
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 return bytes.buffer;
}

export function pushAvailable():boolean{
 return typeof window!=='undefined' && window.isSecureContext &&
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Only a user click may invoke permission requests or create a subscription. */
export async function enableDevicePush():Promise<void>{
 if(!pushAvailable())throw Error('This installed browser does not support Web Push.');
 // Permission request must be the first asynchronous operation following the tap.
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')throw Error(permission==='denied'
   ?'Notifications are blocked for DayBridge. Enable them in your device or browser site settings.'
   :'Notifications were not enabled. You can retry when ready.');
 const vapid=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 if(!vapid)throw Error('The remote notification service is not configured.');
 const db=createClient();
 if(!db)throw Error('Account connection is unavailable.');
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)throw Error('Sign in to set up background alerts.');
 const reg=await navigator.serviceWorker.ready;
 const existing=await reg.pushManager.getSubscription();
 const subscription=existing??await reg.pushManager.subscribe({
  userVisibleOnly:true,applicationServerKey:toBytes(vapid)
 });
 const json=subscription.toJSON();
 if(!json.keys?.p256dh||!json.keys.auth)throw Error('The browser did not return valid Web Push credentials.');
 const {error}=await db.from('push_subscriptions').upsert({
  user_id:user.id,endpoint:subscription.endpoint,keys_p256dh:json.keys.p256dh,
  keys_auth:json.keys.auth,user_agent:navigator.userAgent,
  disabled_at:null,last_failure_at:null,updated_at:new Date().toISOString()
 },{onConflict:'user_id,endpoint'});
 if(error)throw Error('Notifications are allowed, but the push subscription could not be saved. Try again when online.');
}

export async function getPushReadiness():Promise<PushReadiness>{
 if(!pushAvailable())return 'unsupported';
 if(Notification.permission==='denied')return 'denied';
 if(Notification.permission!=='granted')return 'not_granted';
 if(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)return 'server_unavailable';
 try{
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration)return 'not_subscribed';
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription)return 'not_subscribed';
  const db=createClient();if(!db)return 'server_unavailable';
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return 'server_unavailable';
  const {data,error}=await db.from('push_subscriptions')
   .select('disabled_at').eq('user_id',user.id)
   .eq('endpoint',subscription.endpoint).maybeSingle();
  if(error)return 'server_unavailable';
  return data&&!data.disabled_at?'ready':'not_subscribed';
 }catch{return 'server_unavailable';}
}
