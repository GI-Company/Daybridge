'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {field,panel,primary} from './PortalPanels';
export function StaffPasswordChange({courtId,onComplete}:{courtId:string;onComplete:()=>void}){
 const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;
  if(password.length<12||password!==confirm||current===password){setMessage('Choose a different password with at least 12 characters and matching confirmation.');return;}
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/staff-password',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({court_id:courtId,current_password:current,password})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not change your staff password');
   if(mounted.current)onComplete();
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'Password setup unavailable');}
  finally{if(mounted.current){setCurrent('');setPassword('');setConfirm('');setBusy(false);}}
 }
 return <section className={panel+' mt-5 max-w-lg p-6'} aria-label="Staff password setup"><h2 className="text-xl font-semibold">Set your private staff password</h2><p className="mt-3 text-sm leading-6 text-slate-600">Your login is new or the owner reset it. Enter the temporary password they gave you, then choose your own. Court accounts and actions stay unavailable until this is complete.</p><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Current temporary password<input className={field} type="password" autoComplete="current-password" required maxLength={256} value={current} onChange={e=>setCurrent(e.target.value)}/></label><label className="block text-sm font-semibold">New staff password<input className={field} type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block text-sm font-semibold">Confirm new staff password<input className={field} type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className={primary} disabled={busy}>{busy?'Saving…':'Save staff password'}</button></form>{message&&<p role="alert" className="mt-3 text-sm text-amber-950">{message}</p>}</section>;
}
