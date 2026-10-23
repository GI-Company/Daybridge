'use client';
import {useEffect} from 'react';
import {reconnectDevicePush} from '../../lib/notifications/device-push';
/** Existing granted registrations reconnect on sign-in/online; no permission request or GPS. */
export function NotificationConnection(){
 useEffect(()=>{
  const reconnect=()=>{void reconnectDevicePush().catch(()=>undefined);};
  reconnect();window.addEventListener('online',reconnect);
  return()=>window.removeEventListener('online',reconnect);
 },[]);
 return null;
}
