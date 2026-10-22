'use client';
import React,{useState} from 'react';
import {Pill} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';

const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const validTime=(t:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export function MedicationScheduleManager(){
 const {medications,medicationSchedules,replaceMedicationSchedules}=useDayBridge();
 const [editing,setEditing]=useState<string|null>(null);
 const [times,setTimes]=useState<string[]>([]);
 const [days,setDays]=useState<number[]>([]);
 const [error,setError]=useState('');
 function open(id:string){
   const current=medicationSchedules.filter(s=>s.medicationId===id);
   setTimes(current.length?[...new Set(current.map(s=>s.timeOfDay))].sort():['08:00']);
   setDays(current.length?[...new Set(current.flatMap(s=>s.daysOfWeek))].sort():[0,1,2,3,4,5,6]);
   setEditing(id);setError('');
 }
 function save(){
  if(!editing)return;
  if(!times.length||times.length>8||new Set(times).size!==times.length||!times.every(validTime)||!days.length){setError('Select at least one day and enter unique, valid dose times.');return}
  replaceMedicationSchedules(editing,times,days);
  setEditing(null);setError('');
 }
 const recurring=medications.filter(m=>m.isActive&&!m.isPrn);
 return <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3" aria-label="Medication schedules">
  <div className="flex items-center gap-2"><Pill className="h-5 w-5 text-teal-800"/><h3 className="font-bold text-slate-900">Medication schedules</h3></div>
  <p className="text-xs text-slate-600">Edit dose times without deleting your medication or its history. Follow the prescribed schedule.</p>
  {!recurring.length&&<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">No scheduled medications yet. Choose Add Medication above to start.</p>}
  {recurring.map(m=>{
   const rows=medicationSchedules.filter(s=>s.medicationId===m.id);
   return <div key={m.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-sm text-slate-900">{m.name}</p>
      <p className="text-xs text-slate-700">{rows.length?rows.map(s=>s.timeOfDay).sort().join(' · '):'No times set'} · {rows.length&&rows.every(s=>s.daysOfWeek.length===7)?'Every day':'Selected days'}</p></div>
      <button type="button" onClick={()=>editing===m.id?setEditing(null):open(m.id)} className="shrink-0 rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-900">{editing===m.id?'Cancel':'Edit times'}</button>
    </div>
    {editing===m.id&&<div className="space-y-3 border-t border-slate-200 pt-3">
     <fieldset className="space-y-2"><legend className="text-xs font-semibold text-slate-800">Dose times</legend>
      {times.map((time,i)=><div key={i} className="flex items-center gap-2">
       <label className="flex-1 text-xs">Dose {i+1}<input type="time" required value={time} onChange={e=>setTimes(prev=>prev.map((v,j)=>j===i?e.target.value:v))} className="mt-1 block w-full rounded-lg border border-slate-300 p-2"/></label>
       {times.length>1&&<button type="button" onClick={()=>setTimes(prev=>prev.filter((_,j)=>j!==i))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-rose-700">Remove</button>}
      </div>)}
      {times.length<8&&<button type="button" onClick={()=>setTimes(prev=>[...prev,'20:00'])} className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900">+ Add a time</button>}
     </fieldset>
     <fieldset><legend className="text-xs font-semibold text-slate-800">Days to repeat</legend>
      <div className="mt-2 grid grid-cols-7 gap-1">{weekdays.map((day,i)=><label key={day} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-1 text-[11px]"><input type="checkbox" checked={days.includes(i)} onChange={e=>setDays(prev=>e.target.checked?[...prev,i].sort():prev.filter(d=>d!==i))}/>{day}</label>)}</div>
     </fieldset>
     {error&&<p role="alert" className="text-xs text-rose-800">{error}</p>}
     <button type="button" onClick={save} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white">Save dose schedule</button>
    </div>}
   </div>
  })}
 </section>;
}
