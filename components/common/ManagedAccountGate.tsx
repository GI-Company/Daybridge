'use client';
import React,{useCallback,useEffect,useState} from 'react';
import {BillingButton,GatedAccountControls} from './BillingControls';
type Access={allowed:boolean;reason?:string;hasBilling?:boolean;billingReady?:boolean;billingReview?:boolean};
export function ManagedAccountGate({children,userId}:{children:React.ReactNode;userId:string}){
 const [state,setState]=useState<'checking'|'allowed'|'denied'|'error'>('checking');
 const [access,setAccess]=useState<Access>({allowed:false});
 const check=useCallback(async(reconcile=false)=>{
  try{
   const response=await fetch('/api/account/managed-access',{cache:'no-store',method:reconcile?'POST':'GET'});
   if(!response.ok){setState('error');return;}
   const data=await response.json() as Access;setAccess(data);setState(data.allowed===true?'allowed':'denied');
  }catch{setState('error');}
 },[]);
 useEffect(()=>{
  void check(new URLSearchParams(location.search).get('billing')==='returned');
  const handleVisible=()=>{if(!document.hidden)void check();};
  const interval=setInterval(handleVisible,30000);
  window.addEventListener('focus',handleVisible);document.addEventListener('visibilitychange',handleVisible);
  return()=>{clearInterval(interval);window.removeEventListener('focus',handleVisible);document.removeEventListener('visibilitychange',handleVisible);};
 },[check]);
 if(state==='allowed')return <>{children}</>;
 const personal=access.reason==='subscription_required';
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
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
 </main>;
}
