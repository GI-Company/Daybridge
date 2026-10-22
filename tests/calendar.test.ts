import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDayKey,calendarMonthDays,calendarRange,calendarWeekDays,calendarMove} from '../lib/calendar.ts';

test('October 2026 month calendar starts on Sunday and includes every day',()=>{
 const cells=calendarMonthDays(new Date(2026,9,22));
 assert.equal(cells.length,42);
 assert.equal(cells[0].getDay(),0);
 assert.equal(calendarDayKey(cells[0]),'2026-09-27');
 assert.equal(calendarDayKey(cells[34]),'2026-10-31');
 assert.equal(calendarDayKey(cells[41]),'2026-11-07');
});
test('week contains the selected date and always runs Sunday-Saturday',()=>{
 const week=calendarWeekDays(new Date(2026,9,22));
 assert.deepEqual(week.map(calendarDayKey),[
  '2026-10-18','2026-10-19','2026-10-20','2026-10-21',
  '2026-10-22','2026-10-23','2026-10-24'
 ]);
 assert.equal(calendarRange(new Date(2026,9,22),'week').end.getHours(),23);
});
test('month navigation handles different month lengths without skipping months',()=>{
 const feb=calendarMove(new Date(2027,0,31),'month',1);
 assert.equal(calendarDayKey(feb),'2027-02-01');
 const week=calendarMove(new Date(2026,9,22),'week',1);
 assert.equal(calendarDayKey(week),'2026-10-29');
});
test('dates use local calendar days, not ISO UTC truncation',()=>{
 assert.equal(calendarDayKey(new Date(2026,9,22,23,30)),'2026-10-22');
});
