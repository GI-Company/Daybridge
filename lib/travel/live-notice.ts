import {travelReminderPhase} from './timing.ts';
import type {ScheduledTrip} from './scheduled-trips';
import type {Route} from './types';
import {freshLocation,LOCATION_MAX_AGE,type LocationFix} from './location-fix.ts';
import {notificationURL} from '../notifications/destination.ts';
import {safeTimezone,zonedParts} from '../notifications/time.ts';
/** A GPS-based notice expires with the actual fix; no saved origin or background inference. */
export function currentTravelNotice(trip:ScheduledTrip,route:Route,fix:LocationFix,userId:string,deviceId:string,timezone:string,now:number,privateScreen=true,leadMinutes?:number){
 const current=freshLocation(fix,now);if(!current||trip.startTime.getTime()<=now||!Number.isFinite(route.durationSeconds)||route.durationSeconds<0)return null;
 const start=trip.startTime.getTime(),leave=start-route.durationSeconds*1000-trip.bufferMinutes*60000;
 const kind=travelReminderPhase(start,route.durationSeconds,trip.bufferMinutes,leadMinutes,now);
 if(!kind)return null;
 const zone=safeTimezone(timezone),date=zonedParts(start,zone).slice(0,10);
 const late=Math.max(0,Math.ceil((now+route.durationSeconds*1000-start)/60000));
 const checked=new Date(fix.recordedAt).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
 const time=new Date(leave).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
 return {kind,key:['gps',trip.eventId,start,deviceId,kind].join(':'),expires:Math.min(start,current.recordedAt+LOCATION_MAX_AGE),
  message:{kind,title:privateScreen?'DayBridge travel update':late?'Check your departure time':kind==='leave_now'?'Departure time reached':'Upcoming appointment travel',
   body:privateScreen?'Open DayBridge to review your current route and departure time.':`From this device’s recent location (${checked}): ${Math.ceil(route.durationSeconds/60)} min travel. `+(late?`Leaving now could mean arriving ${late} min late.`:`Leave by ${time}.`),
   url:notificationURL({tab:'locations',event:trip.eventId,date,account:userId}),tag:'daybridge-current-'+trip.eventId+'-'+start}};
}
