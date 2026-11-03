'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,CheckCircle2,ChevronDown,ChevronRight,MoreHorizontal,CircleAlert,LoaderCircle,Copy,Eye,EyeOff,Info,KeyRound,LockKeyhole,Plus,RefreshCw,Search,ShieldCheck,SquareArrowOutUpRight,Trash2,UserRound,Users,Pause,Armchair} from 'lucide-react';
import {usernameToAuthEmail} from '../../lib/auth/username';
import type {CourtAccount,PortalData} from '../../lib/admin/portal-types';
export const panel='rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_#123c4506]';
export const field='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 sm:min-h-10 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100';
export const primary='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-700 bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-800 active:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10';
export const secondary='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9';
export const destructive='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50 sm:min-h-10';
export type AccountAction='suspend'|'restore'|'remove'|'reset';
export type Credentials={username:string;temporaryPassword:string;kind:'created'|'reset'};
export function PortalFeedback({tone='success',title,children}:{tone?:'success'|'error'|'loading';title:string;children?:React.ReactNode}){
 const Icon=tone==='error'?CircleAlert:tone==='loading'?LoaderCircle:CheckCircle2;
 return <div role={tone==='error'?'alert':'status'} className={'flex items-start gap-3 rounded-xl border p-3 text-sm '+(tone==='error'?'border-amber-200 bg-amber-50/70 text-amber-950':'border-teal-200 bg-teal-50/60 text-teal-950')}>
  <Icon aria-hidden="true" className={'mt-0.5 h-5 w-5 shrink-0 '+(tone==='loading'?'animate-spin motion-reduce:animate-none':'')}/><div className="min-w-0 flex-1"><p className="leading-6">{title}</p>{children&&<div className="mt-2">{children}</div>}</div>
 </div>;
}
export function PortalLoading(){
 return <div className="space-y-4 py-4" aria-label="Loading court dashboard"><PortalFeedback tone="loading" title="Loading court accounts…"/><div className="grid grid-cols-3 gap-3" aria-hidden="true">{[0,1,2].map(i=><div key={i} className={panel+' h-20 animate-pulse bg-slate-100/70 motion-reduce:animate-none'}/>)}</div></div>;
}
export function SeatCards({portal}:{portal:PortalData}){
 return <div className="grid grid-cols-3 gap-2 sm:gap-3">{[
  {label:'Licensed seats',value:portal.court.seat_limit,Icon:Armchair},
  {label:'Assigned seats',value:portal.occupied_seats,Icon:Users},
  {label:'Available',value:Math.max(0,portal.court.seat_limit-portal.occupied_seats),Icon:CheckCircle2}
 ].map(({label,value,Icon})=><div key={label} className={panel+' flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4'}><span className="w-fit rounded-lg bg-teal-50 p-1.5 text-teal-700 sm:p-2.5"><Icon aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6"/></span><div><p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-[28px]">{value}</p></div></div>)}</div>;
}
function GuideSteps(){
 return <><p className="mt-2 text-xs leading-5 text-slate-500">Real credentials. A private workspace for each participant.</p><ol className="mt-4 space-y-5">{[
  {title:'Create their account',detail:'Enter a unique username. DayBridge generates a strong temporary password.'},
  {title:'Share credentials privately',detail:'Give the username and temporary password in person or through your approved court process.'},
  {title:'They sign in and choose a password',detail:'The participant changes their temporary password before opening their DayBridge workspace.'}
 ].map(({title,detail},index)=><li key={title} className="relative flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-teal-800 ring-1 ring-teal-100">{index+1}</span><div><h3 className="text-[13px] font-semibold leading-5">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></li>)}</ol></>;
}
export function SignInGuide(){
 return <aside className={panel+' p-4'} aria-label="Participant sign-in guide"><div className="hidden xl:block"><h2 className="flex items-center gap-2 text-sm font-semibold"><Info aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-700"/>How participant sign-in works</h2><GuideSteps/></div><details className="group xl:hidden"><summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><Info aria-hidden="true" className="h-4 w-4 text-teal-700"/>How participant sign-in works</span><ChevronDown aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180"/></summary><GuideSteps/></details></aside>;
}
export function CredentialCard({credentials,onDismiss}:{credentials:Credentials;onDismiss:()=>void}){
 const [visible,setVisible]=useState(false),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 return <section role="status" aria-label="Temporary credentials" className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
  <h3 className="flex items-start gap-3 text-base font-semibold text-teal-950"><span className="rounded-full bg-emerald-600 p-1 text-white"><Check className="h-5 w-5" aria-hidden="true"/></span>{credentials.kind==='created'?'Account created successfully':'Temporary password issued'}</h3>
  <p className="mt-2 text-xs leading-5 text-slate-600">Share privately now. These credentials disappear when dismissed, after five minutes, or when your session ends.</p>
  <dl className="mt-3 divide-y divide-emerald-100 overflow-hidden rounded-xl border border-emerald-100 bg-white/80 text-sm">
   <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><dt className="flex items-center gap-2 text-slate-600"><UserRound className="h-4 w-4" aria-hidden="true"/>Username</dt><dd className="break-all font-bold">{credentials.username}</dd></div>
   <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><dt className="flex items-center gap-2 text-slate-600"><KeyRound className="h-4 w-4" aria-hidden="true"/>Temporary password</dt><dd className="flex max-w-full items-center gap-2"><span className="break-all font-mono text-xs font-semibold">{visible?credentials.temporaryPassword:'••••••••••••'}</span><button type="button" className="rounded p-2 text-teal-800" aria-label={visible?'Hide temporary password':'Show temporary password'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></dd></div>
   <div className="flex flex-wrap justify-between gap-2 px-3 py-2.5"><dt className="text-slate-600">Sign-in destination</dt><dd><a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-teal-800 underline">DayBridge app<SquareArrowOutUpRight className="h-3 w-3" aria-hidden="true"/></a></dd></div>
   <div className="flex flex-wrap justify-between gap-2 px-3 py-2.5"><dt className="flex items-center gap-2 text-slate-600"><LockKeyhole className="h-4 w-4" aria-hidden="true"/>First sign-in action</dt><dd className="font-bold">Change password</dd></div>
  </dl><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={secondary} onClick={async()=>{try{await navigator.clipboard.writeText(`DayBridge username: ${credentials.username}\nTemporary password: ${credentials.temporaryPassword}\nSign in at ${location.origin}/ and change your password.`);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}}><Copy aria-hidden="true" className="h-4 w-4"/>{copied?'Copied credentials':'Copy credentials'}</button><button type="button" className={secondary} onClick={onDismiss}>Dismiss credentials</button></div>{copyError&&<p className="mt-2 text-xs text-amber-900">Clipboard access is unavailable. Reveal the password and share it privately.</p>}
 </section>;
}
export function CreateAccountPanel({username,setUsername,busy,portal,credentials,onDismiss,onSubmit}:{username:string;setUsername:(value:string)=>void;busy:boolean;portal:PortalData;credentials:Credentials|null;onDismiss:()=>void;onSubmit:(event:React.FormEvent)=>void}){
 const full=portal.occupied_seats>=portal.court.seat_limit,paused=!['pilot','active'].includes(portal.court.subscription_status);
 return <section className={panel+' p-4'} aria-labelledby="create-account-heading"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Plus className="h-6 w-6" aria-hidden="true"/></span><div><h2 id="create-account-heading" className="text-base font-semibold">Create Participant Account</h2><p className="mt-1 text-xs leading-5 text-slate-500">{portal.court.is_demo?'Real sign-in accounts. Use fictional participants in this test workspace.':'Create a real participant credential for DayBridge.'}</p></div></div>
  <div className="mt-3 grid items-start gap-4 2xl:grid-cols-2"><form onSubmit={onSubmit} className="space-y-3">
   <label className="block text-xs font-semibold text-slate-700">Participant username <span className="text-red-700">*</span><input name="participant-username" className={field} required autoCapitalize="none" autoComplete="off" spellCheck={false} minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]{2,31}" placeholder="participant001" value={username} disabled={busy} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
   <label className="block text-xs font-semibold text-slate-700">Internal Auth alias (preview)<span title="Internal sign-in identifier, not an email inbox. Usernames must be unique across DayBridge." className="ml-1 inline-block align-middle text-slate-400"><Info className="h-3.5 w-3.5" aria-hidden="true"/></span><input className={field+' bg-slate-50 text-slate-500'} readOnly value={usernameToAuthEmail(username)||''} placeholder="Generated from the participant username"/></label>
   <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600"><KeyRound className="mr-1 inline h-4 w-4 text-teal-700" aria-hidden="true"/>Temporary password generated securely on creation.</div>
   {full&&<p role="status" className="text-sm text-amber-900">All licensed seats are assigned. Remove a court assignment or contact the program owner for more seats.</p>}{paused&&<p role="status" className="text-sm text-amber-900">Account creation is paused for this subscription.</p>}
   <button className={primary+' w-full'} disabled={busy||full||paused}>{busy?'Working…':'Create account'}</button>
  </form>{credentials?<CredentialCard key={credentials.temporaryPassword} credentials={credentials} onDismiss={onDismiss}/>:<div className="hidden h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-teal-200 bg-teal-50/30 p-4 text-center 2xl:flex"><ShieldCheck aria-hidden="true" className="h-8 w-8 text-teal-600"/><h3 className="mt-3 text-sm font-semibold text-teal-950">Ready for a new participant</h3><p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">Their username and one-time temporary password will appear here after the account is created.</p></div>}</div>
 </section>;
}
function ParticipantStatus({status}:{status:CourtAccount['status']}){
 const colors=status==='active'?'bg-emerald-50 text-emerald-800 ring-emerald-600/10':status==='suspended'?'bg-amber-50 text-amber-900 ring-amber-600/10':'bg-slate-100 text-slate-600 ring-slate-600/10';
 return <span className={'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset '+colors}><span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full '+(status==='active'?'bg-emerald-500':status==='suspended'?'bg-amber-500':'bg-slate-400')}/>{status[0].toUpperCase()+status.slice(1)}</span>;
}
function AccountActions({account,busy,onAction,menu=false}:{account:CourtAccount;busy:boolean;onAction:(account:CourtAccount,action:AccountAction)=>void;menu?:boolean}){
 const actions:AccountAction[]=account.status==='active'?['reset','suspend']:['restore'];
 if(account.status!=='removed')actions.push('remove');
 return <div className={menu?'space-y-1':'flex items-center gap-1.5'}>{actions.map(action=>{
  const Icon=action==='suspend'?Pause:action==='remove'?Trash2:RefreshCw;
  const text=action==='reset'?'Reset password':action==='suspend'?'Suspend':action==='restore'?'Restore':'Remove';
  const label=action==='reset'?'Reset password for '+account.username:text+' '+account.username;
  return <button key={action} type="button" disabled={busy} aria-label={label} onClick={()=>onAction(account,action)} className={menu?
   'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium disabled:opacity-50 '+(action==='remove'?'text-red-700 hover:bg-red-50':'text-slate-700 hover:bg-slate-50'):
   secondary+(action==='remove'?' ml-1 border-red-100 text-red-700 hover:border-red-200 hover:bg-red-50':'')}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>{text}</button>;
 })}</div>;
}
function AccountActionMenu({account,busy,onAction}:{account:CourtAccount;busy:boolean;onAction:(account:CourtAccount,action:AccountAction)=>void}){
 const element=useRef<HTMLDetailsElement>(null),[open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const closeOutside=(event:PointerEvent)=>{if(event.target instanceof Node&&!element.current?.contains(event.target)&&element.current)element.current.open=false;};
  document.addEventListener('pointerdown',closeOutside);
  return()=>document.removeEventListener('pointerdown',closeOutside);
 },[open]);
 return <details ref={element} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}} onToggle={event=>setOpen(event.currentTarget.open)} className="group relative shrink-0"><summary aria-label={'Actions for '+account.username} className="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-teal-50 group-open:border-teal-300 group-open:bg-teal-50"><MoreHorizontal aria-hidden="true" className="h-5 w-5"/><span className="sr-only">Actions</span></summary>
  <div role="group" aria-label={'Account actions for '+account.username} className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10"><AccountActions account={account} busy={busy} menu onAction={(person,action)=>{if(element.current){element.current.open=false;element.current.querySelector('summary')?.focus();}onAction(person,action);}}/></div>
 </details>;
}
export function ParticipantsTable({portal,busy,onAction}:{portal:PortalData;busy:boolean;onAction:(account:CourtAccount,action:AccountAction)=>void}){
 const [search,setSearch]=useState(''),[status,setStatus]=useState('assigned');
 const rows=portal.participants.filter(p=>{
  const matchesStatus=status==='all'||(status==='assigned'?p.status!=='removed':p.status===status);
  return matchesStatus&&p.username.toLowerCase().includes(search.trim().toLowerCase());
 });
 const filtered=Boolean(search||status!=='assigned');
 return <section className={panel+' min-w-0 p-4'} aria-labelledby="participants-heading">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="participants-heading" className="text-base font-semibold tracking-tight">Participants <span className="ml-1 text-sm font-normal tabular-nums text-slate-500">({rows.length})</span></h2>
   <div className="flex w-full gap-2 sm:w-auto"><label className="relative min-w-0 flex-1 sm:min-w-52"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400 sm:top-2.5"/><span className="sr-only">Search participants</span><input className={field+' mt-0 pl-9'} type="search" placeholder="Search by username…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="shrink-0"><span className="sr-only">Participant status</span><select aria-label="Participant status" className={field+' mt-0'} value={status} onChange={e=>setStatus(e.target.value)}><option value="assigned">Assigned</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="removed">Removed</option><option value="all">All accounts</option></select></label></div>
  </div>
  <div className="mt-3 hidden overflow-x-auto lg:block"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr>{['Username','Status','Created by','Created on','Actions'].map(label=><th key={label} scope="col" className="whitespace-nowrap border-y border-slate-100 px-3 py-2.5 font-semibold first:rounded-l-lg last:rounded-r-lg">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(p=><tr key={p.user_id} className="transition hover:bg-slate-50/80"><th scope="row" className="px-3 py-2.5 text-[13px] font-semibold text-slate-800">{p.username}</th><td className="px-3 py-2.5"><ParticipantStatus status={p.status}/></td><td className="px-3 py-2.5 text-xs text-slate-500">{p.created_by_label}</td><td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500"><time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></td><td className="px-3 py-2.5"><AccountActions account={p} busy={busy} onAction={onAction}/></td></tr>)}</tbody></table></div>
  <div aria-label="Participant cards" className="mt-3 space-y-2.5 lg:hidden">{rows.map(p=><article key={p.user_id} aria-label={'Participant '+p.username} className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-all text-sm font-semibold text-slate-900">{p.username}</h3><div className="mt-2"><ParticipantStatus status={p.status}/></div></div><AccountActionMenu account={p} busy={busy} onAction={onAction}/></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-[11px]"><div><dt className="text-slate-500">Created by</dt><dd className="mt-1 font-medium text-slate-600">{p.created_by_label}</dd></div><div><dt className="text-slate-500">Created on</dt><dd className="mt-1 font-medium text-slate-600"><time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></dd></div></dl></article>)}</div>
  {!rows.length&&<div role="status" className="flex flex-col items-center rounded-xl bg-slate-50/70 px-4 py-8 text-center"><span className="rounded-full border border-slate-200 bg-white p-3 text-slate-400"><Users aria-hidden="true" className="h-5 w-5"/></span><p className="mt-3 text-sm font-semibold text-slate-700">{filtered?'No matching participants':'Your participant list starts here'}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{filtered?'Try another username or status to find the account you need.':'Create an account to assign a seat. Their access and status will appear here.'}</p>{filtered&&<button type="button" className={secondary+' mt-3'} onClick={()=>{setSearch('');setStatus('assigned');}}>Clear filters<ChevronRight aria-hidden="true" className="h-3 w-3"/></button>}</div>}
  <details className="group mt-3 border-t border-slate-100 pt-2.5"><summary className="flex min-h-7 w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-800"><ChevronRight aria-hidden="true" className="h-3 w-3 transition group-open:rotate-90"/>How seats and access work</summary><p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">Suspended accounts keep their seat. Removing an assignment frees the seat and disables sign-in; it preserves personal records. Existing tokens may remain valid until expiry, and offline devices cannot be remotely wiped.</p></details>
 </section>;
}
