'use client';
import {useEffect,useState} from 'react';
import {BillingButton} from '../common/BillingControls';
export function PersonalBilling(){
 const [access,setAccess]=useState<{reason:string;hasBilling:boolean;accessUntil?:string;cancelAtPeriodEnd?:boolean}|null>(null);
 useEffect(()=>{let active=true;void fetch('/api/account/managed-access',{cache:'no-store'}).then(async response=>{if(response.ok&&active)setAccess(await response.json());}).catch(()=>undefined);return()=>{active=false;};},[]);
 if(!access?.hasBilling)return null;
 return <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-950">Personal subscription</h3><p className="text-sm leading-6 text-slate-700">{access.reason==='active'?'Your court currently sponsors your access. Manage any existing personal subscription below to avoid paying for overlapping access.':'DayBridge Personal costs $3.99 USD per month. Update payment details, view receipts, or cancel at the end of your paid month.'}</p>{access.accessUntil&&<p className="text-sm text-slate-700">{access.cancelAtPeriodEnd?'Access ends':'Paid through'} {new Date(access.accessUntil).toLocaleDateString()}.</p>}<BillingButton portal/></section>;
}
