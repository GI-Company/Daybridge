import type {CalendarEvent,EventOccurrence,MedicationLog,TaskItem,MoneyTransaction} from './types';
import {expandEventOccurrences} from './recurrence.ts';
import {safeTimezone,shiftDay,wallTime,zonedParts} from './notifications/time.ts';
export function weeklyReview(records:{events:CalendarEvent[];eventOccurrences:EventOccurrence[];medicationLogs:MedicationLog[];tasks:TaskItem[];transactions:MoneyTransaction[]},now=new Date(),timezone?:string){
 const zone=safeTimezone(timezone),today=zonedParts(now,zone).slice(0,10);
 const start=new Date(wallTime(shiftDay(today,-6)+'T00:00:00',zone));
 const upcomingEnd=new Date(wallTime(shiftDay(today,7)+'T23:59:59',zone));
 const within=(value?:string)=>Boolean(value&&Date.parse(value)>=start.getTime()&&Date.parse(value)<=now.getTime());
 const occurrences=records.events.flatMap(event=>expandEventOccurrences(event,start,upcomingEnd,records.eventOccurrences)).sort((a,b)=>a.startTime.getTime()-b.startTime.getTime());
 return {start,occurrences,
  attended:records.eventOccurrences.filter(o=>o.attendanceStatus==='attended_self_reported'&&within(o.attendanceRecordedAt)),
  checkIns:records.eventOccurrences.filter(o=>within(o.checkInCompletedAt)),
  medicationLogs:records.medicationLogs.filter(l=>within(l.recordedAtUtc)),
  completedTasks:records.tasks.filter(t=>t.completed&&within(t.completedAt)),
  spentCents:Math.abs(records.transactions.filter(tx=>{
   const day=tx.transactionDate.slice(0,10);return day>=zonedParts(start,zone).slice(0,10)&&day<=today&&tx.amountCents<0;
  }).reduce((sum,tx)=>sum+tx.amountCents,0))};
}
export function occurrenceStatus(occurrence:ReturnType<typeof expandEventOccurrences>[number],now=new Date()):string{
 if(occurrence.attendanceStatus==='cancelled')return 'Cancelled';
 if(occurrence.checkInCompletedAt)return 'Completed';
 if(occurrence.attendanceStatus==='attended_self_reported')return 'Attended (self-reported)';
 if(occurrence.attendanceStatus==='not_attended_self_reported')return 'Not attended (self-reported)';
 if(occurrence.startTime>now)return 'Upcoming';
 if(occurrence.endTime>now)return 'In progress';
 return 'Not yet recorded';
}
export function reviewCSV(rows:string[][]):string{
 // Keep commas/newlines intact and prevent spreadsheet formulas in user-entered text.
 return rows.map(row=>row.map(value=>'"'+(/^[=+\-@\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
