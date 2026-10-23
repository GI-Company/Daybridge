'use client';
import {useCallback,useEffect,useState} from 'react';
import {parseNotificationDestination,notificationURL,type NotificationDestination} from './destination';
export function useNotificationNavigation(userId:string){
 const [currentTab,setCurrentTab]=useState('today');
 const [target,setTarget]=useState<(NotificationDestination&{revision:number})|null>(null);
 const [notice,setNotice]=useState('');
 const navigate=useCallback((tab:string)=>{
  setCurrentTab(tab);setTarget(null);setNotice('');
  const url=new URL(window.location.href);url.search='';url.searchParams.set('tab',tab);
  window.history.pushState(null,'',url.pathname+url.search);
 },[]);
 useEffect(()=>{
  const open=(raw:string,updateURL=false)=>{
   const destination=parseNotificationDestination(raw,window.location.origin);if(!destination)return;
   if(destination.account&&destination.account!==userId){setNotice('This notification belongs to another DayBridge account. Sign in to that account to open it.');return;}
   setNotice('');setCurrentTab(destination.tab);setTarget(previous=>({...destination,revision:(previous?.revision||0)+1}));
   if(updateURL)window.history.pushState(null,'',notificationURL(destination));
  };
  const receive=(event:MessageEvent)=>{
   if(event.origin&&event.origin!==window.location.origin)return;
   if(['DAYBRIDGE_NOTIFICATION','DAYBRIDGE_TRAVEL_NOTIFICATION'].includes(event.data?.type)&&typeof event.data?.url==='string'){open(event.data.url,true);event.ports?.[0]?.postMessage({handled:true});}
  };
  const onPop=()=>open(window.location.href);
  navigator.serviceWorker?.addEventListener('message',receive);window.addEventListener('popstate',onPop);
  open(window.location.href);
  return()=>{navigator.serviceWorker?.removeEventListener('message',receive);window.removeEventListener('popstate',onPop);};
 },[userId]);
 return {currentTab,navigate,target,notice};
}
