import type {UserProfile,CalendarEvent,EventOccurrence,TaskItem,Medication,MedicationSchedule,MedicationLog,Bill} from '../types';
import {notificationURL,type NotificationDestination} from './destination.ts';
import {calendarInstances,inQuietHours,safeTimezone,shiftDay,wallTime,zonedParts} from './time.ts';
export type ReminderKind='event'|'task'|'medication'|'bill'|'refill';
export type NotificationPreferences=Partial<Record<ReminderKind,boolean>>;
export type ReminderSnapshot={profile?:Partial<UserProfile>;events?:CalendarEvent[];eventOccurrences?:EventOccurrence[];tasks?:TaskItem[];medications?:Medication[];medicationSchedules?:MedicationSchedule[];medicationLogs?:MedicationLog[];bills?:Bill[]};
export type DueReminder={key:string;kind:ReminderKind;sourceId:string;due:number;expires:number;url:string;title:string;body:string;silent:boolean};
/** Rebuild from the latest synced records each pass; completed/cancelled items disappear before retries. */
export function dueReminders(snapshot:ReminderSnapshot,userId:string,now:number):DueReminder[]{
 const profile=snapshot.profile||{},zone=safeTimezone(profile.timezone),today=zonedParts(now,zone).slice(0,10);
 const lead=Math.max(0,Math.min(120,profile.reminderLeadMinutes??30))*60000;
 const enabled=profile.notificationPreferences||{};
 const reminders:DueReminder[]=[];
 const add=(kind:ReminderKind,sourceId:string,slot:string,due:number,expires:number,target:NotificationDestination)=>{
  if(enabled[kind]===false||!Number.isFinite(due)||due>now||now>=expires||now-due>30*60000)return;
  reminders.push({kind,sourceId,due,expires,key:[kind,sourceId,slot].join(':'),url:notificationURL({...target,account:userId}),
   title:'DayBridge reminder',body:'Open DayBridge to review a scheduled item.',
   silent:inQuietHours(now,zone,profile.quietHoursStart,profile.quietHoursEnd)});
 };
 for(const event of snapshot.events||[]){
  for(const instance of calendarInstances(event,snapshot.eventOccurrences||[],now-86400000,now+86400000)){
   if(instance.status!=='unconfirmed'||instance.end<=now)continue;
   const day=zonedParts(instance.start,safeTimezone(event.timezone)).slice(0,10);
   add('event',event.id,String(instance.originalStart),instance.start-lead,Math.min(instance.end,instance.start+15*60000),{tab:'schedule',event:event.id,date:day});
  }
 }
 for(const task of snapshot.tasks||[]){
  if(task.completed||!task.dueDate)continue;
  const due=wallTime(task.dueDate.length===10?task.dueDate+'T09:00:00':task.dueDate,zone);
  add('task',task.id,String(due),due,due+30*60000,{tab:'tasks',task:task.id});
 }
 for(const med of snapshot.medications||[]){
  if(!med.isActive)continue;
  if(!med.isPrn)for(const schedule of (snapshot.medicationSchedules||[]).filter(s=>s.medicationId===med.id)){
   for(const day of [shiftDay(today,-1),today]){
    if(!schedule.daysOfWeek.includes(new Date(day+'T12:00:00Z').getUTCDay()))continue;
    const slot=wallTime(day+'T'+schedule.timeOfDay+':00',zone);if(!Number.isFinite(slot))continue;
    const iso=new Date(slot).toISOString();
    const log=[...(snapshot.medicationLogs||[])].reverse().find(l=>l.medicationId===med.id&&l.scheduledSlotUtc===iso);
    if(log&&log.action!=='snoozed')continue;
    const due=log?Date.parse(log.recordedAtUtc)+15*60000:slot;
    add('medication',med.id,schedule.id+':'+iso+(log?':snooze:'+log.recordedAtUtc:''),due,Math.min(slot+2*3600000,due+30*60000),{tab:'health',medication:med.id,date:day,slot:iso});
   }
  }
  if(med.refillDueDate){
   const due=wallTime(med.refillDueDate.slice(0,10)+'T09:00:00',zone);
   add('refill',med.id,med.refillDueDate,due,due+30*60000,{tab:'health',medication:med.id});
  }
 }
 for(const bill of snapshot.bills||[]){
  if(bill.isPaid)continue;
  const due=wallTime(bill.nextDueDate+'T09:00:00',zone);
  add('bill',bill.id,bill.nextDueDate,due,due+30*60000,{tab:'money',bill:bill.id});
 }
 return reminders.sort((a,b)=>a.due-b.due);
}
