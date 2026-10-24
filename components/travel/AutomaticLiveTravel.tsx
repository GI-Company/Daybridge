'use client';
import {useEffect,useRef} from 'react';
import {useCurrentLocation} from '../../lib/travel/use-current-location';
import {freshLocation} from '../../lib/travel/location-fix';
import {useDayBridge} from '../../lib/storage/store';
/** Shares one foreground location watch across pages. Each device checks its own departure alerts. */
export function AutomaticLiveTravel(){
 const location=useCurrentLocation();const {syncStatus,profile}=useDayBridge();
 const latest=useRef(location.fix);latest.current=location.fix;const hasFix=Boolean(location.fix);
 useEffect(()=>{
  if(syncStatus!=='synced'||!hasFix)return;
  let stopped=false;const controller=new AbortController();
  const check=async()=>{
   const fix=freshLocation(latest.current);
   if(stopped||!navigator.onLine||document.visibilityState!=='visible'||!fix)return;
   try{
    const registration=await navigator.serviceWorker?.getRegistration();
    const subscription=await registration?.pushManager.getSubscription();
    if(!subscription||stopped)return;
    const key='daybridge-live-check-at:'+profile.id;
    const last=Number(sessionStorage.getItem(key)||0);
    if(Date.now()-last<60000)return;
    sessionStorage.setItem(key,String(Date.now()));
    await fetch('/api/travel/live-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint,fix}),signal:controller.signal});
   }catch{/* A subsequent fresh foreground check retries; coordinates are never queued offline. */}
  };
  void check();const timer=setInterval(()=>void check(),60000);
  return()=>{stopped=true;controller.abort();clearInterval(timer);};
 },[hasFix,syncStatus,profile.id]);
 return null;
}
