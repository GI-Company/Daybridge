'use client';
import {useState} from 'react';
import {readDeviceRecoveries} from '../../lib/storage/device-cache';
export function SyncRecovery({userId}:{userId:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function exportCopies(){
  if(!window.confirm('Recovery copies contain unencrypted private information when downloaded. Save this file somewhere private.'))return;
  setBusy(true);setMessage('');
  try{const copies=await readDeviceRecoveries(userId);if(!copies.length){setMessage('No conflicting device copies have needed recovery on this device.');return;}
   const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),userId,recoveries:copies},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='daybridge-private-device-recovery.json';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),10000);setMessage('Encrypted device copies were exported privately. Your live records were not changed.');
  }catch{setMessage('Device recovery copies could not be opened. They were not cleared.');}finally{setBusy(false);}
 }
 return <div className="space-y-2"><button type="button" disabled={busy} onClick={()=>void exportCopies()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">{busy?'Opening recovery copies…':'Export device sync recovery copies'}</button><p className="text-xs leading-5 text-slate-600">When two devices change the same field, the device version is kept encrypted here before you choose which values to keep.</p>{message&&<p role="status" className="text-sm text-slate-700">{message}</p>}</div>;
}
