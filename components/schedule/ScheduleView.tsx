'use client';

import React,{useEffect,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Plus,AlertTriangle,CheckCircle2,XCircle,
  HelpCircle,ExternalLink,Trash2,MapPin} from 'lucide-react';
import {safeExternalURL} from '../../lib/security/urls';
import {useDayBridge} from '../../lib/storage/store';
import {expandEventOccurrences,detectEventConflicts} from '../../lib/recurrence';
import {formatTime,formatDate,getRelativeDayLabel} from '../../lib/date-time';
import {calendarDayKey,calendarMonthDays,calendarMove,calendarRange,calendarSameDay} from '../../lib/calendar';
import type {EventCategory} from '../../lib/types';
import {TravelPlanner} from '../travel/TravelPlanner';

interface ScheduleViewProps {
 onOpenQuickAdd:(date?:string)=>void;
 focusDate?:string;
 focusEventId?:string;
 focusRevision?:number;
}
type Occurrence=ReturnType<typeof expandEventOccurrences>[number];
type CalendarMode='month'|'week';

const categoryLabels:Record<EventCategory,string>={
 court:'Court',class:'Class / group',self_help:'Self-help meeting',drug_testing:'Drug test',
 therapy:'Therapy',work:'Work',case_management:'Case management',personal:'Personal',other:'Other'
};
const categoryDot:Record<EventCategory,string>={
 court:'bg-amber-600',class:'bg-violet-600',self_help:'bg-emerald-700',
 drug_testing:'bg-rose-600',therapy:'bg-sky-600',work:'bg-indigo-600',
 case_management:'bg-amber-700',personal:'bg-teal-700',other:'bg-slate-600'
};
const weekLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const ScheduleView:React.FC<ScheduleViewProps>=({onOpenQuickAdd,focusDate,focusEventId,focusRevision})=>{
 const {events,eventOccurrences,recordAttendance,deleteEvent}=useDayBridge();
 const [view,setView]=useState<CalendarMode>('month');
 const [selectedDate,setSelectedDate]=useState(()=>new Date());
 useEffect(()=>{
  if(!focusDate||!/^\d{4}-\d{2}-\d{2}$/.test(focusDate))return;
  const date=new Date(focusDate+'T12:00:00');
  if(Number.isFinite(date.getTime()))setSelectedDate(date);
 },[focusDate]);
 const [selectedCategory,setSelectedCategory]=useState<EventCategory|'all'>('all');
 const [selectedOccurrence,setSelectedOccurrence]=useState<Occurrence|null>(null);
 const [notificationNotice,setNotificationNotice]=useState('');
 const handledFocus=React.useRef('');
 useEffect(()=>{
  if(!focusEventId||!focusDate)return;
  const key=[focusEventId,focusDate,focusRevision].join(':');if(handledFocus.current===key)return;
  const source=events.find(event=>event.id===focusEventId);if(!source)return;
  const start=new Date(focusDate+'T00:00:00'),end=new Date(focusDate+'T23:59:59.999');
  const occurrence=expandEventOccurrences(source,start,end,eventOccurrences)[0];
  if(!occurrence){setNotificationNotice('This appointment has moved or is no longer scheduled for the notification date.');return;}
  handledFocus.current=key;setSelectedCategory('all');setSelectedOccurrence(occurrence);setNotificationNotice('');
 },[focusEventId,focusDate,focusRevision,events,eventOccurrences]);
 const currentDay=new Date();
 const {start:rangeStart,end:rangeEnd,days}=calendarRange(selectedDate,view);
 const allOccurrences=events.flatMap(event=>expandEventOccurrences(event,rangeStart,rangeEnd,eventOccurrences))
   .sort((a,b)=>a.startTime.getTime()-b.startTime.getTime());
 const filteredOccurrences=allOccurrences.filter(occ=>selectedCategory==='all'||occ.category===selectedCategory);
 const selectedDayOccurrences=filteredOccurrences.filter(occ=>calendarSameDay(occ.startTime,selectedDate));
 const conflicts=detectEventConflicts(filteredOccurrences);
 const selectedIds=new Set(selectedDayOccurrences.map(occ=>occ.eventId));
 const dayConflicts=conflicts.filter(c=>selectedIds.has(c.eventId1)||selectedIds.has(c.eventId2));
 const startLabel=view==='month'
  ?selectedDate.toLocaleDateString(undefined,{month:'long',year:'numeric'})
  :days[0].toLocaleDateString(undefined,{month:'short',day:'numeric'})+' – '+
     days[6].toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
 const monthDate=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
 const monthDays=calendarMonthDays(selectedDate); // six full calendar rows
 const visibleDays=view==='month'?monthDays:days;
 const onDayClick=(day:Date)=>setSelectedDate(new Date(day.getFullYear(),day.getMonth(),day.getDate()));

 return (
 <div className="space-y-4 pb-24">
  {notificationNotice&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{notificationNotice}</p>}
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">Schedule</h2>
    <p className="text-xs text-slate-600">Your appointments, classes, meetings, and shifts in one calendar</p>
   </div>
   <button type="button" onClick={()=>onOpenQuickAdd(calendarDayKey(selectedDate))}
    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">
    <Plus aria-hidden="true" className="h-4 w-4"/>Add event
   </button>
  </header>

  <section aria-label="Schedule calendar" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Calendar view">
      {(['month','week'] as const).map(mode=><button type="button" key={mode} onClick={()=>setView(mode)}
       aria-pressed={view===mode}
       className={'min-h-[40px] rounded-lg px-4 text-sm font-semibold transition '+
        (view===mode?'bg-teal-700 text-white shadow-sm':'text-slate-700 hover:bg-white')}>
       {mode==='month'?'Month':'Week'}
      </button>)}
     </div>
     <div className="flex items-center gap-1.5">
      <button type="button" aria-label={view==='month'?'Previous month':'Previous week'}
       onClick={()=>setSelectedDate(d=>calendarMove(d,view,-1))}
       className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50">
       <ChevronLeft className="h-5 w-5"/>
      </button>
      <button type="button" onClick={()=>setSelectedDate(new Date())}
       className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-teal-900">Today</button>
      <button type="button" aria-label={view==='month'?'Next month':'Next week'}
       onClick={()=>setSelectedDate(d=>calendarMove(d,view,1))}
       className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50">
       <ChevronRight className="h-5 w-5"/>
      </button>
     </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h3 className="text-lg font-bold text-slate-950" aria-live="polite">{startLabel}</h3>
     <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">Jump to date
      <input type="date" value={calendarDayKey(selectedDate)}
       onChange={e=>{if(e.target.value){const target=new Date(e.target.value+'T12:00:00');if(!Number.isNaN(target.getTime()))onDayClick(target);}}}
       className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"/>
     </label>
    </div>
    <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
     <span>Show</span>
     <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value as EventCategory|'all')}
      className="min-h-[44px] max-w-[72%] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
      <option value="all">Everything</option>
      {(Object.keys(categoryLabels) as EventCategory[]).map(cat=><option key={cat} value={cat}>{categoryLabels[cat]}</option>)}
     </select>
    </label>
   </div>

   <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50" aria-hidden="true">
    {weekLabels.map(label=><div className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs" key={label}>{label}</div>)}
   </div>
   <div className="grid grid-cols-7 gap-px bg-slate-200 p-px" aria-label={view==='month'?'Month dates':'Week dates'}>
    {visibleDays.map(day=>{
     const dateKey=calendarDayKey(day);
     const dayEvents=filteredOccurrences.filter(occ=>calendarSameDay(occ.startTime,day));
     const isSelected=calendarSameDay(day,selectedDate);
     const isToday=calendarSameDay(day,currentDay);
     const isCurrentMonth=day.getMonth()===monthDate.getMonth()&&day.getFullYear()===monthDate.getFullYear();
     const style=dayEvents.length>0?'font-bold':'font-medium';
     return <button key={dateKey} type="button" onClick={()=>onDayClick(day)}
      aria-pressed={isSelected}
      aria-label={day.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+
       ', '+dayEvents.length+' scheduled item'+(dayEvents.length===1?'':'s')}
      className={'flex min-w-0 flex-col items-center gap-1 overflow-hidden p-1.5 text-left transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-800 sm:items-stretch sm:p-2 '+
       (view==='week'?'min-h-[105px] sm:min-h-[150px]':'min-h-[66px] sm:min-h-[110px]')+' '+
       (isSelected?'bg-teal-100 ring-2 ring-inset ring-teal-700':'bg-white hover:bg-teal-50')+' '+
       (!isCurrentMonth&&view==='month'?'text-slate-400':'text-slate-900')}>
      <span className={'inline-flex h-7 min-w-7 items-center justify-center self-center rounded-full px-1 text-xs '+style+
       (isToday?' bg-teal-800 text-white':'')}>{day.getDate()}</span>
      {dayEvents.length>0&&<div className="flex w-full flex-col items-center gap-1 sm:items-stretch">
       <span className="flex items-center justify-center gap-0.5 sm:hidden" aria-hidden="true">
        {dayEvents.slice(0,3).map((event,i)=><span key={event.id+'-'+i} className={'h-1.5 w-1.5 rounded-full '+categoryDot[event.category]}/>)}
       </span>
       <span className="text-[10px] font-bold text-slate-700 sm:hidden">{dayEvents.length}</span>
       <div className="hidden space-y-1 sm:block">
        {dayEvents.slice(0,view==='week'?4:2).map(event=><span key={event.id}
         className="block truncate rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-900">
         <span aria-hidden="true" className={'mr-1 inline-block h-1.5 w-1.5 rounded-full '+categoryDot[event.category]}/>
         {formatTime(event.startTime)} {event.title}
        </span>)}
        {dayEvents.length>(view==='week'?4:2)&&<span className="block text-[10px] font-semibold text-slate-700">
         +{dayEvents.length-(view==='week'?4:2)} more
        </span>}
       </div>
      </div>}
     </button>;
    })}
   </div>
   <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-[11px] text-slate-600">
    {(['court','class','self_help','work','personal'] as EventCategory[]).map(category=>
     <span key={category} className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={'h-2 w-2 rounded-full '+categoryDot[category]}/>{categoryLabels[category]}
     </span>)}
   </div>
  </section>

  <section className="space-y-3" aria-label="Selected day schedule">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
     <h3 className="text-lg font-bold text-slate-950">{getRelativeDayLabel(selectedDate)} · {formatDate(selectedDate)}</h3>
     <p className="text-xs text-slate-600">{selectedDayOccurrences.length} scheduled item{selectedDayOccurrences.length===1?'':'s'}</p>
    </div>
    <button type="button" onClick={()=>onOpenQuickAdd(calendarDayKey(selectedDate))}
     className="min-h-[44px] rounded-xl border border-teal-300 bg-white px-3 text-sm font-semibold text-teal-900">
     + Add for this day
    </button>
   </div>

   {dayConflicts.length>0&&<details className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold">
     <AlertTriangle className="h-4 w-4"/> {dayConflicts.length} scheduling notice{dayConflicts.length===1?'':'s'}
    </summary>
    <div className="mt-2 space-y-1">{dayConflicts.map((item,i)=><p key={i}>{item.explanation}</p>)}</div>
   </details>}

   {selectedDayOccurrences.length?selectedDayOccurrences.map(occ=><button type="button" key={occ.id}
    onClick={()=>setSelectedOccurrence(occ)}
    className="flex min-h-[70px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
    <span aria-hidden="true" className={'h-11 w-1 shrink-0 rounded '+categoryDot[occ.category]}/>
    <span className="min-w-0 flex-1">
     <span className="block text-xs font-semibold text-teal-900">{formatTime(occ.startTime)} – {formatTime(occ.endTime)}</span>
     <strong className="block truncate text-sm text-slate-950">{occ.title}</strong>
     <span className="block truncate text-xs text-slate-600">
      {categoryLabels[occ.category]}{occ.location?' · '+occ.location:''}
     </span>
    </span>
    {occ.attendanceStatus==='attended_self_reported'
     ?<CheckCircle2 aria-label="Self-reported attended" className="h-5 w-5 shrink-0 text-emerald-700"/>
     :occ.attendanceStatus==='not_attended_self_reported'
      ?<XCircle aria-label="Self-reported missed" className="h-5 w-5 shrink-0 text-rose-700"/>
      :<ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500"/>}
   </button>):<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
    <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-400"/>
    <p className="font-semibold text-slate-800">Nothing scheduled for this day</p>
    <p className="mt-1 text-xs text-slate-600">Choose another date or add an appointment, class, or meeting.</p>
   </div>}
  </section>

      {/* Detail & Self-Report Attendance Modal */}
      {selectedOccurrence && (
        <div data-daybridge-draft="true" role="dialog" aria-modal="true" aria-label="Appointment details" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  {selectedOccurrence.category==='self_help'?'Self-help meeting':selectedOccurrence.category.replace('_', ' ')}
                </span>
                <h3 className="font-bold text-lg text-slate-900">{selectedOccurrence.title}</h3>
              </div>
              <button
                onClick={() => setSelectedOccurrence(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <div className="text-slate-600">Date & Time:</div>
                <div className="text-sm font-semibold text-slate-800">
                  {formatDate(selectedOccurrence.startTime)} from{' '}
                  {formatTime(selectedOccurrence.startTime)} – {formatTime(selectedOccurrence.endTime)}
                </div>
                {selectedOccurrence.travelBufferMinutes > 0 && (
                  <div className="text-teal-800 text-[11px]">
                    Includes {selectedOccurrence.travelBufferMinutes} minutes travel buffer
                  </div>
                )}
              </div>

              {selectedOccurrence.location && (
                <div>
                  <div className="text-slate-600 mb-1">Location:</div>
                  <div className="text-slate-800 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {selectedOccurrence.location}
                  </div>
                </div>
              )}

              {safeExternalURL(selectedOccurrence.meetingUrl) && (
                <div>
                  <div className="text-slate-600 mb-1">Virtual Meeting Link:</div>
                  <a
                    href={safeExternalURL(selectedOccurrence.meetingUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-teal-700 p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{selectedOccurrence.meetingUrl}</span>
                  </a>
                </div>
              )}

              {selectedOccurrence.venueType === 'in_person' && <TravelPlanner key={selectedOccurrence.eventId+'-'+selectedOccurrence.startTime.toISOString()} eventId={selectedOccurrence.eventId} title={selectedOccurrence.title} startTime={selectedOccurrence.startTime} location={selectedOccurrence.location}/>} 

              {/* Attendance Recording */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Self-Report Attendance
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      recordAttendance(
                        selectedOccurrence.id,
                        selectedOccurrence.eventId,
                        'attended_self_reported',
                        'Attended as scheduled', selectedOccurrence.startTime.toISOString(), selectedOccurrence.endTime.toISOString()
                      );
                      setSelectedOccurrence((prev: any) => ({
                        ...prev,
                        attendanceStatus: 'attended_self_reported',
                      }));
                    }}
                    className={`p-3 rounded-xl font-bold min-h-[44px] transition flex items-center justify-center gap-2 border ${
                      selectedOccurrence.attendanceStatus === 'attended_self_reported'
                        ? 'bg-emerald-500/20 text-emerald-800 border-emerald-500/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attended</span>
                  </button>

                  <button
                    onClick={() => {
                      recordAttendance(
                        selectedOccurrence.id,
                        selectedOccurrence.eventId,
                        'not_attended_self_reported',
                        'Self-reported absence', selectedOccurrence.startTime.toISOString(), selectedOccurrence.endTime.toISOString()
                      );
                      setSelectedOccurrence((prev: any) => ({
                        ...prev,
                        attendanceStatus: 'not_attended_self_reported',
                      }));
                    }}
                    className={`p-3 rounded-xl font-bold min-h-[44px] transition flex items-center justify-center gap-2 border ${
                      selectedOccurrence.attendanceStatus === 'not_attended_self_reported'
                        ? 'bg-rose-500/20 text-rose-800 border-rose-500/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Not Attended</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 italic">
                  * Reminder: Attendance is personal self-reported documentation and does not constitute official court verification.
                </p>
              </div>

              {/* Delete Event Series */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <button
                  onClick={() => {
                    if (confirm('Delete this event?')) {
                      deleteEvent(selectedOccurrence.eventId);
                      setSelectedOccurrence(null);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-800 p-2 rounded-lg hover:bg-rose-950/40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Event</span>
                </button>

                <button
                  onClick={() => setSelectedOccurrence(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
