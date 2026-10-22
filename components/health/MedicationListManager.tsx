'use client';

import React,{useState} from 'react';
import {ArchiveRestore,Pill,Trash2,X} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';

/**
 * Medication records are private user-maintained organizer entries.
 * Removal is reversible and preserves dose logs. Permanent deletion is
 * deliberately separate and also deletes dependent schedules and logs.
 */
export function MedicationListManager(){
 const {medications,medicationSchedules,medicationLogs,updateMedication,deleteMedication}=useDayBridge();
 const [pendingRemoval,setPendingRemoval]=useState<string|null>(null);
 const [status,setStatus]=useState('');
 const active=medications.filter(m=>m.isActive);
 const removed=medications.filter(m=>!m.isActive);

 function archive(id:string){
  const med=medications.find(m=>m.id===id);
  if(!med||!med.isActive)return;
  updateMedication(id,{isActive:false});
  setPendingRemoval(null);
  setStatus(med.name+' removed from your active list. Dose history is preserved.');
 }
 function restore(id:string){
  const med=medications.find(m=>m.id===id);
  if(!med||med.isActive)return;
  updateMedication(id,{isActive:true});
  setStatus(med.name+' restored. Review its schedule to ensure it is still accurate.');
 }
 function permanentlyDelete(id:string){
  const med=medications.find(m=>m.id===id);
  if(!med||med.isActive)return;
  const count=medicationLogs.filter(log=>log.medicationId===id).length;
  if(!window.confirm('Permanently delete '+med.name+' from DayBridge, including '+
   count+' recorded dose '+(count===1?'entry':'entries')+' and all saved dose times? This cannot be undone.'))return;
  deleteMedication(id);
  setStatus(med.name+' permanently deleted from your private records.');
 }
 return <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Manage medications">
  <div className="flex items-center gap-2">
   <Pill aria-hidden="true" className="h-5 w-5 text-teal-800"/>
   <h3 className="text-base font-bold text-slate-950">My medications</h3>
   <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{active.length} active</span>
  </div>
  <p className="text-xs text-slate-700">Manage medication entries in DayBridge. Removing an entry stops it appearing in your daily dose list; it does not change your prescription.</p>
  {status&&<p role="status" aria-live="polite" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-950">{status}</p>}
  {!active.length&&<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">No active medications. Use Add Medication above to create an entry.</p>}
  <div className="space-y-2">
   {active.map(med=>{
    const schedules=medicationSchedules.filter(s=>s.medicationId===med.id);
    const pending=pendingRemoval===med.id;
    return <div key={med.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
       <strong className="block break-words text-sm text-slate-950">{med.name}{med.strengthText?' · '+med.strengthText:''}</strong>
       <p className="text-xs text-slate-600">{med.isPrn?'As needed':schedules.length?schedules.map(s=>s.timeOfDay).sort().join(' · '):'No dose times set'}</p>
      </div>
      <button type="button" onClick={()=>{setPendingRemoval(pending?null:med.id);setStatus('');}}
       aria-expanded={pending} aria-controls={'confirm-remove-'+med.id}
       className="min-h-[44px] rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800">
       {pending?'Cancel':'Remove'}
      </button>
     </div>
     {pending&&<div id={'confirm-remove-'+med.id} className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <p className="text-sm text-slate-800">Remove <strong>{med.name}</strong> from your active list? Daily dose slots and refill estimates will stop appearing. Previous dose history will be kept.</p>
      <div className="flex flex-wrap gap-2">
       <button type="button" onClick={()=>archive(med.id)}
        className="min-h-[44px] rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white">Remove from my list</button>
       <button type="button" onClick={()=>setPendingRemoval(null)}
        className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800">Keep medication</button>
      </div>
     </div>}
    </div>;
   })}
  </div>
  {removed.length>0&&<details className="rounded-xl border border-slate-200 bg-white p-3">
   <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-semibold text-slate-900">Removed medications ({removed.length})</summary>
   <p className="mb-3 text-xs text-slate-700">Dose history is retained unless you choose permanent deletion. Restoring also restores any saved dose times.</p>
   <div className="space-y-2">{removed.map(med=>
    <div key={med.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
     <div className="min-w-0 flex-1"><strong className="block break-words text-sm text-slate-900">{med.name}</strong>
      <span className="text-xs text-slate-600">{med.strengthText}</span>
     </div>
     <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>restore(med.id)} className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-bold text-teal-900">
       <ArchiveRestore aria-hidden="true" className="h-4 w-4"/>Restore
      </button>
      <button type="button" onClick={()=>permanentlyDelete(med.id)}
       className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800">
       <Trash2 aria-hidden="true" className="h-4 w-4"/>Delete permanently
      </button>
     </div>
    </div>
   )}</div>
  </details>}
 </section>;
}
