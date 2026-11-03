'use client';
import React,{useEffect,useMemo,useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {loginIdentifierToEmail} from '../../lib/auth/username';

type Court={id:string;state_code:string;state_name:string;circuit_name:string};
export function AdminPortalEntry(){
  const client=useMemo(()=>createClient(),[]);
  const [courts,setCourts]=useState<Court[]>([]);
  const [stateCode,setStateCode]=useState('');
  const [courtId,setCourtId]=useState('');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let mounted=true;
    void fetch('/api/admin/courts',{cache:'no-store'}).then(async r=>{
      const body=await r.json();if(!r.ok)throw Error(body.error||'Directory unavailable');
      if(!mounted)return;
      const list=(body.courts||[]) as Court[];
      setCourts(list);
      if(list.length){setStateCode(list[0].state_code);setCourtId(list[0].id);}
      else setMessage('Court administration enrollment is not yet open.');
    }).catch(()=>{if(mounted)setMessage('Court administration is not yet configured.');});
    return()=>{mounted=false};
  },[]);
  const states=Array.from(new Map(courts.map(c=>[c.state_code,c.state_name])).entries());
  const circuits=courts.filter(c=>c.state_code===stateCode);
  const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100';
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!client||!courtId){setMessage('Choose an activated judicial circuit.');return;}
    const email=loginIdentifierToEmail(username);
    if(!email){setMessage('Enter a valid staff username or email.');return;}
    setBusy(true);setMessage('');
    try{
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error){setMessage('Username or password not recognized.');return;}
      window.location.assign('/admin?court_id='+encodeURIComponent(courtId));
    }catch{setMessage('Sign-in unavailable. Please retry.');}
    finally{setPassword('');setBusy(false);}
  };
  return <form onSubmit={e=>void submit(e)} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <label className="text-left text-xs font-semibold text-slate-700">State
      <select className={field} value={stateCode} onChange={e=>{
        const value=e.target.value;setStateCode(value);setCourtId(courts.find(c=>c.state_code===value)?.id||'');
      }} disabled={!states.length}>
        {!states.length&&<option value="">Not configured</option>}
        {states.map(([code,name])=><option key={code} value={code}>{name}</option>)}
      </select>
    </label>
    <label className="text-left text-xs font-semibold text-slate-700">Judicial circuit
      <select className={field} value={courtId} onChange={e=>setCourtId(e.target.value)} disabled={!circuits.length}>
        {!circuits.length&&<option value="">Not configured</option>}
        {circuits.map(c=><option key={c.id} value={c.id}>{c.circuit_name}</option>)}
      </select>
    </label>
    <label className="text-left text-xs font-semibold text-slate-700">Staff username or email
      <input className={field} autoComplete="username" autoCapitalize="none" required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Staff account"/>
    </label>
    <label className="text-left text-xs font-semibold text-slate-700">Password
      <input className={field} autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/>
    </label>
    <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={busy||!courtId||!client} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-50"><LockKeyhole className="h-4 w-4"/>Court staff sign in</button>
      <a href="/admin" className="text-sm font-semibold text-teal-900 underline-offset-4 hover:underline">Open full admin portal</a>
      <span className="text-xs text-slate-600">Staff MFA is verified before any account-management access.</span>
    </div>
    {message&&<p role="status" className="text-left text-xs text-amber-800 sm:col-span-2 lg:col-span-4">{message}</p>}
  </form>;
}
