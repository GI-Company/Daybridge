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
 const reg=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('DayBridge background services are not ready. Update or reopen the app and retry.')),12000))]);
 let existing=await reg.pushManager.getSubscription();
 const expected=new Uint8Array(toBytes(vapid));
 const current=existing?.options.applicationServerKey;
 if(existing&&current&&!expected.every((byte,index)=>byte===new Uint8Array(current)[index])){await existing.unsubscribe();existing=null;}
 const subscription=existing??await reg.pushManager.subscribe({
  userVisibleOnly:true,applicationServerKey:toBytes(vapid)
 });
 const json=subscription.toJSON();
 if(!json.keys?.p256dh||!json.keys.auth)throw Error('The browser did not return valid Web Push credentials.');
 await saveSubscription(subscription);
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

async function saveSubscription(subscription:PushSubscription){
 const response=await fetch('/api/notifications/device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON()),cache:'no-store'});
 if(!response.ok)throw Error('Notifications are allowed, but this device could not connect. Retry when signed in and online.');
 window.dispatchEvent(new Event('daybridge:push-updated'));
}
/** Repair an existing permission/subscription without showing permission prompts. */
export async function reconnectDevicePush(){
 if(!pushAvailable()||Notification.permission!=='granted')return;
 const registration=await navigator.serviceWorker.getRegistration();
 const subscription=await registration?.pushManager.getSubscription();
 if(subscription)await saveSubscription(subscription);
}
export async function sendDevicePushTest(){
 const registration=await navigator.serviceWorker.getRegistration();
 const subscription=await registration?.pushManager.getSubscription();
 if(!subscription)throw Error('Enable notifications on this device first.');
 const response=await fetch('/api/travel/push-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint}),cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'The notification test failed.');
 return result.sent as number;
}
export async function disableDevicePush(){
 const registration=await navigator.serviceWorker.getRegistration();
 const subscription=await registration?.pushManager.getSubscription();if(!subscription)return;
 const response=await fetch('/api/notifications/device',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
 if(!response.ok)throw Error('Could not disconnect this device. Retry when connected.');
 if(!await subscription.unsubscribe())throw Error('The browser could not remove this subscription. Retry before signing out.');
 window.dispatchEvent(new Event('daybridge:push-updated'));
}
