'use client';

import React,{useState} from 'react';
import {useDayBridge} from '../../lib/storage/store';
import {parseDollarsToCents} from '../../lib/budget';
import type {AccountType} from '../../lib/types';

/** A user-owned manual account: never connects to a bank or invents an opening balance. */
export function AddBudgetAccount({onCreated,onCancel}:{onCreated?:(id:string)=>void;onCancel?:()=>void}){
 const {addAccount,accounts}=useDayBridge();
 const [name,setName]=useState('');
 const [accountType,setAccountType]=useState<AccountType>('checking');
 const [balance,setBalance]=useState('0.00');
 const [error,setError]=useState('');
 function submit(e:React.FormEvent){
  e.preventDefault();
  const label=name.trim();
  const clean=balance.trim();
  if(!label){setError('Name your account, for example Cash or Checking.');return}
  if(accounts.some(a=>a.name.toLowerCase()===label.toLowerCase())){setError('That account name already exists.');return}
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(clean)){
   setError('Enter a valid opening balance, such as 0 or 125.50.');return;
  }
  const cents=parseDollarsToCents(clean);
  if(!Number.isSafeInteger(cents)||Math.abs(cents)>100000000000){
   setError('That amount is too large.');return;
  }
  const id=addAccount({name:label,accountType,balanceCents:cents});
  setName('');setBalance('0.00');setError('');
  onCreated?.(id);
 }
 return <form data-daybridge-draft="true" onSubmit={submit} className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-4" aria-label="Add manual money account">
  <h4 className="font-bold text-slate-950">Add your first money account</h4>
  <p className="text-xs text-slate-700">Name where you keep your money. You don't need to connect a bank. Start at $0 if you don't know your balance yet.</p>
  <label className="block text-sm font-medium text-slate-800">Account name
   <input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Checking, Cash, Pay card" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3"/>
  </label>
  <label className="block text-sm font-medium text-slate-800">Account type
   <select value={accountType} onChange={e=>setAccountType(e.target.value as AccountType)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3">
    <option value="checking">Checking / pay card</option>
    <option value="cash">Cash</option>
    <option value="savings">Savings</option>
    <option value="prepaid">Prepaid card</option>
   </select>
  </label>
  <label className="block text-sm font-medium text-slate-800">Current balance ($)
   <input required inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="0.00" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3"/>
  </label>
  {error&&<p role="alert" className="text-sm text-rose-900">{error}</p>}
  <div className="flex flex-wrap gap-2">
   <button type="submit" className="min-h-[44px] rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white">Save account</button>
   {onCancel&&<button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800">Cancel</button>}
  </div>
 </form>;
}
