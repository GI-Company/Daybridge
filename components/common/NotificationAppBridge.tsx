'use client';
import {useEffect} from 'react';
/** Identify the installed app before sign-in finishes, so a gated browser tab cannot steal a notification tap. */
export function NotificationAppBridge(){
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.data?.type!=='DAYBRIDGE_CLIENT_STATUS')return;
   const installed=window.matchMedia('(display-mode: standalone)').matches||
    (navigator as Navigator&{standalone?:boolean}).standalone===true;
   event.ports?.[0]?.postMessage({installed});
  };
  navigator.serviceWorker?.addEventListener('message',receive);
  return()=>navigator.serviceWorker?.removeEventListener('message',receive);
 },[]);
 return null;
}
