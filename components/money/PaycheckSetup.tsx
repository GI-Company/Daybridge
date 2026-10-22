'use client';
import React,{useState} from 'react';
import {useDayBridge} from '../../lib/storage/store';
import {parseDollarsToCents} from '../../lib/budget';
import type {PayFrequency} from '../../lib/types';

export function PaycheckSetup({onSaved,onCancel}:{onSaved:()=>void;onCancel?:()=>void}){
 const {paycheckPlan,setPaycheckForecast}=useDayBridge();
 const [amount,setAmount]=useState(paycheckPlan?(paycheckPlan.expectedNetCents/100).toFixed(2):'');
 const [date,setDate]=useState(paycheckPlan?.nextPayday||'');
 const [frequency,setFrequency]=useState<PayFrequency>(paycheckPlan?.recurringFrequency||'weekly');
 const [error,setError]=useState('');
 function save(e:React.FormEvent){
  e.preventDefault();
  const cents=parseDollarsToCents(amount);
  if(!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())||cents<=0||!Number.isSafeInteger(cents)){
    setError('Enter the expected take-home amount, such as 750.00.');return;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T12:00:00').getTime())){
    setError('Select the date you expect your next paycheck.');return;
  }
  setPaycheckForecast({expectedNetCents:cents,nextPayday:date,recurringFrequency:frequency,confidence:'medium'});
  onSaved();
 }
 return <form data-daybridge-draft="true" onSubmit={save} className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
  <h4 className="font-semibold text-slate-950">Plan your next payday</h4>
  <p className="text-xs text-slate-700">Planning only: this does not add money to your balance. Record the deposit when it actually arrives.</p>
  <label className="block text-sm text-slate-800">Expected take-home pay ($)
   <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}
    placeholder="Enter your estimate" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3"/>
  </label>
  <label className="block text-sm text-slate-800">Next payday
   <input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3"/>
  </label>
  <label className="block text-sm text-slate-800">How often are you paid?
   <select value={frequency} onChange={e=>setFrequency(e.target.value as PayFrequency)}
    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3">
    <option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option>
    <option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option>
   </select>
  </label>
  {error&&<p role="alert" className="text-sm text-rose-900">{error}</p>}
  <div className="flex gap-2">
   <button className="min-h-[44px] rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white" type="submit">Save payday</button>
   {onCancel&&<button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">Cancel</button>}
  </div>
 </form>;
}
