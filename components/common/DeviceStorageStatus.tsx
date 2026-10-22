'use client';
import React,{useEffect,useState} from 'react';
import {HardDrive} from 'lucide-react';
import {isDurableStorage,requestDurableStorage} from '../../lib/storage/device-cache';
import {useDayBridge} from '../../lib/storage/store';
export function DeviceStorageStatus(){
 const {syncStatus,retrySync,syncIssue}=useDayBridge();
 const [persistent,setPersistent]=useState<boolean|null>(null);
 const [message,setMessage]=useState('');
 useEffect(()=>{void isDurableStorage().then(setPersistent)},[]);
 async function request(){
  const granted=await requestDurableStorage();
  setPersistent(granted);
  setMessage(granted?'This browser granted persistent storage.':'This browser did not grant persistent storage. The encrypted cache still works but may be cleared under storage pressure.');
 }
 return <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><HardDrive className="h-4 w-4"/>Encrypted records on this device</h4>
  <p className="text-xs leading-5 text-slate-700">Saved entries are encrypted locally before being uploaded. They will sync with Supabase when this app is online and authenticated. No user data is placed in the service worker cache. This encryption does not replace your device screen lock and is not protected by a separate passphrase.</p>
  <p role="status" className="text-sm font-semibold text-slate-800">
   {syncStatus==='synced'?'Cloud synced and device copy saved':
    syncStatus==='device_saved'?'Stored on device — waiting to sync':
    syncStatus==='syncing'?'Saving changes…':
    'Storage needs attention'}
  </p>
  <p className="text-xs text-slate-700">{persistent===true?'Persistent browser storage enabled.':persistent===false?'Storage may be evicted by the browser.':'Checking persistent storage…'}</p>
  {syncIssue&&<p className="text-xs text-rose-800" role="alert">{syncIssue}</p>}
  <div className="flex flex-wrap gap-2">
   <button type="button" onClick={()=>void request()} className="rounded-lg border border-teal-400 px-3 py-2 text-xs font-semibold text-teal-900">Protect device storage</button>
   <button type="button" onClick={retrySync} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white">Sync now</button>
  </div>
  {message&&<p className="text-xs text-slate-700">{message}</p>}
  <p className="text-xs text-amber-900">Clearing site data, uninstalling the PWA, changing browsers, or using private browsing can remove unsynced local changes. For critical records, keep cloud sync enabled and export secure backups periodically.</p>
 </section>;
}
