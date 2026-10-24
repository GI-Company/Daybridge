import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSafeToSpend} from '../lib/budget.ts';
import {calendarHeading,formatDate} from '../lib/date-time.ts';
import {weeklyReview,occurrenceStatus,reviewCSV} from '../lib/weekly-review.ts';
import type {CalendarEvent,EventOccurrence,MedicationLog,TaskItem,MoneyTransaction} from '../lib/types.ts';
const now=new Date('2026-10-24T14:00:00Z'),zone='America/New_York';
const event:CalendarEvent={id:'event',userId:'synthetic',title:'Synthetic recurring appointment',category:'class',description:'',startTime:'2026-10-01T09:00:00',endTime:'2026-10-01T10:00:00',timezone:zone,venueType:'virtual',rrule:'FREQ=DAILY',travelBufferMinutes:0,prepChecklist:[],createdAt:'',updatedAt:''};
test('payday countdown counts calendar dates across daylight saving, same-day and invalid dates',()=>{
 const base={accounts:[],bills:[],reserves:[],timezone:zone,now};
 assert.equal(calculateSafeToSpend({...base,nextPayday:'2026-11-05'}).daysUntilPayday,12);
 assert.equal(calculateSafeToSpend({...base,now:new Date('2026-10-25T02:59:59Z'),nextPayday:'2026-11-05'}).daysUntilPayday,12);
 assert.equal(calculateSafeToSpend({...base,nextPayday:'2026-10-24'}).daysUntilPayday,0);
 assert.equal(calculateSafeToSpend({...base,nextPayday:'2026-10-23'}).daysUntilPayday,0);
 assert.equal(calculateSafeToSpend({...base,nextPayday:'2026-02-30'}).daysUntilPayday,0);
 assert.equal(calculateSafeToSpend(base).daysUntilPayday,0);
 assert.equal(calculateSafeToSpend({...base,now:new Date('2027-03-13T12:00:00Z'),nextPayday:'2027-03-15'}).daysUntilPayday,2);
});
test('date-only labels keep their calendar date and schedule headings show a date once',()=>{
 const original=process.env.TZ;process.env.TZ='America/New_York';
 try{
  assert.match(formatDate('2026-11-05'),/Nov 5, 2026/);
  assert.equal(calendarHeading(new Date(2026,10,2),new Date(2026,9,24)),'Mon, Nov 2, 2026');
  assert.equal(calendarHeading(new Date(2026,9,25),new Date(2026,9,24)),'Tomorrow · Oct 25, 2026');
 }finally{if(original)process.env.TZ=original;else delete process.env.TZ;}
});
test('weekly summaries exclude old, future and undated actions while showing separate recurring statuses',()=>{
 const attended=(id:string,date:string)=>({id,eventId:'event',userId:'synthetic',startTimeUtc:date,endTimeUtc:date,attendanceRecordedAt:date,attendanceStatus:'attended_self_reported',isException:false}) as EventOccurrence;
 const record={events:[event],eventOccurrences:[attended('old','2026-10-10T13:00:00Z'),attended('recent','2026-10-23T13:00:00Z'),attended('future','2026-10-25T13:00:00Z')],medicationLogs:[{id:'old',recordedAtUtc:'2026-10-01T12:00:00Z',action:'taken'},{id:'new',recordedAtUtc:'2026-10-24T12:00:00Z',action:'taken'}] as MedicationLog[],tasks:[{id:'old',completed:true,completedAt:'2026-10-01T12:00:00Z'},{id:'new',completed:true,completedAt:'2026-10-24T12:00:00Z'},{id:'undated',completed:true}] as TaskItem[],transactions:[{amountCents:-1000,transactionDate:'2026-10-23'},{amountCents:-500,transactionDate:'2026-10-01'},{amountCents:-500,transactionDate:'2026-10-25'}] as MoneyTransaction[]};
 const before=JSON.stringify(record),review=weeklyReview(record,now,zone);
 assert.equal(review.attended.length,1);assert.equal(review.medicationLogs.length,1);assert.equal(review.completedTasks.length,1);assert.equal(review.spentCents,1000);
 assert.equal(occurrenceStatus(review.occurrences.find(o=>o.id==='recent')!,now),'Attended (self-reported)');
 assert.equal(occurrenceStatus(review.occurrences.find(o=>o.startTime.toISOString()==='2026-10-26T13:00:00.000Z')!,now),'Upcoming');
 assert.equal(occurrenceStatus(review.occurrences[0],now),'Not yet recorded');
 assert.equal(occurrenceStatus({...review.occurrences[0],checkInCompletedAt:now.toISOString()},now),'Completed');
 assert.equal(JSON.stringify(record),before);
});
test('review CSV quotes user text safely and prevents spreadsheet formula execution',()=>{
 assert.equal(reviewCSV([['Title','Status'],['=HYPERLINK("evil")','Done'],['A, B\nC','Pending']]),'"Title","Status"\r\n"\'=HYPERLINK(""evil"")","Done"\r\n"A, B\nC","Pending"');
});
