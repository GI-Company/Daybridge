'use client';
import {CheckCircle2} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import {formatTime,formatDate} from '../../lib/date-time';
import type {expandEventOccurrences} from '../../lib/recurrence';
type Occurrence=ReturnType<typeof expandEventOccurrences>[number];
export function CheckInCard({occurrence,onChange}:{occurrence:Occurrence;onChange?:(done:boolean)=>void}){
 const {setCheckInDone,syncStatus}=useDayBridge();
 const done=Boolean(occurrence.checkInCompletedAt);
 return <section aria-label="Drug test check-in" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2">
  <h3 className="font-bold text-slate-950">{occurrence.title}</h3>
  <p className="text-sm text-slate-700">{formatDate(occurrence.startTime)} · {formatTime(occurrence.startTime)} – {formatTime(occurrence.endTime)}</p>
  <p role="status" className="text-sm text-slate-700">{done?(syncStatus==='synced'?'Done for this day. Reminders stopped.':'Done on this device. Waiting to sync so background reminders stop.'):'Check whether testing is required. Reminders every 15 minutes during this window.'}</p>
  <button type="button" onClick={()=>{setCheckInDone(occurrence.eventId,occurrence.originalStartTimeUtc,occurrence.endTime.toISOString(),!done);onChange?.(!done);}}
   className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white hover:bg-teal-900">
   <CheckCircle2 className="h-4 w-4"/>{done?'Undo done':'Mark done'}
  </button>
 </section>;
}
