'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useDayBridge} from '../../lib/storage/store';
import {eligibleReportingItems,type EligibleItem} from '../../lib/reporting/eligibility';
import {categoryLabels,progressLabel,reportingCategories,type ParticipantReporting,type ReportingCategory} from '../../lib/reporting/types';
const button='min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50';
export function CourtSharing(){
 const {events,tasks,syncStatus}=useDayBridge();
 const eligible=useMemo(()=>eligibleReportingItems(events,tasks),[events,tasks]);
 return <CourtSharingPanel eligible={eligible} saved={syncStatus==='synced'}/>;
}
export function CourtSharingPanel({eligible,saved=true}:{eligible:EligibleItem[];saved?:boolean}){
 const [data,setData]=useState<ParticipantReporting|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [source,setSource]=useState(''),[category,setCategory]=useState<ReportingCategory>('meeting');
 const [history,setHistory]=useState(false),[historyFrom,setHistoryFrom]=useState('');
 const sequence=useRef(0);
 const request=useCallback(async(input?:unknown)=>{
  const seq=++sequence.current;setBusy(true);setError('');
  try{
   const r=await fetch('/api/participant/reporting',{method:input?'POST':'GET',cache:'no-store',...(input?{headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
   const next=await r.json();if(sequence.current!==seq)return;
   if(!r.ok){setData(null);throw Error(next.error||'Court sharing is unavailable');}
   setData(next);
  }catch(e){if(sequence.current===seq)setError(e instanceof Error?e.message:'Court sharing is unavailable');}
  finally{if(sequence.current===seq)setBusy(false);}
 },[]);
 useEffect(()=>{void request();return()=>{sequence.current++;};},[request]);
 const item=eligible.find(e=>e.kind+':'+e.id===source);
 const share=async()=>{
  if(!item)return;
  if(!window.confirm(history?'Share this selected item, including activity from your chosen history date?':'Share future activity for this selected court-program item?'))return;
  await request({action:'share',source_kind:item.kind,source_id:item.id,category,include_history:history,...(history?{history_from:new Date(historyFrom+'T00:00:00.000Z').toISOString()}:{})});
  setHistory(false);setHistoryFrom('');
 };
 return <section aria-labelledby="court-sharing-title" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
  <h3 id="court-sharing-title" className="font-bold text-slate-900">Sharing with My Court</h3>
  <p className="text-sm text-slate-700">Sharing is voluntary in DayBridge and off by default. Self-reported completion is not independently verified attendance or official court compliance. Missing information is not a violation.</p>
  <p className="text-sm text-slate-600">Only categories and specific court-program items you choose can be shared. Staff receive the category, status and dates. Titles, descriptions, notes, medications, health logs, finances, contacts and location are never included.</p>
  {error&&<p role="alert" className="text-sm text-rose-800">{error} <button className={button} disabled={busy} onClick={()=>void request()}>Retry sharing settings</button></p>}
  {!data&&!error&&<p role="status">Loading sharing settings…</p>}
  {data&&<>
   {!data.enabled&&<p className="text-sm font-semibold text-slate-700">Court reporting is disabled. No activity is being shared. The initial pilot remains private.</p>}
   <fieldset disabled={busy||!data.enabled} className="space-y-2"><legend className="font-semibold">1. Choose permitted categories</legend>
    {reportingCategories.map(c=>{const enabled=data.consents.some(v=>v.category===c&&v.enabled);return <label key={c} className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>{categoryLabels[c]}</span><input type="checkbox" checked={enabled} className="h-5 w-5 accent-teal-800" onChange={e=>{
     const next=e.target.checked;if(!window.confirm(next?'Allow this category? Nothing is shared until you also select a specific item.':'Stop this category and withdraw its current reports? You must select items again if you re-enable it.'))return;
     void request({action:'consent',category:c,enabled:next});
    }}/></label>;})}
   </fieldset>
   <p className="text-xs text-slate-600">Disabling a category stops future sharing and withdraws its current reports from staff. It cannot erase copies someone previously exported. Consent changes remain in your history.</p>
   {data.enabled&&<fieldset disabled={busy||!saved} className="space-y-3"><legend className="font-semibold">2. Explicitly choose court-program items</legend>
    <p className="text-xs text-slate-600">Only Court, Case management and Class appointments are eligible. Tasks must be linked to a Court or Case management appointment. Therapy, self-help, drug testing and personal entries are excluded in this first version. For a court check-in, choose a Court appointment and Check-ins below; marking it attended privately reports the check-in complete.</p>
    {!saved&&<p role="status" className="text-sm text-amber-900">Wait for your private records to show Saved before choosing an item.</p>}
    <label className="block text-sm font-semibold">Private item name (only you see this)<select className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 p-2" value={source} onChange={e=>{setSource(e.target.value);const chosen=eligible.find(i=>i.kind+':'+i.id===e.target.value);if(chosen)setCategory(chosen.categories[0]);}}><option value="">Choose an eligible court-program item</option>{eligible.map(e=><option key={e.kind+e.id} value={e.kind+':'+e.id}>{e.kind==='task'?'Task: ':''}{e.label}</option>)}</select></label>
    {item&&<label className="block text-sm font-semibold">Reporting category<select className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 p-2" value={category} onChange={e=>setCategory(e.target.value as ReportingCategory)}>{item.categories.map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select></label>}
    <p className="text-xs text-slate-600">Future sharing starts when you press Share selected item. Existing past activity is excluded. Recurring appointments report saved occurrences only; unsaved occurrences are not inferred as missed.</p>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)} className="h-5 w-5"/>Separately include historical activity for this selected item</label>
    {history&&<label className="block text-sm">Include activity on or after (UTC, up to one year ago)<input type="date" required value={historyFrom} min={new Date(Date.now()-365*86400000).toISOString().slice(0,10)} max={new Date().toISOString().slice(0,10)} onChange={e=>setHistoryFrom(e.target.value)} className="ml-2 min-h-11 rounded-xl border border-slate-300 p-2"/></label>}
    <button className={button+' bg-teal-800 text-white'} disabled={!item||!data.consents.some(c=>c.category===category&&c.enabled)||(history&&!/^\d{4}-\d{2}-\d{2}$/.test(historyFrom))} onClick={()=>void share()}>Share selected item</button>
   </fieldset>}
   <div className="space-y-2"><h4 className="font-semibold">Currently selected items</h4>{!data.items.length&&<p className="text-sm text-slate-600">No items selected. Enabling a category alone shares nothing.</p>}{data.items.map(i=><div key={i.source_kind+i.source_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><p className="min-w-0 break-words text-sm">{eligible.find(e=>e.id===i.source_id&&e.kind===i.source_kind)?.label||'Previously selected item'} · {categoryLabels[i.category]}<span className="block text-xs text-slate-500">{i.needs_review?'Schedule or court link changed. Reports withdrawn; review and select this item again.':i.include_history?'Explicit history included':'Future activity only'} · from {new Date(i.share_from).toLocaleString()}</span></p><button className={button} disabled={busy} onClick={()=>{if(window.confirm('Withdraw this item from court reports?'))void request({action:'unshare',source_kind:i.source_kind,source_id:i.source_id});}}>Stop sharing item</button></div>)}</div>
   <details><summary className="min-h-11 cursor-pointer font-semibold">Review my shared progress history</summary><p className="text-xs text-slate-600">Latest 500 item states. Corrections replace completion status; withdrawn entries remain visible here to you, and are hidden from staff. This is not a permanent organizer history.</p><ul className="divide-y divide-slate-100">{data.events.map(e=><li key={e.id} className="py-3 text-sm">{categoryLabels[e.category]} · {progressLabel(e)}<span className="block text-xs text-slate-500">{e.scheduled_at?new Date(e.scheduled_at).toLocaleString():'No scheduled date'} · Updated {new Date(e.updated_at).toLocaleString()} · {e.provenance==='explicit_history'?'Explicit historical choice':'Self-reported'}</span></li>)}</ul>{!data.events.length&&<p className="text-sm">No shared progress entries.</p>}</details>
   <details><summary className="min-h-11 cursor-pointer font-semibold">Consent history</summary><p className="text-xs text-slate-600">Latest 100 category changes.</p><ul>{data.history.map((h,i)=><li key={i} className="py-2 text-sm">{categoryLabels[h.category]} · {h.enabled?'Enabled':'Withdrawn'} · {new Date(h.created_at).toLocaleString()}{h.reason==='access_ended'?' · Court access or reporting availability ended':''}</li>)}</ul></details>
   <button className={button} disabled={busy} onClick={()=>void request()}>Refresh sharing history</button>
  </>}
 </section>;
}
