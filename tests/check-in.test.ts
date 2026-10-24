import test from 'node:test';
import assert from 'node:assert/strict';
import type {CalendarEvent,EventOccurrence} from '../lib/types.ts';
import {calendarInstances,wallTime,zonedParts} from '../lib/notifications/time.ts';
import {dueReminders} from '../lib/notifications/reminders.ts';
import {expandEventOccurrences} from '../lib/recurrence.ts';
import {scheduledTrips} from '../lib/travel/scheduled-trips.ts';
const zone='America/New_York',user='check-in-owner';
const at=(value:string)=>wallTime(value,zone);
const event:CalendarEvent={id:'check-in',userId:user,title:'Drug test check-in',category:'drug_testing',description:'',
 startTime:'2026-10-24T08:00:00',endTime:'2026-10-24T10:07:00',timezone:zone,venueType:'phone',
 rrule:'FREQ=DAILY',checkInReminderMinutes:15,travelBufferMinutes:0,prepChecklist:[],createdAt:'',updatedAt:''};
const profile={timezone:zone,reminderLeadMinutes:30};
const reminders=(time:string,occurrences:EventOccurrence[]=[])=>dueReminders({profile,events:[event],eventOccurrences:occurrences},user,at(time));
const completed:EventOccurrence={id:'completion',eventId:event.id,userId:user,startTimeUtc:new Date(at(event.startTime)).toISOString(),
 endTimeUtc:new Date(at(event.endTime)).toISOString(),attendanceStatus:'unconfirmed',isException:false,checkInCompletedAt:'2026-10-24T12:04:00Z'};
test('check-in reminders start at the window, repeat at 15-minute slots, and end exactly at the end time',()=>{
 assert.equal(reminders('2026-10-24T07:59:59').length,0);
 const seen=new Set<string>();
 for(let minute=0;minute<=120;minute+=15){
  const time=new Date(at(event.startTime)+minute*60000),next=dueReminders({profile,events:[event]},user,time.getTime());
  assert.equal(next.length,1);assert.equal(next[0].due,time.getTime());
  seen.add(next[0].key);
  assert.equal(next[0].expires,Math.min(time.getTime()+15*60000,at(event.endTime)));
  assert.equal(next[0].key,dueReminders({profile,events:[event]},user,time.getTime()+59000)[0].key);
  assert.match(next[0].url,/tab=schedule&event=check-in&date=2026-10-24/);
 }
 assert.equal(seen.size,9);
 assert.equal(reminders('2026-10-24T10:06:59').length,1);
 assert.equal(reminders('2026-10-24T10:07:00').length,0);
 assert.equal(reminders('2026-10-24T23:59:00').length,0);
});
test('a late monitor selects only the current slot and never queues missed slots',()=>{
 const [due]=reminders('2026-10-24T09:44:59');
 assert.equal(zonedParts(due.due,zone),'2026-10-24T09:30:00');
 assert.equal(reminders('2026-10-24T09:44:59').length,1);
 assert.notEqual(due.key,reminders('2026-10-24T09:45:00')[0].key);
});
test('done stops only that day, undo resumes its current slot, and tomorrow has an independent identity',()=>{
 assert.equal(reminders('2026-10-24T08:16:00',[completed]).length,0);
 assert.equal(reminders('2026-10-25T08:16:00',[completed]).length,1);
 assert.equal(reminders('2026-10-24T08:16:00',[{...completed,checkInCompletedAt:undefined}]).length,1);
 const occurrences=expandEventOccurrences(event,new Date(at('2026-10-24T00:00:00')),new Date(at('2026-10-25T23:59:59')),[completed]);
 assert.equal(occurrences.length,2);assert.equal(occurrences[0].id,completed.id);
 assert.equal(occurrences[0].checkInCompletedAt,completed.checkInCompletedAt);
 assert.equal(occurrences[1].checkInCompletedAt,undefined);
 assert.equal(Date.parse(occurrences[1].originalStartTimeUtc),at('2026-10-25T08:00:00'));
 assert.equal(occurrences[0].attendanceStatus,'unconfirmed');
});
test('check-ins honor cancellation, event preferences and quiet hours without changing older testing appointments',()=>{
 const now=at('2026-10-24T08:01:00');
 assert.equal(reminders('2026-10-24T08:01:00',[{...completed,checkInCompletedAt:undefined,attendanceStatus:'cancelled'}]).length,0);
 assert.equal(dueReminders({profile:{...profile,notificationPreferences:{event:false}},events:[event]},user,now).length,0);
 assert.equal(dueReminders({profile:{...profile,quietHoursStart:'07:00',quietHoursEnd:'09:00'},events:[event]},user,now)[0].silent,true);
 const legacy={...event,checkInReminderMinutes:undefined,rrule:undefined,venueType:'in_person' as const};
 assert.equal(dueReminders({profile,events:[legacy]},user,at('2026-10-24T07:31:00')).length,1);
 assert.equal(dueReminders({profile,events:[legacy]},user,at('2026-10-24T08:16:00')).length,0);
 assert.deepEqual(scheduledTrips([event],[],[],new Date(now)),[]);
});
test('daily recurrence shares calendar/reminder identities across DST and respects intervals and moved occurrences',()=>{
 const daily={...event,startTime:'2026-10-31T08:00:00',endTime:'2026-10-31T10:07:00'};
 const from=at('2026-10-30T00:00:00'),to=at('2026-11-02T23:59:59');
 const instances=calendarInstances(daily,[],from,to);
 assert.deepEqual(instances.map(x=>new Date(x.start).toISOString()),['2026-10-31T12:00:00.000Z','2026-11-01T13:00:00.000Z','2026-11-02T13:00:00.000Z']);
 assert.deepEqual(expandEventOccurrences(daily,new Date(from),new Date(to)).map(x=>Date.parse(x.originalStartTimeUtc)),instances.map(x=>x.originalStart));
 assert.deepEqual(calendarInstances({...daily,rrule:'FREQ=DAILY;INTERVAL=2'},[],from,to).map(x=>zonedParts(x.start,zone).slice(0,10)),['2026-10-31','2026-11-02']);
 const moved={...completed,overrideStartTime:'2026-10-26T09:00:00',overrideEndTime:'2026-10-26T10:00:00'};
 const expanded=expandEventOccurrences({...event,rrule:undefined},new Date(at('2026-10-26T00:00:00')),new Date(at('2026-10-26T23:59:59')),[moved]);
 assert.equal(expanded.length,1);assert.equal(expanded[0].originalStartTimeUtc,completed.startTimeUtc);
 assert.equal(expanded[0].checkInCompletedAt,completed.checkInCompletedAt);
});
test('daily windows keep both wall-clock boundaries across daylight-saving transitions',()=>{
 const spring={...event,startTime:'2027-03-13T01:00:00',endTime:'2027-03-13T04:00:00'};
 const [instance]=calendarInstances(spring,[],at('2027-03-14T00:00:00'),at('2027-03-14T23:59:59'));
 assert.equal(zonedParts(instance.start,zone),'2027-03-14T01:00:00');assert.equal(zonedParts(instance.end,zone),'2027-03-14T04:00:00');
 assert.equal(instance.end-instance.start,2*3600000);
 assert.equal(calendarInstances({...spring,startTime:'2027-03-13T02:30:00'},[],at('2027-03-14T00:00:00'),at('2027-03-14T23:59:59')).length,0);
});
