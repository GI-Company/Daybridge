'use client';
import React,{useEffect,useState} from 'react';
const keyFor=(userId:string)=>'daybridge-auto-lock-v1-'+userId;
function enabled(userId:string){try{return localStorage.getItem(keyFor(userId))==='true';}catch{return false;}}
export function DeviceLockSettings({userId,children}:{userId:string;children:(idleMilliseconds:number)=>React.ReactNode}){
 const [autoLock,setAutoLock]=useState(false);
 useEffect(()=>{const refresh=()=>setAutoLock(enabled(userId));refresh();window.addEventListener('daybridge:lock-setting',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('daybridge:lock-setting',refresh);window.removeEventListener('storage',refresh);};},[userId]);
 return <>{children(autoLock?5*60000:0)}</>;
}
export function AutoLockPreference({userId}:{userId:string}){
 const [autoLock,setAutoLock]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>setAutoLock(enabled(userId)),[userId]);
 return <><label className="flex min-h-11 items-center justify-between gap-3 text-sm text-slate-800">Lock after five minutes of inactivity on this device
  <input type="checkbox" className="h-5 w-5 accent-teal-800" checked={autoLock} onChange={event=>{
   try{localStorage.setItem(keyFor(userId),String(event.target.checked));setAutoLock(event.target.checked);setMessage('');window.dispatchEvent(new Event('daybridge:lock-setting'));}
   catch{setMessage('The device lock preference could not be saved.');}
  }}/></label>{message&&<p role="status" className="text-sm text-rose-800">{message}</p>}</>;
}
