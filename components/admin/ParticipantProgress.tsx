'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {categoryLabels,progressLabel,reportingCategories,type ProgressReport} from '../../lib/reporting/types';
import {field,panel,primary,secondary} from './PortalPanels';
const day=86400000;
export function ParticipantProgress({courtId}:{courtId:string}){
 const today=new Date().toISOString().slice(0,10);
 const [from,setFrom]=useState(new Date(Date.now()-6*day).toISOString().slice(0,10)),[through,setThrough]=useState(today);
 const [participant,setParticipant]=useState(''),[category,setCategory]=useState('');
 const [data,setData]=useState<ProgressReport|null>(null),[roster,setRoster]=useState<NonNullable<ProgressReport['participants']>>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  current.current?.abort();const controller=new AbortController();current.current=controller;setBusy(true);setError('');setData(null);
  try{
   const start=new Date(from+'T00:00:00Z'),end=new Date(through+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()>93*day)throw Error('Choose a valid reporting period of up to 93 days');
   const q=new URLSearchParams({court_id:courtId,start:start.toISOString(),end:end.toISOString()});if(participant)q.set('participant',participant);if(category)q.set('category',category);
   const r=await fetch('/api/admin/progress?'+q,{cache:'no-store',signal:controller.signal});const result=await r.json();if(controller.signal.aborted)return;
   if(!r.ok)throw Error(result.error||'Progress reporting is unavailable');
   setData(result);if(!participant)setRoster(result.participants||[]);
  }catch(e){if(!controller.signal.aborted){setData(null);setRoster([]);setError(e instanceof Error?e.message:'Progress reporting is unavailable');}}
  finally{if(!controller.signal.aborted)setBusy(false);}
 },[courtId,from,through,participant,category]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>{clearInterval(timer);current.current?.abort();};},[load]);
 const entries=data?.events||[],summary=data?.summary;
 return <section aria-labelledby="participant-progress-title" className="space-y-4">
  <div className={panel+' space-y-3 p-5'}><h3 id="participant-progress-title" className="text-lg font-bold">Participant Progress</h3>
   <p className="text-sm text-slate-700">Voluntary, self-reported court-program activity only. These entries are not independently verified attendance or official court compliance. Missing data, disabled sharing and incomplete information must never be treated as a violation.</p>
   <div className="flex flex-wrap gap-2"><button className={secondary} onClick={()=>{setFrom(new Date(Date.now()-6*day).toISOString().slice(0,10));setThrough(today);}}>Last 7 days</button><button className={secondary} onClick={()=>{setFrom(today.slice(0,7)+'-01');setThrough(today);}}>This month</button></div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold">From (UTC)<input className={field} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm font-semibold">Through (UTC)<input className={field} type="date" value={through} onChange={e=>setThrough(e.target.value)}/></label><label className="text-sm font-semibold">Participant<select className={field} value={participant} onChange={e=>setParticipant(e.target.value)}><option value="">All participants</option>{roster.map(p=><option key={p.user_id} value={p.user_id}>{p.username}</option>)}</select></label><label className="text-sm font-semibold">Activity category<select className={field} value={category} onChange={e=>setCategory(e.target.value)}><option value="">All approved categories</option>{reportingCategories.map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select></label></div>
   <button className={primary} disabled={busy} onClick={()=>void load()}>{busy?'Loading progress…':'Refresh progress'}</button>
   {data?.updated_at&&<p className="text-xs text-slate-500">Reporting period {from} through {through} (UTC). Last refreshed {new Date(data.updated_at).toLocaleString()}. Every report read is audited. Dates are self-reported; no location or verification evidence is collected.</p>}
  </div>
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
  {data&&!data.enabled&&<div className={panel+' p-5'}><h4 className="font-bold">Reporting disabled for this court</h4><p className="mt-2 text-sm text-slate-600">The initial pilot uses private organization and account administration only. No participant progress is available. The owner can enable this additional capability after testing; participants must still choose what to share.</p></div>}
  {data?.enabled&&<>
   <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{[['Shared items',summary?.shared],['Self-reported complete',summary?.complete],['Self-reported incomplete',summary?.incomplete],['Past, not self-reported',summary?.not_reported],['Upcoming',summary?.upcoming]].map(([label,value])=><div key={label} className={panel+' p-4'}><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold">{value??0}</p></div>)}</div>
   <section className={panel+' p-5'}><h4 className="font-bold">{participant?'Participant overview':'Court-wide participant summary'}</h4><p className="mt-2 text-xs text-slate-600">Only consented, individually selected items contribute. These counts do not measure compliance or all obligations.</p>{data.participants_truncated&&<p role="status" className="text-sm text-amber-900">Participant list limited to 1,000 accounts. Narrow by participant to review additional accounts through an approved support process.</p>}
    <ul className="mt-3 divide-y divide-slate-100">{data.participants?.map(p=><li key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><button className="font-semibold text-teal-800 underline" onClick={()=>setParticipant(p.user_id)}>{p.username}</button><span className="ml-2 capitalize">{p.status}</span><p className="text-xs text-slate-500">Last reported activity: {p.last_reported_at?new Date(p.last_reported_at).toLocaleString():'Not enough information'}</p></div><p>{p.status!=='active'?'Reporting access paused':p.sharing_categories?`${p.sharing_categories} permitted ${p.sharing_categories===1?'category':'categories'}`:'Sharing disabled'}</p></li>)}</ul>
   </section>
   <section className={panel+' p-5'}><h4 className="font-bold">Shared activity details</h4>{data.events_truncated&&<p role="status" className="text-sm text-amber-900">Showing the latest 500 of {data.total_events} entries. Narrow the date range or participant. Summary counts include all matches.</p>}{!entries.length&&<p className="mt-3 text-sm text-slate-600">Not enough information. No shared activity matches this period and filter. This is not evidence of missed attendance.</p>}<ul className="mt-3 divide-y divide-slate-100">{entries.map(e=><li key={e.id} className="space-y-1 py-3 text-sm"><p className="font-semibold">{e.username} · {categoryLabels[e.category]}</p><p>{progressLabel(e)}</p><p className="text-xs text-slate-500">Scheduled: {e.scheduled_at?new Date(e.scheduled_at).toLocaleString():'Not supplied'} · Reported: {e.reported_at?new Date(e.reported_at).toLocaleString():'Not supplied'} · Updated: {new Date(e.updated_at).toLocaleString()} · {e.provenance==='explicit_history'?'Explicitly shared history':'Self-reported'}</p></li>)}</ul></section>
   <div className="grid items-start gap-4 md:grid-cols-2">{([['Weekly summary',data.weekly],['Monthly summary',data.monthly]] as const).map(([label,periods])=><section key={label} className={panel+' p-5'}><h4 className="font-bold">{label}</h4><p className="mt-1 text-xs text-slate-600">UTC periods within the selected date range. Partial weeks and months may be shown.</p><ul>{periods?.map(p=><li key={p.period} className="py-2 text-sm">{p.period.slice(0,10)} · {p.complete} self-reported complete of {p.shared} shared entries</li>)}</ul>{!periods?.length&&<p className="mt-2 text-sm">Not enough information.</p>}</section>)}</div>
  </>}
 </section>;
}
