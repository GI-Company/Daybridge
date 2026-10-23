import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNotificationDestination,notificationURL} from '../lib/notifications/destination.ts';
import {calendarInstances,wallTime,zonedParts,inQuietHours} from '../lib/notifications/time.ts';
import {getMedicationSlotsForDay} from '../lib/medication.ts';
import {dueReminders,type ReminderSnapshot} from '../lib/notifications/reminders.ts';
import type {CalendarEvent,Medication,MedicationSchedule,TaskItem,Bill,EventOccurrence} from '../lib/types.ts';
const user='account-1',zone='America/New_York';
const event={category:'personal',description:'',createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:00Z',id:'event-1',userId:user,title:'Private appointment',startTime:'2026-10-23T10:00:00',endTime:'2026-10-23T11:00:00',timezone:zone,venueType:'virtual',prepChecklist:[],travelBufferMinutes:0} as CalendarEvent;
const at=(value:string)=>wallTime(value,zone);
const profile={timezone:zone,reminderLeadMinutes:30,quietHoursStart:'22:00',quietHoursEnd:'07:00'};
test('notification destinations retain exact records and reject external URLs, invalid tabs and malformed dates',()=>{
 const target={tab:'schedule' as const,event:event.id,date:'2026-10-23',account:user};
 assert.deepEqual(parseNotificationDestination(notificationURL(target),'https://app.test'),target);
 assert.equal(parseNotificationDestination('https://evil.test/?tab=schedule','https://app.test'),null);
 assert.equal(parseNotificationDestination('/auth/callback?tab=schedule','https://app.test'),null);
 assert.equal(parseNotificationDestination('/?tab=unknown','https://app.test'),null);
 assert.deepEqual(parseNotificationDestination('/?tab=tasks&event=wrong&task=t-1&date=2026-02-30','https://app.test'),{tab:'tasks',task:'t-1'});
});
test('wall times use the profile zone on a UTC server and preserve weekly hours across DST',()=>{
 assert.equal(new Date(at('2026-10-23T10:00:00')).toISOString(),'2026-10-23T14:00:00.000Z');
 assert.equal(new Date(at('2026-11-06T10:00:00')).toISOString(),'2026-11-06T15:00:00.000Z');
 assert.ok(Number.isNaN(at('2027-03-14T02:30:00')));
 const instances=calendarInstances({...event,rrule:'FREQ=WEEKLY;BYDAY=MO,FR'},[],at('2026-10-30T00:00:00'),at('2026-11-06T23:59:59'));
 assert.deepEqual(instances.map(x=>new Date(x.start).toISOString()),['2026-10-30T14:00:00.000Z','2026-11-02T15:00:00.000Z','2026-11-06T15:00:00.000Z']);
});
test('appointment reminders respect their due window, quiet hours, exceptions and cancellation',()=>{
 const now=at('2026-10-23T09:31:00');
 const snapshot={profile,events:[event]};
 const [reminder]=dueReminders(snapshot,user,now);
 assert.equal(reminder.kind,'event');assert.match(reminder.url,/event=event-1/);assert.match(reminder.url,/account=account-1/);
 assert.equal(dueReminders(snapshot,user,at('2026-10-23T09:29:00')).length,0);
 assert.equal(dueReminders(snapshot,user,at('2026-10-23T10:16:00')).length,0);
 assert.equal(dueReminders({...snapshot,profile:{...profile,notificationPreferences:{event:false}}},user,now).length,0);
 const cancelled={eventId:event.id,startTimeUtc:new Date(at(event.startTime)).toISOString(),attendanceStatus:'cancelled'} as EventOccurrence;
 assert.equal(dueReminders({...snapshot,eventOccurrences:[cancelled]},user,now).length,0);
 const moved={...cancelled,attendanceStatus:'unconfirmed',overrideStartTime:'2026-10-24T10:00:00',overrideEndTime:'2026-10-24T11:00:00'} as EventOccurrence;
 assert.equal(dueReminders({...snapshot,eventOccurrences:[moved]},user,now).length,0);
 assert.equal(dueReminders({...snapshot,eventOccurrences:[moved]},user,at('2026-10-24T09:31:00'))[0].url.includes('date=2026-10-24'),true);
 assert.equal(dueReminders({...snapshot,profile:{...profile,reminderLeadMinutes:0}},user,at(event.startTime)).length,1);
 assert.equal(inQuietHours(at('2026-10-23T23:00:00'),zone,'22:00','07:00'),true);
 assert.equal(inQuietHours(now,zone,'22:00','07:00'),false);
});
test('task, bill and refill reminders stop when completed, paid, disabled or expired',()=>{
 const snapshot:ReminderSnapshot={profile,tasks:[{id:'task-1',dueDate:'2026-10-23T09:00:00',completed:false} as TaskItem],bills:[{id:'bill-1',nextDueDate:'2026-10-23',isPaid:false} as Bill],medications:[{id:'med-1',isActive:true,isPrn:true,refillDueDate:'2026-10-23'} as Medication]};
 const reminders=dueReminders(snapshot,user,at('2026-10-23T09:01:00'));
 assert.deepEqual(reminders.map(x=>x.kind).sort(),['bill','refill','task']);
 assert.match(reminders.find(x=>x.kind==='bill')!.url,/tab=money&bill=bill-1/);
 assert.equal(dueReminders({...snapshot,tasks:[{...snapshot.tasks![0],completed:true}],bills:[{...snapshot.bills![0],isPaid:true}],medications:[{...snapshot.medications![0],isActive:false}]},user,at('2026-10-23T09:01:00')).length,0);
 assert.equal(dueReminders(snapshot,user,at('2026-10-23T09:31:00')).length,0);
});
test('medication reminders select an exact dose, suppress taken/skipped, and honor a 15-minute snooze',()=>{
 const medication={id:'med-1',isActive:true,isPrn:false} as Medication;
 const schedule={id:'schedule-1',medicationId:medication.id,timeOfDay:'06:00',daysOfWeek:[5]} as MedicationSchedule;
 const snapshot={profile,medications:[medication],medicationSchedules:[schedule]};
 const slot=new Date(at('2026-10-23T06:00:00')).toISOString();
 const [reminder]=dueReminders(snapshot,user,at('2026-10-23T06:01:00'));
 assert.equal(reminder.silent,true);assert.match(reminder.url,/tab=health&medication=med-1/);
 assert.equal(parseNotificationDestination(reminder.url,'https://app.test')?.slot,slot);
 for(const action of ['taken','skipped'] as const)assert.equal(dueReminders({...snapshot,medicationLogs:[{id:'log-1',userId:user,medicationId:medication.id,scheduledSlotUtc:slot,recordedAtUtc:slot,action}]},user,at('2026-10-23T06:01:00')).length,0);
 const snoozed={...snapshot,medicationLogs:[{id:'log-1',userId:user,medicationId:medication.id,scheduledSlotUtc:slot,recordedAtUtc:slot,action:'snoozed' as const}]};
 assert.equal(dueReminders(snoozed,user,at('2026-10-23T06:14:00')).length,0);
 const [again]=dueReminders(snoozed,user,at('2026-10-23T06:15:00'));assert.notEqual(again.key,reminder.key);assert.equal(zonedParts(again.due,zone),'2026-10-23T06:15:00');
});

test('foreground medication slots and background reminders use the same profile-timezone identity',()=>{
 const med={id:'med-1',isActive:true,isPrn:false} as Medication;
 const schedule={id:'schedule-1',medicationId:med.id,timeOfDay:'08:00',daysOfWeek:[5]} as MedicationSchedule;
 const now=at('2026-10-23T08:01:00');
 const [slot]=getMedicationSlotsForDay([med],[schedule],[],new Date(now),zone);
 const [reminder]=dueReminders({profile,medications:[med],medicationSchedules:[schedule]},user,now);
 assert.equal(slot.scheduledTime,'2026-10-23T12:00:00.000Z');
 assert.equal(parseNotificationDestination(reminder.url,'https://app.test')?.slot,slot.scheduledTime);
});
