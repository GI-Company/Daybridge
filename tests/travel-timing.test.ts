import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalBuffer,arrivalTarget,travelTimes} from '../lib/travel/timing.ts';
import {wallTime,zonedParts} from '../lib/notifications/time.ts';
const start=new Date('2026-10-26T22:30:00Z');
const route={durationSeconds:1680,delaySeconds:300,distanceMeters:12000,historicSeconds:null,points:[]};
test('one arrival buffer and early-arrival target drive map, planner and notification requests',()=>{
 assert.equal(arrivalBuffer(0,15),15);assert.equal(arrivalBuffer(30,15),30);assert.equal(arrivalBuffer(undefined,15),15);
 assert.equal(arrivalTarget(start,15).toISOString(),'2026-10-26T22:15:00.000Z');
 const planned=travelTimes(route,'historical',new Date('2026-10-24T14:00Z'),start,15);
 assert.equal(planned.arrival.toISOString(),'2026-10-26T22:15:00.000Z');
 assert.equal(planned.departure?.toISOString(),'2026-10-26T21:47:00.000Z');
 // Traffic delay is already included in route duration; never add it a second time.
 assert.equal(planned.arrival.getTime()-planned.departure!.getTime(),route.durationSeconds*1000);
});
test('a live ETA is relative to now; a future forecast uses the provider arrival and departure',()=>{
 const now=new Date('2026-10-24T14:00Z');
 assert.equal(travelTimes(route,'live',now,start,15).arrival.toISOString(),'2026-10-24T14:28:00.000Z');
 const forecast=travelTimes({...route,departureTime:'2026-10-26T17:47:00-04:00',arrivalTime:'2026-10-26T18:15:00-04:00'},'historical',now,start,15);
 assert.equal(forecast.arrival.toISOString(),'2026-10-26T22:15:00.000Z');assert.equal(forecast.departure?.toISOString(),'2026-10-26T21:47:00.000Z');
});
test('appointment-zone times and departure dates remain correct across DST and midnight',()=>{
 for(const [appointment,expected] of [['2026-10-30T00:10:00','2026-10-29T23:27:00'],['2026-11-02T00:10:00','2026-11-01T23:27:00']]){
  const result=travelTimes(route,'historical',new Date('2026-10-24T14:00Z'),new Date(wallTime(appointment,'America/New_York')),15);
  assert.equal(zonedParts(result.departure!,'America/New_York'),expected);
 }
});

test('the reminder lead is before departure, including a one-hour trip and early-arrival buffer',async()=>{
 const {travelReminderPhase,reminderLeadMinutes}=await import('../lib/travel/timing.ts');
 const appointment=Date.parse('2026-10-24T16:00Z'); // Noon local
 const leave=appointment-75*60000; // 10:45: 60 minute drive plus 15 early
 assert.equal(travelReminderPhase(appointment,3600,15,60,leave-60*60000-1),null);
 assert.equal(travelReminderPhase(appointment,3600,15,60,leave-60*60000),'preparation'); // 9:45, not 11:00
 assert.equal(travelReminderPhase(appointment,3600,15,60,leave),'leave_now');
 for(const hours of [1,2,3,4,5]){
  assert.equal(travelReminderPhase(appointment,3600,15,hours*60,leave-hours*3600000),'preparation');
 }
 assert.equal(reminderLeadMinutes(300),300);assert.equal(reminderLeadMinutes(999),300);
});
