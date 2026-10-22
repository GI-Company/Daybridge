import test from 'node:test';
import assert from 'node:assert/strict';
import {getMedicationSlotsForDay,calculateRefillForecast} from '../lib/medication.ts';

const med={
 id:'m1',userId:'u',name:'Example',strengthText:'Label-prescribed',instructions:'',
 isPrn:false,isActive:true,inventoryCount:30,refillThreshold:7,createdAt:'2026-01-01',updatedAt:'2026-01-01'
};
const days=[0,1,2,3,4,5,6];
const schedules=[
 {id:'am',userId:'u',medicationId:'m1',timeOfDay:'08:00',daysOfWeek:days,dosageLabel:'one'},
 {id:'pm',userId:'u',medicationId:'m1',timeOfDay:'20:00',daysOfWeek:days,dosageLabel:'one'}
];

test('twice daily prescription creates two separate daily tracking slots',()=>{
 const today=new Date(2026,9,22);
 const slots=getMedicationSlotsForDay([med],schedules,[],today);
 assert.equal(slots.length,2);
 assert.notEqual(slots[0].scheduledTime,slots[1].scheduledTime);
 assert.equal(slots[0].displayTime,'8:00 AM');
 assert.equal(slots[1].displayTime,'8:00 PM');
});

test('logging one dose only marks its exact slot, not another nearby dose',()=>{
 const sameDay=new Date(2026,9,22);
 const close=[
 {...schedules[0],timeOfDay:'08:00'},
 {...schedules[1],timeOfDay:'08:30'}
 ];
 const before=getMedicationSlotsForDay([med],close,[],sameDay);
 const log={id:'l1',userId:'u',medicationId:'m1',
 scheduledSlotUtc:before[0].scheduledTime,recordedAtUtc:new Date().toISOString(),action:'taken' as const};
 const after=getMedicationSlotsForDay([med],close,[log],sameDay);
 assert.equal(after[0].actionStatus,'taken');
 assert.equal(after[1].actionStatus,'pending');
});

test('inventory forecast respects two scheduled doses daily',()=>{
 assert.equal(calculateRefillForecast(med,schedules).daysRemaining,15);
});

test('PRN medication does not invent a daily refill rate',()=>{
 assert.equal(calculateRefillForecast({...med,isPrn:true},[]).daysRemaining,null);
});

test('removed medication is absent from daily slots while its old dose logs remain intact',()=>{
 const day=new Date(2026,9,22);
 const original=getMedicationSlotsForDay([med],schedules,[],day);
 const historicalLog={id:'past1',userId:'u',medicationId:'m1',
  scheduledSlotUtc:original[0].scheduledTime,recordedAtUtc:day.toISOString(),action:'taken' as const};
 const removed={...med,isActive:false};
 assert.equal(getMedicationSlotsForDay([removed],schedules,[historicalLog],day).length,0);
 assert.equal(historicalLog.medicationId,'m1');
 const restored=getMedicationSlotsForDay([{...removed,isActive:true}],schedules,[historicalLog],day);
 assert.equal(restored.length,2);
 assert.equal(restored[0].actionStatus,'taken');
});
