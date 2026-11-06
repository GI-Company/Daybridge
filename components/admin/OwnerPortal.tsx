'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '../../lib/supabase/client';
import {loginIdentifierToEmail} from '../../lib/auth/username';
import {courtStaffAuthEmail} from '../../lib/auth/court-staff';
import {suggestedLoginSlug,type OwnerCourt,type OwnerDashboardData,type OwnerView} from '../../lib/admin/owner-types';
import {field,panel,primary,secondary,PortalFeedback,CredentialCard,type Credentials,type StaffSignIn} from './PortalPanels';
import {OwnerReportingSetting} from './OwnerReportingSetting';
import {OwnerCourtStaff} from './OwnerCourtStaff';
import {OwnerNavigation,OwnerOverview,OwnerCourts,OwnerStaff,OwnerGuide,OwnerSecurity,ownerViewTitles} from './OwnerDashboardPanels';

const emptyCreate={state_code:'',state_name:'',circuit_name:'',circuit_slug:'',court_name:'',court_slug:'',seat_limit:25,is_demo:true,listed:false};
type PageState='loading'|'signin'|'denied'|'ready'|'error';
export function OwnerPortal({backend}:{backend?:SupabaseClient|null}){
 const client=useMemo(()=>backend===undefined?createClient():backend,[backend]);
 const [state,setState]=useState<PageState>('loading');
 const [view,setView]=useState<OwnerView>('overview');
 const [directory,setDirectory]=useState<OwnerDashboardData|null>(null);
 const [login,setLogin]=useState(''),[password,setPassword]=useState('');
 const [message,setMessage]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [create,setCreate]=useState(emptyCreate),[selected,setSelected]=useState('');
 const [edit,setEdit]=useState<OwnerCourt|null>(null),[staffName,setStaffName]=useState(''),[staffRole,setStaffRole]=useState('case_manager');
 const [credentials,setCredentials]=useState<(Credentials&{signIn:StaffSignIn})|null>(null);
 const epoch=useRef(0),identity=useRef(''),sequence=useRef(0);
 const load=useCallback(async()=>{
  const scope=epoch.current,request=++sequence.current;
  try{
   const response=await fetch('/api/owner/setup',{cache:'no-store'});const data=await response.json();
   if(scope!==epoch.current||request!==sequence.current)return false;
   if(!response.ok){setCredentials(null);setDirectory(null);setEdit(null);setState(response.status===401?'signin':response.status===403?'denied':'error');setMessage(data.error||'Owner setup unavailable');return false;}
   setDirectory(data);setState('ready');setMessage('');return true;
  }catch{if(scope===epoch.current&&request===sequence.current){setCredentials(null);setDirectory(null);setState('error');setMessage('Could not load court setup. Reconnect and retry.');}return false;}
 },[]);
 useEffect(()=>{
  let active=true;
  const change=(id:string)=>{
   if(!active)return;
   if(identity.current===id){if(!id)setState('signin');return;}
   if(identity.current!==id){identity.current=id;epoch.current++;sequence.current++;setCredentials(null);setDirectory(null);setEdit(null);setSelected('');setView('overview');setCreate(emptyCreate);setStaffName('');setMessage('');setNotice('');}
   if(id){setState('loading');void load();}else setState('signin');
  };
  if(!client){setState('signin');return;}
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>change(session?.user.id||''));
  const started=epoch.current;
  void client.auth.getUser().then(({data,error})=>{if(active&&epoch.current===started)change(error?'':data.user?.id||'');}).catch(()=>{if(active)setState('signin');});
  return()=>{active=false;epoch.current++;subscription.unsubscribe();};
 },[client,load]);
 useEffect(()=>{const court=directory?.courts.find(c=>c.id===selected);setEdit(court?{...court}:null);setStaffName('');},[directory,selected]);
 async function signIn(event:FormEvent){
  event.preventDefault();const email=loginIdentifierToEmail(login);if(!email||!client){setMessage('Enter your existing owner username or email.');return;}
  setBusy(true);setMessage('');
  try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user)setMessage('Sign-in was not accepted.');else{identity.current=data.user.id;epoch.current++;await load();}}catch{setMessage('Sign-in is temporarily unavailable.');}finally{setPassword('');setBusy(false);}
 }
 async function signOut(){
  if(hasDraft&&!window.confirm('Sign out and discard unsaved court setup fields?'))return;
  setBusy(true);try{const result=await client?.auth.signOut({scope:'local'});if(result?.error)throw result.error;epoch.current++;identity.current='';setCredentials(null);setDirectory(null);setEdit(null);setState('signin');setMessage('');setNotice('');}catch{setMessage('Could not sign out. Reconnect and retry.');}finally{setBusy(false);}
 }
 async function mutate(input:object,confirmation:string,success:string){
  if(busy||!window.confirm(confirmation))return false;
  const scope=epoch.current;setBusy(true);setCredentials(null);setMessage('');setNotice('');
  try{
   const response=await fetch('/api/owner/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});const data=await response.json();
   if(scope!==epoch.current)return false;
   if(!response.ok){if(response.status===401||response.status===403){setCredentials(null);setDirectory(null);setEdit(null);setState(response.status===401?'signin':'denied');}throw Error(data.error||'Could not save setup');}
   setNotice(success);await load();if(input&&'action' in input&&input.action==='create'){setSelected(data.court_id);setView('manage');}return true;
  }catch(error){if(scope===epoch.current)setMessage(error instanceof Error?error.message:'Could not save setup');return false;}finally{setBusy(false);}
 }
 useEffect(()=>{if(!credentials)return;const timer=window.setTimeout(()=>setCredentials(null),5*60_000);return()=>window.clearTimeout(timer);},[credentials]);
 async function staffCredentials(action:'create'|'reset',userId?:string){
  if(busy||!edit||!circuit)return;
  const name=action==='create'?staffName:directory?.staff.find(s=>s.court_id===edit.id&&s.user_id===userId)?.username;
  const prompt=action==='create'?`Create ${alias} and grant ${staffRole.replace('_',' ')} access to ${edit.court_name}?`:`Reset ${name}'s password? The old password stops working. Court operations stay blocked until they change the temporary password. Verify their identity before sharing it.`;
  if(!window.confirm(prompt))return;
  const scope=epoch.current;
  setBusy(true);setCredentials(null);setMessage('');setNotice('');
  try{
   const response=await fetch('/api/owner/staff',{method:action==='create'?'POST':'PATCH',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(action==='create'?{court_id:edit.id,username:staffName.trim().toLowerCase(),role:staffRole}:{court_id:edit.id,user_id:userId})});
   const result=await response.json();if(scope!==epoch.current)return;
   if(!response.ok){if(response.status===401){setDirectory(null);setEdit(null);setState('signin');}else if(response.status===403){await load();}throw Error(result.error||'Staff credentials could not be issued');}
   const signIn={email:result.email,courtId:edit.id,courtName:edit.court_name,circuitName:circuit.name,stateName:directory?.states.find(state=>state.code===circuit.state_code)?.name||circuit.state_code};
   if(await load()&&scope===epoch.current){setCredentials({username:result.username,temporaryPassword:result.temporaryPassword,kind:action==='create'?'created':'reset',signIn});setNotice(action==='create'?'Staff account created. Share the temporary credentials privately.':'Staff password reset. Share the new temporary credentials privately.');}
  }catch(error){if(scope===epoch.current)setMessage(error instanceof Error?error.message:'Staff credential management unavailable');}
  finally{if(scope===epoch.current)setBusy(false);}
 }
 const editBase=directory?.courts.find(c=>c.id===selected);
 const editDirty=Boolean(edit&&editBase&&JSON.stringify(edit)!==JSON.stringify(editBase));
 const hasDraft=JSON.stringify(create)!==JSON.stringify(emptyCreate)||editDirty||Boolean(staffName);
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{if(hasDraft){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[hasDraft]);
 const navigate=(next:OwnerView)=>{setCredentials(null);setView(next);setMessage('');setNotice('');};
 const manage=(id:string)=>{if((editDirty||staffName)&&id!==selected&&!window.confirm('Discard the unsaved settings for this court?'))return;setSelected(id);navigate('manage');};
 const refreshDashboard=()=>{if(hasDraft&&!window.confirm('Refresh and discard your unsaved setup fields?'))return;setCredentials(null);setCreate(emptyCreate);setStaffName('');void load();};
 const circuit=directory?.circuits.find(j=>j.id===edit?.circuit_id);
 const alias=circuit&&edit?courtStaffAuthEmail(staffName,circuit.state_code,circuit.login_slug,edit.login_slug):null;
 const circuitOptions=directory?.circuits.filter(j=>j.state_code===create.state_code)||[];
 return <main className="min-h-screen bg-[#f3f7f6] p-4 text-slate-900 sm:p-8"><div className="mx-auto max-w-7xl space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-teal-800">DayBridge Owner</p><h1 className="mt-1 text-2xl font-bold">Owner dashboard</h1><p className="mt-2 text-sm text-slate-600">Your courts, staff and next steps in one place. Participant records stay private.</p></div><nav className="flex flex-wrap gap-3" aria-label="Owner navigation"><Link className={secondary} onClick={e=>{if(hasDraft&&!window.confirm('Leave the owner dashboard with unsaved setup fields?'))e.preventDefault();}} href="/admin">Court staff portal</Link><Link className={secondary} onClick={e=>{if(hasDraft&&!window.confirm('Leave the owner dashboard with unsaved setup fields?'))e.preventDefault();}} href="/">DayBridge home</Link>{state!=='signin'&&state!=='loading'&&<button disabled={busy} className={secondary} onClick={()=>void signOut()}>Sign out</button>}</nav></header>
  {message&&<PortalFeedback tone="error" title={message}/>} {notice&&<PortalFeedback title={notice}/>}
  {state==='loading'&&<PortalFeedback tone="loading" title="Checking owner access…"/>}
  {state==='signin'&&<section className={panel+' mx-auto max-w-md p-6'}><h2 className="text-lg font-bold">Owner sign in</h2><p className="mt-2 text-sm text-slate-600">Use an existing account with owner access. There is no owner self-registration.</p><form className="mt-4 space-y-4" onSubmit={signIn}><label className="block text-sm font-semibold">Username or email<input className={field} required autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)}/></label><label className="block text-sm font-semibold">Password<input className={field} required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={primary} disabled={busy||!client}>Sign in</button></form></section>}
  {(state==='denied'||state==='error')&&<section className={panel+' p-6'}><h2 className="font-bold">{state==='denied'?'Owner access required':'Setup unavailable'}</h2><p className="mt-2 text-sm text-slate-600">{state==='denied'?'A trusted project administrator must assign the owner role to your verified account. Court membership alone does not grant owner access.':'Check your connection and try again.'}</p><button className={secondary+' mt-4'} disabled={busy} onClick={()=>void load()}>Retry access</button></section>}
  {state==='ready'&&directory&&<>
   <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
    <OwnerNavigation view={view} onNavigate={navigate} busy={busy}/>
    <div className="min-w-0 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">{ownerViewTitles[view]}</h2><p className="mt-1 text-xs text-slate-500">{directory.session?`Checked ${new Date(directory.session.checked_at).toLocaleTimeString()}`:'Owner-authorized court directory'}</p></div><button className={secondary} disabled={busy} onClick={refreshDashboard}>Refresh dashboard</button></div>
    {view==='overview'&&<OwnerOverview data={directory} onAdd={()=>navigate('create')} onManage={manage} onNavigate={navigate}/>}
    {view==='courts'&&<OwnerCourts data={directory} onAdd={()=>navigate('create')} onManage={manage}/>}
    {view==='staff'&&<OwnerStaff data={directory} onManage={manage} onGuide={()=>navigate('guide')}/>}
    {view==='guide'&&<OwnerGuide onNavigate={navigate}/>}
    {view==='security'&&<OwnerSecurity data={directory}/>}
    <div hidden={view!=='create'&&view!=='manage'} className="space-y-5">
    <section hidden={view!=='create'} className={panel+' max-w-3xl p-5'}><h2 className="text-lg font-bold">Add a court</h2><p className="mt-2 text-sm text-slate-600">Reuse an existing state and circuit or enter a new one. Sign-in codes stay fixed after creation.</p>
     <form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();if(await mutate({action:'create',...create},`Create ${create.court_name} with ${create.seat_limit} seats?${create.listed?' Its name will appear in the public court directory.':''}`,'Court created. Review its staff sign-in and directory settings below.'))setCreate(emptyCreate);}}>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">State code<input className={field} required maxLength={2} pattern="[A-Z]{2}" list="owner-states" value={create.state_code} onChange={e=>{const code=e.target.value.toUpperCase();setCreate({...create,state_code:code,state_name:directory.states.find(s=>s.code===code)?.name||'',circuit_name:'',circuit_slug:''});}}/></label><label className="text-sm font-semibold">State name<input className={field} required minLength={2} maxLength={80} readOnly={directory.states.some(s=>s.code===create.state_code)} value={create.state_name} onChange={e=>setCreate({...create,state_name:e.target.value})}/></label></div>
      <p className="text-xs leading-5 text-slate-500">Use the two-letter state abbreviation, such as GA. Registered state names fill in automatically.</p>
      <datalist id="owner-states">{directory.states.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</datalist>
      <label className="block text-sm font-semibold">Judicial circuit<input className={field} required minLength={3} maxLength={120} list="owner-circuits" value={create.circuit_name} onChange={e=>setCreate({...create,circuit_name:e.target.value,circuit_slug:circuitOptions.find(j=>j.name===e.target.value)?.login_slug||suggestedLoginSlug(e.target.value)})}/></label><datalist id="owner-circuits">{circuitOptions.map(j=><option key={j.id} value={j.name}/>)}</datalist>
      <label className="block text-sm font-semibold">Circuit sign-in code<input className={field} required pattern="[a-z][a-z0-9-]{1,62}" maxLength={63} readOnly={circuitOptions.some(j=>j.name===create.circuit_name)} value={create.circuit_slug} onChange={e=>setCreate({...create,circuit_slug:e.target.value})}/></label>
      <label className="block text-sm font-semibold">Court name<input className={field} required minLength={3} maxLength={120} value={create.court_name} onChange={e=>setCreate({...create,court_name:e.target.value,court_slug:suggestedLoginSlug(e.target.value)})}/></label>
      <label className="block text-sm font-semibold">Court sign-in code<input className={field} required pattern="[a-z][a-z0-9-]{1,62}" maxLength={63} value={create.court_slug} onChange={e=>setCreate({...create,court_slug:e.target.value})}/></label>
      <p className="text-xs leading-5 text-slate-500">Sign-in codes become part of staff login addresses. Review them now; they stay fixed after creation.</p>
      <label className="block text-sm font-semibold">Participant seats<input className={field} type="number" required min={1} max={100000} value={create.seat_limit} onChange={e=>setCreate({...create,seat_limit:Number(e.target.value)})}/></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={create.is_demo} onChange={e=>setCreate({...create,is_demo:e.target.checked})}/>Test court</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={create.listed} onChange={e=>setCreate({...create,listed:e.target.checked})}/>Show in public court directory</label><p className="text-xs text-slate-500">New courts use the free pilot status. Creating a court does not charge money or create staff accounts.</p><button className={primary} disabled={busy}>Create court</button>
     </form>
    </section>
    <section hidden={view!=='manage'} className={panel+' max-w-3xl space-y-4 p-5'}><h2 className="text-lg font-bold">Manage a court</h2><label className="block text-sm font-semibold">Select court<select disabled={busy} aria-label="Select court" className={field} value={selected} onChange={e=>manage(e.target.value)}><option value="">Choose a court</option>{directory.courts.map(c=><option key={c.id} value={c.id}>{c.court_name}{c.is_demo?' (test)':''}</option>)}</select></label>
     {edit&&<><p className="text-sm text-slate-600">{circuit?.name} · {circuit?.state_code} · {edit.occupied_seats} assigned / {edit.seat_limit} seats</p>
      <form className="space-y-3" onSubmit={e=>{e.preventDefault();void mutate({action:'update',court_id:edit.id,court_name:edit.court_name,seat_limit:edit.seat_limit,subscription_status:edit.subscription_status,listed:edit.listed,enabled:edit.enabled},'Save these court settings? Disabling the court stops staff portal access. Pausing enrollment retains existing participant records.','Court settings saved.');}}>
       <label className="block text-sm font-semibold">Display name<input className={field} required minLength={3} maxLength={120} value={edit.court_name} onChange={e=>setEdit({...edit,court_name:e.target.value})}/></label><label className="block text-sm font-semibold">Seat limit<input className={field} required type="number" min={Math.max(1,edit.occupied_seats)} max={100000} value={edit.seat_limit} onChange={e=>setEdit({...edit,seat_limit:Number(e.target.value)})}/></label>
       <label className="block text-sm font-semibold">Enrollment status<select className={field} value={edit.subscription_status} onChange={e=>setEdit({...edit,subscription_status:e.target.value as OwnerCourt['subscription_status']})}><option value="pilot">Free pilot</option><option value="active">Active</option><option value="paused">Paused</option><option value="canceled">Canceled</option></select></label><p className="text-xs text-slate-500">This controls enrollment, not payment collection. Suspended participants still occupy seats.</p>
       <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.listed} onChange={e=>setEdit({...edit,listed:e.target.checked})}/>Show in public directory</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.enabled} onChange={e=>setEdit({...edit,enabled:e.target.checked})}/>Court staff portal enabled</label><button disabled={busy} className={primary}>Save court settings</button>
      </form>
      <OwnerReportingSetting key={edit.id+'reporting'} courtId={edit.id}/>
      <OwnerCourtStaff key={edit.id} court={edit} staff={directory.staff.filter(s=>s.court_id===edit.id)} username={staffName} setUsername={setStaffName} role={staffRole} setRole={setStaffRole} alias={alias} busy={busy}
       onCreate={()=>void staffCredentials('create')}
       onAssign={()=>void mutate({action:'assign_staff',court_id:edit.id,username:staffName.trim().toLowerCase(),role:staffRole},`Grant ${alias} ${staffRole.replace('_',' ')} access to ${edit.court_name}?`,'Staff assignment saved.')}
       onReset={staff=>void staffCredentials('reset',staff.user_id)}
       onRevoke={staff=>void mutate({action:'revoke_staff',court_id:edit.id,user_id:staff.user_id},`Revoke ${staff.username}'s access to ${edit.court_name}? Further court operations will be blocked. Their login, assignment and audit history are retained.`,'Staff access revoked. Account and audit history retained.')}
       onRestore={staff=>void mutate({action:'assign_staff',court_id:edit.id,username:staff.username,role:staff.role},`Restore ${staff.username}'s ${staff.role.replace('_',' ')} access to ${edit.court_name}? Reset their password afterward if credentials may have been shared.`,'Staff access restored.')}/>
      {credentials&&<CredentialCard key={credentials.temporaryPassword} credentials={credentials} staffSignIn={credentials.signIn} onDismiss={()=>setCredentials(null)}/>}
     </>}
    </section>
    </div></div>
   </div>
  </>}
 </div></main>;
}
