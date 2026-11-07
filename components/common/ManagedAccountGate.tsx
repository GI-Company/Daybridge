'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {BillingButton,GatedAccountControls} from './BillingControls';
import {readDeviceAccessUntil,writeDeviceAccessUntil} from '../../lib/storage/device-cache';
import {WorkspaceVisibility} from '../../lib/workspace-visibility';
const OFFLINE_ACCESS_MS=24*60*60*1000;
type Access={allowed:boolean;reason?:string;hasBilling?:boolean;billingReady?:boolean;billingReview?:boolean};
export function ManagedAccountGate(props:{children:React.ReactNode;userId:string}){
 return <AccountAccess key={props.userId} {...props}/>;
}
function AccountAccess({children,userId}:{children:React.ReactNode;userId:string}){
 const [state,setState]=useState<'checking'|'allowed'|'denied'|'error'>('checking');
 const [access,setAccess]=useState<Access>({allowed:false});
 const [mounted,setMounted]=useState(false),[warning,setWarning]=useState(false);
 const expires=useRef(0),denied=useRef(false),sequence=useRef(0),active=useRef(false);
 const grantWrites=useRef(Promise.resolve());
 const check=useCallback(async(reconcile=false)=>{
  const request=++sequence.current;
  try{
   const response=await fetch('/api/account/managed-access',{cache:'no-store',method:reconcile?'POST':'GET',signal:AbortSignal.timeout(10000)});
   if(!response.ok&&response.status!==401&&response.status!==403)throw Error('Access check unavailable');
   const data:Access=response.status===401||response.status===403?{allowed:false,reason:'session_expired'}:await response.json() as Access;
   if(typeof data.allowed!=='boolean')throw Error('Invalid access response');
   if(!active.current||request!==sequence.current)return;
   denied.current=!data.allowed;expires.current=data.allowed?Date.now()+OFFLINE_ACCESS_MS:0;
   setAccess(data);setWarning(false);setState(data.allowed?'allowed':'denied');
   if(data.allowed)setMounted(true);
   // A confirmed denial overwrites the prior grant, including offline reopening.
   const until=expires.current;
   try{if(data.allowed)localStorage.removeItem('daybridge-access-denied:'+userId);else localStorage.setItem('daybridge-access-denied:'+userId,'true');}catch{}
   grantWrites.current=grantWrites.current.catch(()=>undefined).then(()=>writeDeviceAccessUntil(userId,until));
   await grantWrites.current.catch(()=>undefined);
  }catch{
   if(!active.current||request!==sequence.current)return;
   if(!denied.current&&expires.current>Date.now()){setState('allowed');setMounted(true);setWarning(true);}
   else if(!denied.current)setState('error');
  }
 },[userId]);
 useEffect(()=>{
  active.current=true;
  void (async()=>{
   {
    const until=await readDeviceAccessUntil(userId).catch(()=>0);
    if(!active.current)return;
    let revoked=false;try{revoked=localStorage.getItem('daybridge-access-denied:'+userId)==='true';}catch{revoked=true;}
    if(!revoked&&until>Date.now()&&until<=Date.now()+OFFLINE_ACCESS_MS){expires.current=until;if(!navigator.onLine){setMounted(true);setState('allowed');setWarning(true);}}
   }
   if(active.current)void check(new URLSearchParams(location.search).get('billing')==='returned');
  })();
  const handleVisible=()=>{if(!document.hidden)void check();};
  const interval=setInterval(handleVisible,30000);
  window.addEventListener('focus',handleVisible);window.addEventListener('online',handleVisible);document.addEventListener('visibilitychange',handleVisible);
  return()=>{active.current=false;sequence.current++;clearInterval(interval);window.removeEventListener('focus',handleVisible);window.removeEventListener('online',handleVisible);document.removeEventListener('visibilitychange',handleVisible);};
 },[check,userId]);
 const visible=state==='allowed';
 const workspace=mounted?<div hidden={!visible} inert={!visible?true:undefined} aria-hidden={!visible?true:undefined}><WorkspaceVisibility.Provider value={visible}>{warning&&<p role="status" className="bg-amber-50 p-3 text-sm text-amber-950">Access could not be refreshed. Your work stays open on this device for up to 24 hours after the last successful check. Reconnect to verify access.</p>}{children}</WorkspaceVisibility.Provider></div>:null;
 const personal=access.reason==='subscription_required';
 return <>{workspace}{!visible&&<main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
  <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
   <p className="text-sm font-bold uppercase tracking-widest text-teal-800">DayBridge Personal</p>
   <h1 className="mt-3 text-2xl font-extrabold text-slate-950">{state==='denied'?personal?'Keep your routine going':'Court access is inactive':'Checking your DayBridge access'}</h1>
   <p className="mt-3 text-sm leading-6 text-slate-700">{state==='denied'?personal
    ? 'Your court sponsorship has ended. Keep using your existing account and records with DayBridge Personal for $3.99 USD per month. It renews monthly until cancelled. Cancel in billing settings for the end of your paid month. No payment is taken until you confirm in Stripe.'
    : 'Contact your court administrator to restore access. Your personal records have not been deleted.'
    : state==='error'?'Could not verify access online. Reconnect and try again.':'Verifying your account access…'}</p>
   {state==='denied'&&personal&&<div className="mt-5 space-y-3">{!access.billingReview&&<BillingButton disabled={!access.billingReady}/>}<p className="text-xs text-slate-600">{access.billingReview?'A payment needs review. Manage your subscription or contact DayBridge support.':access.billingReady?'Secure checkout and receipts are handled by Stripe.':'Subscriptions are being connected. Your records remain safely stored.'}</p></div>}
   {access.hasBilling&&<div className="mt-3"><BillingButton portal/></div>}
   {state!=='checking'&&<button type="button" className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" onClick={()=>void check(personal)}>Check access again</button>}
   <GatedAccountControls userId={userId}/>
  </section>
 </main>}</>;
}
