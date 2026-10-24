import type {Route,RouteResult} from './types';
export function arrivalBuffer(eventMinutes:number|undefined,preferenceMinutes:number){
 return Math.max(0,Number.isFinite(eventMinutes)?eventMinutes!:0,Number.isFinite(preferenceMinutes)?preferenceMinutes:0);
}
/** The routing provider must plan for the early-arrival target, not the appointment start. */
export function arrivalTarget(start:Date|string,bufferMinutes:number){
 return new Date(new Date(start).getTime()-Math.max(0,bufferMinutes)*60000);
}
export function travelTimes(route:Route,basis:RouteResult['basis'],now:Date,start?:Date|string,bufferMinutes=0){
 const target=start?arrivalTarget(start,bufferMinutes):null;
 const providerDeparture=route.departureTime?Date.parse(route.departureTime):NaN;
 const providerArrival=route.arrivalTime?Date.parse(route.arrivalTime):NaN;
 return {
  arrival:basis==='historical'&&target?new Date(Number.isFinite(providerArrival)?providerArrival:target.getTime()):new Date(now.getTime()+route.durationSeconds*1000),
  departure:target?new Date(basis==='historical'&&Number.isFinite(providerDeparture)?providerDeparture:target.getTime()-route.durationSeconds*1000):null
 };
}
/** Shared with ordinary appointment reminders so a longer lead also works while closed. */
export function reminderLeadMinutes(value:number|undefined){return Number.isFinite(value)?Math.max(0,Math.min(300,Math.round(value!))):30;}
export function reminderLeadLabel(minutes:number){return minutes===0?'At departure':minutes%60===0?`${minutes/60} ${minutes===60?'hour':'hours'} before departure`:`${minutes} minutes before departure`;}
export function travelReminderPhase(start:number,travelSeconds:number,bufferMinutes:number,leadMinutes:number|undefined,now:number){
 const leave=arrivalTarget(new Date(start),bufferMinutes).getTime()-travelSeconds*1000;
 return now>=leave?'leave_now':now>=leave-reminderLeadMinutes(leadMinutes)*60000?'preparation':null;
}
