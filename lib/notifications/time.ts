import type {CalendarEvent,EventOccurrence} from '../types';
export function safeTimezone(value?:string):string {
 try{new Intl.DateTimeFormat('en-US',{timeZone:value||'America/New_York'}).format();return value||'America/New_York';}
 catch{return 'America/New_York';}
}
export function zonedParts(time:Date|number,zone:string):string {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(time).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
/** Convert a wall-clock time in an IANA zone without relying on the server's zone. */
export function wallTime(value:string,zone:string):number {
 if(/(?:Z|[+-]\d\d:\d\d)$/.test(value))return Date.parse(value);
 const wall=value.length===16?value+':00':value;
 const target=Date.parse(wall+'Z');if(!Number.isFinite(target))return NaN;
 let guess=target;
 for(let i=0;i<4;i++){
  const offset=Date.parse(zonedParts(guess,zone)+'Z')-guess;
  const next=target-offset;if(next===guess)break;guess=next;
 }
 // A nonexistent spring-forward time must not generate a reminder at a different hour.
 return zonedParts(guess,zone)===wall.slice(0,19)?guess:NaN;
}
export function shiftDay(day:string,amount:number):string {
 const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);
}
export type CalendarInstance={event:CalendarEvent;start:number;end:number;originalStart:number;title:string;status:EventOccurrence['attendanceStatus'];occurrence?:EventOccurrence};
export function calendarInstances(event:CalendarEvent,exceptions:EventOccurrence[],from:number,to:number):CalendarInstance[] {
 const zone=safeTimezone(event.timezone),original=wallTime(event.startTime,zone),end=wallTime(event.endTime,zone);
 if(!Number.isFinite(original)||!Number.isFinite(end))return [];
 const sourceWall=zonedParts(original,zone),endWall=zonedParts(end,zone),duration=end-original;
 const endDayOffset=Math.round((Date.parse(endWall.slice(0,10)+'T12:00:00Z')-Date.parse(sourceWall.slice(0,10)+'T12:00:00Z'))/86400000);
 const instances:CalendarInstance[]=[];
 const add=(start:number)=>{
  const exception=exceptions.find(x=>x.eventId===event.id&&(!event.rrule||Math.abs(Date.parse(x.startTimeUtc)-start)<60000));
  const actual=exception?.overrideStartTime?wallTime(exception.overrideStartTime,zone):start;
  const finish=exception?.overrideEndTime?wallTime(exception.overrideEndTime,zone):exception?.overrideStartTime?actual+duration:wallTime(shiftDay(zonedParts(start,zone).slice(0,10),endDayOffset)+endWall.slice(10),zone);
  if(actual>=from&&actual<=to&&Number.isFinite(finish)&&finish>actual)instances.push({event,start:actual,end:finish,originalStart:start,title:exception?.overrideTitle||event.title,status:exception?.attendanceStatus||'unconfirmed',occurrence:exception});
 };
 if(!event.rrule){add(original);return instances;}
 const rule=Object.fromEntries(event.rrule.toUpperCase().split(';').map(x=>x.split('=')));
 if(rule.FREQ!=='WEEKLY'&&rule.FREQ!=='DAILY')return [];
 const weekdays=['SU','MO','TU','WE','TH','FR','SA'];
 const sourceDay=sourceWall.slice(0,10),sourceWeekday=new Date(sourceDay+'T12:00:00Z').getUTCDay();
 const days=(rule.BYDAY||weekdays[sourceWeekday]).split(',');
 const interval=Math.max(1,Number(rule.INTERVAL)||1);
 // Include exception originals even when an occurrence has moved outside its original day.
 const first=shiftDay(zonedParts(from,zone).slice(0,10),-1),last=shiftDay(zonedParts(to,zone).slice(0,10),1);
 for(let day=first;day<=last;day=shiftDay(day,1)){
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const week=Math.floor((Date.parse(day+'T12:00:00Z')-Date.parse(sourceDay+'T12:00:00Z')+sourceWeekday*86400000)/(7*86400000));
  const dayOffset=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(sourceDay+'T12:00:00Z'))/86400000);
  if(rule.FREQ==='DAILY'?dayOffset%interval===0:week%interval===0&&days.includes(weekdays[weekday])){
   const start=wallTime(day+sourceWall.slice(10),zone);
   if(start>=original&&Number.isFinite(start))add(start);
  }
 }
 for(const exception of exceptions.filter(x=>x.eventId===event.id&&x.overrideStartTime)){
  const originalStart=Date.parse(exception.startTimeUtc);
  if(!instances.some(x=>x.originalStart===originalStart))add(originalStart);
 }
 return instances.sort((a,b)=>a.start-b.start);
}
export function inQuietHours(now:number,zone:string,start?:string,end?:string):boolean {
 if(!start||!end||start===end||!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end))return false;
 const clock=zonedParts(now,zone).slice(11,16);
 return start<end?clock>=start&&clock<end:clock>=start||clock<end;
}
