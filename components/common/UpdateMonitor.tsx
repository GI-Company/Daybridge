'use client';

import React,{useCallback,useEffect,useRef,useState} from 'react';
import {RefreshCw,ShieldAlert,X} from 'lucide-react';

type SyncState='synced'|'syncing'|'offline'|'local_only'|'device_saved'|null;
function deployedVersion(){
 return document.documentElement.dataset.daybridgeVersion || '';
}
function isEditable(target:EventTarget|null){
 if(!(target instanceof HTMLElement))return false;
 return Boolean(target.closest('input:not([type="hidden"]), textarea, select, [contenteditable="true"]'));
}

/**
 * Detects changed production deployments without putting private data in a
 * persistent browser cache. Never refreshes while a user may be editing data.
 */
export function UpdateMonitor(){
 const [version,setVersion]=useState<string|null>(null);
 const [dirty,setDirty]=useState(false);
 const [sync,setSync]=useState<SyncState>(null);
 const [confirm,setConfirm]=useState(false);
 const [lastError,setLastError]=useState('');
 const running=useRef(false);
 const mounted=useRef(true);
 const syncRef=useRef<SyncState>(null);
 const dirtyRef=useRef(false);

 const check=useCallback(async()=>{
  if(running.current || document.visibilityState==='hidden' || !navigator.onLine)return;
  const current=deployedVersion();
  if(!current || current==='development')return;
  running.current=true;
  try{
   const response=await fetch('/api/version',{method:'GET',cache:'no-store',headers:{'Accept':'application/json','Cache-Control':'no-cache'}});
   if(!response.ok)return;
   const body=await response.json() as {version?:unknown};
   if(typeof body.version==='string' && body.version.length>0 && body.version!=='development' && body.version!==current && mounted.current){
    setVersion(body.version);
   }
  }catch{
   // Network and offline errors are retried on the next foreground check.
  }finally{running.current=false;}
 },[]);

 useEffect(()=>{
  mounted.current=true;
  const onEdit=(e:Event)=>{if(isEditable(e.target)){dirtyRef.current=true;setDirty(true);}};
  const onSync=(e:Event)=>{
   const state=(e as CustomEvent<SyncState>).detail;
   syncRef.current=state;setSync(state);
  };
  const foreground=()=>{if(document.visibilityState==='visible')void check();};
  const onFocus=()=>void check();
  const onBeforeUnload=(event:BeforeUnloadEvent)=>{
    if(document.querySelector('[data-daybridge-draft="true"]')){
      event.preventDefault();event.returnValue='';
    }
  };
  window.addEventListener('beforeunload',onBeforeUnload);
  const interval=window.setInterval(()=>void check(),5*60*1000);
  document.addEventListener('input',onEdit,true);
  document.addEventListener('change',onEdit,true);
  window.addEventListener('daybridge:sync-state',onSync);
  window.addEventListener('focus',onFocus);
  window.addEventListener('online',onFocus);
  document.addEventListener('visibilitychange',foreground);
  void check();
  return()=>{
   mounted.current=false;window.clearInterval(interval);
   window.removeEventListener('beforeunload',onBeforeUnload);
   document.removeEventListener('input',onEdit,true);
   document.removeEventListener('change',onEdit,true);
   window.removeEventListener('daybridge:sync-state',onSync);
   window.removeEventListener('focus',onFocus);
   window.removeEventListener('online',onFocus);
   document.removeEventListener('visibilitychange',foreground);
  };
 },[check]);

 const canReload=()=>{
  // Never offer a bypass when cloud data isn't confirmed or a modal draft is open.
  if(syncRef.current!=='synced'){
   window.dispatchEvent(new Event('daybridge:save-now'));
   setLastError('Update paused until your private records are saved to Supabase. Keep DayBridge open, then retry.');
   return false;
  }
  if(document.querySelector('[data-daybridge-draft="true"]')){
   setLastError('Finish saving or close the open form before updating. Unsubmitted form entries would otherwise be lost.');
   return false;
  }
  return true;
 };
 const beginUpdate=()=>{
  if(!canReload())return;
  setLastError('');
  // Edits may have occurred in a non-modal form. Re-check form focus before reload.
  if(dirtyRef.current && isEditable(document.activeElement)){setConfirm(true);return;}
  window.location.reload();
 };
 const proceed=()=>{
  if(!canReload())return;
  // A confirmation never overrides an unsaved cloud write.
  window.location.reload();
 };
 if(!version)return null;
 return <div className="fixed inset-x-3 bottom-4 z-[110] mx-auto max-w-xl" role="region" aria-label="DayBridge update available">
   <div className="rounded-2xl border border-teal-300 bg-white p-4 shadow-2xl">
    <div className="flex items-start gap-3">
     <span className="rounded-xl bg-teal-50 p-2 text-teal-800"><RefreshCw className="h-5 w-5"/></span>
     <div className="min-w-0 flex-1">
      <p className="font-bold text-slate-950">DayBridge update available</p>
      <p className="mt-1 text-sm text-slate-700">A new production release is ready. You won't need to reinstall the app.</p>
      {(sync!=='synced')&&<p className="mt-2 flex gap-2 text-xs text-amber-800"><ShieldAlert className="h-4 w-4 shrink-0"/>Update waits for cloud sync. Offline changes are encrypted on this device and won't be discarded.</p>}
      {lastError&&<p role="alert" className="mt-2 text-xs text-rose-800">{lastError}</p>}
     </div>
     <button aria-label="Dismiss update reminder" type="button" onClick={()=>{setVersion(null);setConfirm(false)}} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="h-4 w-4"/></button>
    </div>
    {confirm?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alertdialog" aria-label="Confirm app update">
      <strong>Check your unsaved changes first.</strong>
      <p className="mt-1">You've edited fields in this session. Save your work before updating; a reload discards unfinished form entries.</p>
      <div className="mt-3 flex flex-wrap gap-2">
       <button type="button" onClick={()=>setConfirm(false)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Keep working</button>
       <button type="button" onClick={proceed} disabled={sync!=='synced'} className="rounded-lg bg-amber-900 px-3 py-2 font-semibold text-white disabled:opacity-50">Update after review</button>
      </div>
     </div>:<div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {dirty&&<span className="mr-auto text-xs text-amber-800">Form edits detected</span>}
      <button type="button" onClick={beginUpdate} disabled={sync!=='synced'} className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50">Update now</button>
     </div>}
   </div>
  </div>;
}
