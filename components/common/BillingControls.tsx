'use client';
import {useState} from 'react';
import {createClient} from '../../lib/supabase/client';
import {readDeviceSnapshot,readDeviceRecoveries} from '../../lib/storage/device-cache';
export function BillingButton({portal=false,disabled=false}:{portal?:boolean;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function open(){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/billing/'+(portal?'portal':'checkout'),{method:'POST'});const data=await response.json();
   if(!response.ok)throw Error(data.error||'Billing is temporarily unavailable.');
   const url=new URL(data.url);if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw Error('Billing address could not be verified.');
   window.location.assign(url.href);
  }catch(error){setMessage(error instanceof Error?error.message:'Could not open billing.');setBusy(false);}
 }
 return <div><button type="button" disabled={busy||disabled} onClick={()=>void open()} className="min-h-11 rounded-xl bg-teal-800 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'Opening secure billing…':portal?'Manage subscription':'Subscribe · $3.99 USD/month'}</button>{message&&<p role="alert" className="mt-2 text-sm text-amber-900">{message}</p>}</div>;
}
/** Works outside the paid workspace and never clears local records. */
export function GatedAccountControls({userId}:{userId:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function exportDevice(){
  if(!window.confirm('This download contains unencrypted private records. Save it somewhere private.'))return;
  try{
   const snapshot=await readDeviceSnapshot(userId),recoveries=await readDeviceRecoveries(userId);
   const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),snapshot,recoveries},null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='daybridge-device-records.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
   setMessage('Device copy exported. Cloud records can be downloaded separately.');
  }catch{setMessage('Could not open this device copy. Nothing was deleted.');}
 }
 async function signOut(){
  if(!window.confirm('Sign out on this device? Cloud records and encrypted device copies will remain.'))return;
  setBusy(true);setMessage('');
  try{const client=createClient();if(!client)throw Error();const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;window.location.replace('/');}
  catch{setMessage('Could not sign out. Check your connection and try again.');setBusy(false);}
 }
 return <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm"><p className="text-slate-600">Your records remain yours. Downloads contain private, unencrypted information.</p><div className="flex flex-wrap gap-3"><a className="underline underline-offset-4" href="/api/account/export" download>Export cloud records</a><button type="button" className="underline underline-offset-4" onClick={()=>void exportDevice()}>Export this device’s records</button><button type="button" disabled={busy} className="underline underline-offset-4" onClick={()=>void signOut()}>{busy?'Signing out…':'Sign out'}</button></div>{message&&<p role="status">{message}</p>}</div>;
}
