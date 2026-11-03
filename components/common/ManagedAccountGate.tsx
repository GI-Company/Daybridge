'use client';
import React,{useCallback,useEffect,useState} from 'react';

export function ManagedAccountGate({children}:{children:React.ReactNode}){
  const [state,setState]=useState<'checking'|'allowed'|'denied'|'error'>('checking');
  const check=useCallback(async()=>{
    try{
      const response=await fetch('/api/account/managed-access',{cache:'no-store'});
      if(!response.ok&&response.status!==401&&response.status!==403){
        setState('error');return;
      }
      const data=await response.json();
      setState(data.allowed===true?'allowed':'denied');
    }catch{setState('error');}
  },[]);
  useEffect(()=>{
    void check();
    const handleVisible=()=>{if(!document.hidden)void check();};
    window.addEventListener('focus',handleVisible);
    document.addEventListener('visibilitychange',handleVisible);
    return()=>{window.removeEventListener('focus',handleVisible);document.removeEventListener('visibilitychange',handleVisible);};
  },[check]);
  if(state==='allowed')return <>{children}</>;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7">
      <h1 className="text-xl font-extrabold text-slate-950">{state==='denied'?'DayBridge access is inactive':'Checking your DayBridge access'}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">{state==='denied'
        ? 'This court-sponsored account is not currently active. Contact your court administrator to restore access. Your personal records have not been deleted.'
        : state==='error'?'Could not verify access online. Reconnect and try again.': 'Verifying that your court-sponsored account is active…'}</p>
      {state!=='checking'&&<button className="mt-5 rounded-xl bg-teal-800 px-5 py-3 font-semibold text-white" onClick={()=>{setState('checking');void check();}}>Retry access check</button>}
    </section>
  </main>;
}
