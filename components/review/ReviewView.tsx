'use client';
import React,{useEffect,useRef,useState} from 'react';
import {FileText,Printer,Download,Eye,EyeOff} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import {formatCents} from '../../lib/budget';
import {formatDate,formatTime} from '../../lib/date-time';
import {weeklyReview,occurrenceStatus,reviewCSV} from '../../lib/weekly-review';

export const ReviewView:React.FC=()=>{
 const records=useDayBridge();const {profile,events,medications}=records;
 const [omitMedNames,setOmitMedNames]=useState(false),[personalNotes,setPersonalNotes]=useState('');
 const report=useRef<HTMLDivElement>(null);
 const now=new Date(),review=weeklyReview(records,now,profile.timezone);
 // Native printing must include collapsed sections, including Cmd/Ctrl+P.
 useEffect(()=>{
  let previous:Array<[HTMLDetailsElement,boolean]>=[];
  const before=()=>{if(previous.length)return;previous=Array.from(report.current?.querySelectorAll<HTMLDetailsElement>('details')||[]).map(node=>[node,node.open]);previous.forEach(([node])=>{node.open=true;});};
  const after=()=>{previous.forEach(([node,open])=>{node.open=open;});previous=[];};
  window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
  return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);after();};
 },[]);
 const titleFor=(id:string)=>events.find(event=>event.id===id)?.title||'Calendar item';
 function exportCSV(){
  const rows=[['Date','Type','Title / Description','Status / Notes'],
   ...review.attended.map(o=>[o.attendanceRecordedAt||'','Event',o.overrideTitle||titleFor(o.eventId),'Attended (self-reported)']),
   ...review.checkIns.map(o=>[o.checkInCompletedAt||'','Check-in',titleFor(o.eventId),'Completed']),
   ...review.medicationLogs.map(log=>[log.recordedAtUtc,'Medication action',omitMedNames?'Scheduled prescription':medications.find(m=>m.id===log.medicationId)?.name||'Medication',log.action]),
   ...review.completedTasks.map(task=>[task.completedAt||'','Completed task',task.title,'Done'])];
  const url=URL.createObjectURL(new Blob([reviewCSV(rows)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`DayBridge_Self_Report_${now.toISOString().slice(0,10)}.csv`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
 }
 const panel='mb-5 rounded-xl border border-slate-200 p-3 print:border-none print:p-0';
 return <div className="space-y-5 pb-20">
  <header className="print:hidden space-y-3">
   <div><h2 className="flex items-center gap-2 text-xl font-bold text-slate-950"><FileText className="h-5 w-5"/>Weekly Self-Review & Report</h2>
    <p className="text-sm text-slate-600">Your past week at a glance. Expand a section for details.</p></div>
   <div className="flex flex-wrap gap-2">
    <button onClick={()=>setOmitMedNames(value=>!value)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-800">{omitMedNames?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}{omitMedNames?'Med Names Hidden':'Hide Med Names'}</button>
    <button onClick={exportCSV} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-800"><Download className="h-4 w-4"/>CSV</button>
    <button onClick={()=>window.print()} className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-800 px-4 text-xs font-bold text-white"><Printer className="h-4 w-4"/>Print / PDF</button>
   </div>
  </header>
  <div ref={report} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 print:border-none print:p-0 print:shadow-none">
   <header className="mb-5 space-y-3 border-b border-slate-200 pb-4">
    <h1 className="text-xl font-bold text-slate-950">DayBridge Weekly Activity Summary</h1>
    <p className="text-xs text-slate-700">Participant: <strong>{profile.fullName||'Authorized Owner'}</strong><br/>{formatDate(review.start)} – {formatDate(now)}</p>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><strong>Notice:</strong> Personal self-reported weekly organization summary — not an official court attendance record or clinical compliance certificate.</p>
   </header>
   <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Past seven days summary">
    {[
     ['Attendance entries',String(review.attended.length)],
     ['Doses logged',String(review.medicationLogs.filter(log=>log.action==='taken').length)],
     ['Tasks completed',String(review.completedTasks.length)],
     ['Weekly outflow',formatCents(review.spentCents)]
    ].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">{label}</p><strong className="block text-2xl text-teal-800">{value}</strong></div>)}
   </div>
   <details className={panel}>
    <summary className="min-h-11 cursor-pointer py-2 font-bold text-slate-900">Recent & upcoming obligations <span className="text-xs font-normal text-slate-600">· {review.occurrences.length} items</span></summary>
    <p className="mb-3 text-xs text-slate-600">The past week and the next seven days. Each repeating occurrence has its own status.</p>
    <div className="space-y-2">{review.occurrences.map(occ=><div key={occ.id} className="rounded-lg bg-slate-50 p-3 text-xs sm:flex sm:items-start sm:justify-between sm:gap-3">
     <div><strong className="block text-slate-950">{occ.title}</strong><p className="text-slate-600">{formatDate(occ.startTime)} · {formatTime(occ.startTime)}</p>{occ.location&&<p className="text-slate-600">{occ.location}</p>}</div>
     <span className="mt-1 inline-block font-semibold text-teal-800 sm:mt-0">{occurrenceStatus(occ,now)}</span>
    </div>)}{!review.occurrences.length&&<p className="text-sm text-slate-600">No obligations scheduled in this period.</p>}</div>
   </details>
   <details className={panel}>
    <summary className="min-h-11 cursor-pointer py-2 font-bold text-slate-900">Medication log details <span className="text-xs font-normal text-slate-600">· {review.medicationLogs.length} entries</span></summary>
    <div className="space-y-2">{review.medicationLogs.map(log=><div key={log.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-xs">
     <div><strong>{omitMedNames?'Scheduled prescription':medications.find(m=>m.id===log.medicationId)?.name||'Medication'}</strong><p className="text-slate-600">{formatDate(log.recordedAtUtc)} · {formatTime(log.recordedAtUtc)}</p></div><span className="capitalize">{log.action}</span>
    </div>)}{!review.medicationLogs.length&&<p className="text-sm text-slate-600">No medication actions recorded this week.</p>}</div>
   </details>
   {review.checkIns.length>0&&<p className="mb-4 text-sm text-slate-700">{review.checkIns.length} daily check-in{review.checkIns.length===1?'':'s'} completed this week.</p>}
   <label className="block text-sm font-bold text-slate-900">Personal reflection & notes
    <textarea value={personalNotes} onChange={event=>setPersonalNotes(event.target.value)} rows={3} data-daybridge-draft={personalNotes?'true':undefined} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-normal text-slate-800" placeholder="Add your own reflection for this week…"/>
   </label>
   <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600"><p>Participant signature: __________________________</p><p>Date: __________________</p></div>
  </div>
 </div>;
};
