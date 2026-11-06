'use client';
import {useState} from 'react';
import type {OwnerDirectory,OwnerCourt} from '../../lib/admin/owner-types';
import {field,primary,secondary} from './PortalPanels';
import {StaffAuditHistory} from './StaffAuditHistory';
type Staff=OwnerDirectory['staff'][number];
export function OwnerCourtStaff({court,staff,username,setUsername,role,setRole,alias,busy,onCreate,onAssign,onReset,onRevoke,onRestore}:{
 court:OwnerCourt;staff:Staff[];username:string;setUsername:(value:string)=>void;role:string;setRole:(value:string)=>void;alias:string|null;busy:boolean;
 onCreate:()=>void;onAssign:()=>void;onReset:(staff:Staff)=>void;onRevoke:(staff:Staff)=>void;onRestore:(staff:Staff)=>void;
}){
 const [mode,setMode]=useState<'create'|'link'>('create');
 const [auditStaff,setAuditStaff]=useState<Staff|null>(null);
 return <section className="border-t border-slate-200 pt-4" aria-label="Court staff accounts">
  <h3 className="font-bold">Staff accounts for {court.court_name}</h3>
  <p className="mt-2 text-sm leading-6 text-slate-600">Add multiple staff members to this court. Each person gets their own login and audit trail. Staff accounts do not use participant seats.</p>
  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Staff account setup mode"><button type="button" disabled={busy} aria-pressed={mode==='create'} className={mode==='create'?primary:secondary} onClick={()=>setMode('create')}>New staff login</button><button type="button" disabled={busy} aria-pressed={mode==='link'} className={mode==='link'?primary:secondary} onClick={()=>setMode('link')}>Link existing login</button></div>
  <p className="mt-3 text-xs leading-5 text-slate-500">{mode==='create'?'Create a login and assign its court role together. A generated temporary password is shown once; staff must replace it before managing participants.':'Use this for a confirmed staff identity already created in Supabase. The exact sign-in address must match this court. Participant and owner identities cannot be linked.'}</p>
  <form className="mt-3 space-y-3" onSubmit={event=>{event.preventDefault();if(mode==='create')onCreate();else onAssign();}}>
   <label className="block text-sm font-semibold">Staff username<input className={field} disabled={busy} required minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]{2,31}" autoCapitalize="none" autoComplete="off" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
   <label className="block text-sm font-semibold">Required staff sign-in<input className={field+' bg-slate-50'} readOnly value={alias||''}/></label>
   <label className="block text-sm font-semibold">Staff role<select className={field} disabled={busy} value={role} onChange={e=>setRole(e.target.value)}><option value="case_manager">Case manager</option><option value="coordinator">Coordinator</option></select></label>
   <button disabled={busy||!alias} className={primary}>{mode==='create'?'Create staff account':'Assign verified staff'}</button>
  </form>
  <h4 className="mt-6 text-sm font-semibold">Staff access history</h4><p className="mt-2 text-xs leading-5 text-slate-500">For employment changes, revoke court access. This blocks further court operations and retains the login, assignment history and audit events. It does not erase data already viewed or copied.</p>
  <ul className="mt-3 space-y-3">{staff.map(s=><li key={s.user_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-sm font-semibold">{s.username||'Unavailable staff sign-in'}</p><span className={'rounded-full px-2 py-1 text-xs font-semibold '+(s.active?'bg-teal-50 text-teal-900':'bg-slate-100 text-slate-600')}>{s.active?'Active access':'Revoked access'}</span></div><p className="mt-1 text-xs text-slate-500">{s.role==='coordinator'?'Coordinator':'Case manager'}{s.active&&s.password_change_required?' · Password change required':''}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} type="button" className={secondary} onClick={()=>setAuditStaff(s)}>View audit history for {s.username}</button>{s.active?<><button type="button" disabled={busy} className={secondary} onClick={()=>onReset(s)}>Reset password for {s.username}</button><button type="button" disabled={busy} className={secondary+' border-red-200 text-red-800'} onClick={()=>onRevoke(s)}>Revoke access for {s.username}</button></>:<button type="button" disabled={busy||!s.username} className={secondary} onClick={()=>onRestore(s)}>Restore access for {s.username}</button>}</div></li>)}</ul>
  {auditStaff&&<StaffAuditHistory key={auditStaff.user_id+String(staff.find(s=>s.user_id===auditStaff.user_id)?.active)} courtId={court.id} userId={auditStaff.user_id} username={auditStaff.username||'staff'} onClose={()=>setAuditStaff(null)}/>}
  {!staff.length&&<p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No staff yet. Create the first staff login above.</p>}
 </section>;
}
