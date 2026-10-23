import 'server-only';
import {createClient} from '@supabase/supabase-js';
import * as webpush from 'web-push';
import {calculateRoute} from './tomtom';
import {deliverNotification} from '../notifications/delivery';
import {notificationURL} from '../notifications/destination';
import {calendarInstances,safeTimezone,zonedParts,inQuietHours} from '../notifications/time';
import {eventDestination} from './scheduled-trips';
import type {CalendarEvent,EventOccurrence,SavedPlace,UserProfile} from '../types';
import {assessTravelImpact,summarizeTrafficUpdate,type TravelImpactResult} from './traffic-impact';

export function adminClient(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Admin backend credentials missing');
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
export function vapidReady(){
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 const privateKey=process.env.VAPID_PRIVATE_KEY;
 if(!publicKey||!privateKey)throw Error('VAPID server configuration missing');
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||'https://daybridge-swart.vercel.app',publicKey,privateKey);
}
type Plan={id:string;user_id:string;source_event_id:string;occurrence_start:string;timezone:string;destination_address:string;destination_lat:number;destination_lon:number;origin_lat:number|null;origin_lon:number|null;travel_mode:'car'|'pedestrian'|'bicycle';arrival_buffer_minutes:number;source_revision:string;last_travel_seconds:number|null;last_delay_seconds:number|null;last_checked_at:string|null;updated_at:string};
type Prefs={user_id:string;traffic_notifications:boolean;lockscreen_private:boolean;saved_origin_lat:number|null;saved_origin_lon:number|null};
type Snapshot={events?:CalendarEvent[];eventOccurrences?:EventOccurrence[];savedPlaces?:SavedPlace[];profile?:Partial<UserProfile>};
function validSource(snapshot:Snapshot|undefined,plan:Plan){
 const event=snapshot?.events?.find(e=>e.id===plan.source_event_id);
 if(!event||event.venueType!=='in_person'||event.location?.trim()!==plan.destination_address.trim())return false;
 const destination=eventDestination(event,snapshot?.savedPlaces||[]);
 if(!destination||Math.abs(destination.lat-plan.destination_lat)>0.00001||Math.abs(destination.lon-plan.destination_lon)>0.00001)return false;
 const start=Date.parse(plan.occurrence_start);
 return calendarInstances(event,snapshot?.eventOccurrences||[],start-60000,start+60000).some(x=>x.start===start&&x.status==='unconfirmed');
}
/** Reconcile directly from the latest cloud calendar even while the installed app is closed. */
async function syncPlans(admin:ReturnType<typeof adminClient>,now:number){
 const {data:preferences,error}=await admin.from('travel_preferences').select('*').eq('traffic_notifications',true).not('saved_origin_lat','is',null).not('saved_origin_lon','is',null);
 if(error)throw Error('Could not read travel settings');
 for(const pref of preferences||[]){
  const {data:snapshot,error:snapshotError}=await admin.from('private_snapshots').select('payload').eq('user_id',pref.user_id).maybeSingle();
  if(snapshotError)continue;
  const payload=snapshot?.payload as Snapshot|undefined;if(!payload)continue;
  const {data:existing,error:planError}=await admin.from('travel_appointments').select('source_event_id,occurrence_start,enabled,cancelled').eq('user_id',pref.user_id).gt('occurrence_start',new Date(now-60000).toISOString()).lt('occurrence_start',new Date(now+36*3600000).toISOString());
  if(planError)continue;
  const rows=[];
  for(const event of payload.events||[]){
   if(event.venueType!=='in_person'||!event.location)continue;
   const destination=eventDestination(event,payload.savedPlaces||[]);if(!destination)continue;
   for(const instance of calendarInstances(event,payload.eventOccurrences||[],now,now+36*3600000)){
    if(instance.status!=='unconfirmed')continue;
    const start=new Date(instance.start).toISOString();
    const old=existing?.find(p=>p.source_event_id===event.id&&Date.parse(p.occurrence_start)===instance.start);
    rows.push({user_id:pref.user_id,source_event_id:event.id,occurrence_start:start,end_time:new Date(instance.end).toISOString(),timezone:safeTimezone(event.timezone),
     destination_address:event.location,destination_lat:destination.lat,destination_lon:destination.lon,
     origin_lat:pref.saved_origin_lat,origin_lon:pref.saved_origin_lon,origin_label:pref.saved_origin_label,
     travel_mode:event.travelMode||pref.travel_mode,arrival_buffer_minutes:Math.max(pref.arrival_buffer_minutes,event.travelBufferMinutes||0),
     source_revision:[event.id,start,event.location,destination.lat,destination.lon].join(':'),enabled:old&&!old.cancelled?old.enabled:true,cancelled:false,updated_at:new Date(now).toISOString()});
   }
  }
  if(rows.length){const {error:writeError}=await admin.from('travel_appointments').upsert(rows,{onConflict:'user_id,source_event_id,occurrence_start'});if(writeError)throw Error('Could not synchronize travel reminders');}
 }
}
type TravelUpdate={travelSeconds:number;delaySeconds:number;leaveByMs:number;lockscreenPrivate:boolean;
 impact:TravelImpactResult;routeCount:number;silent:boolean};
async function deliver(admin:ReturnType<typeof adminClient>,plan:Plan,kind:'preliminary'|'preparation'|'leave_now'|'traffic_change',time:number,update:TravelUpdate,reason:'routine'|'late-risk'|'late-risk-change'='routine'){
 const dedupeSlot=reason==='late-risk'?'late-risk':reason==='late-risk-change'?'risk-'+Math.floor(time/(15*60000)):kind==='traffic_change'?Math.floor(time/(15*60000)):'once';
 const key=[plan.id,plan.source_revision,kind,dedupeSlot].join(':');
 const title=update.lockscreenPrivate?'DayBridge travel update'
  :reason!=='routine'?'Possible late arrival from saved start'
  :kind==='preparation'?'One-hour appointment traffic update'
  :kind==='leave_now'?'Departure time reached'
  :kind==='traffic_change'?'Your travel ETA has changed':'Upcoming appointment';
 const body=update.lockscreenPrivate
  ?'Open DayBridge to review your route and departure time.'
  :summarizeTrafficUpdate(update.impact,update.travelSeconds,update.delaySeconds,update.routeCount,plan.timezone);
 // The event ID and date are opaque app records, not street locations or directions.
 const date=zonedParts(Date.parse(plan.occurrence_start),safeTimezone(plan.timezone)).slice(0,10);
 const url=notificationURL({tab:'locations',event:plan.source_event_id,date,account:plan.user_id});
 return deliverNotification(admin,{userId:plan.user_id,key,kind,appointmentId:plan.id,
  message:{kind,title,body,url,tag:'daybridge-travel-'+plan.id,silent:update.silent},
  expires:Date.parse(plan.occurrence_start),urgent:kind==='leave_now'||reason!=='routine'},time);
}
export async function monitorTravel(){
 vapidReady();
 const admin=adminClient(),now=Date.now();
 await syncPlans(admin,now);
 const start=new Date(now-60000).toISOString(),end=new Date(now+36*3600000).toISOString();
 const {data:plans,error}=await admin.from('travel_appointments').select('*').eq('enabled',true).eq('cancelled',false).gt('occurrence_start',start).lt('occurrence_start',end).not('origin_lat','is',null).not('origin_lon','is',null).order('occurrence_start').limit(60);
 if(error)throw Error('Could not load upcoming travel');
 let checked=0,alerts=0,cancelled=0,failures=0;
 for(const item of plans??[]){
  const plan=item as Plan;const startMs=Date.parse(plan.occurrence_start);
  const [{data:prefs,error:prefError},{data:snapshot,error:snapshotError}]=await Promise.all([
   admin.from('travel_preferences').select('user_id,traffic_notifications,lockscreen_private,saved_origin_lat,saved_origin_lon').eq('user_id',plan.user_id).maybeSingle(),
   admin.from('private_snapshots').select('payload').eq('user_id',plan.user_id).maybeSingle()
  ]);
  if(prefError||snapshotError){failures++;continue;}
  const pref=prefs as Prefs|null;
  if(!pref?.traffic_notifications)continue;
  if(pref.saved_origin_lat===null||pref.saved_origin_lon===null||Math.abs(pref.saved_origin_lat-plan.origin_lat!)>0.00001||Math.abs(pref.saved_origin_lon-plan.origin_lon!)>0.00001)continue;
  const source=snapshot?.payload as Snapshot|undefined;
  if(!validSource(source,plan)){
   await admin.from('travel_appointments').update({cancelled:true,enabled:false}).eq('id',plan.id).eq('user_id',plan.user_id);
   await admin.from('notification_deliveries').update({status:'cancelled'}).eq('appointment_id',plan.id).in('status',['pending','failed','no_subscription']);
   cancelled++;continue;
  }
  try{
   const remaining=startMs-now;
   const estimatedLeave=startMs-(plan.last_travel_seconds||0)*1000-plan.arrival_buffer_minutes*60000;
   const interval=remaining<=3600000||now>=estimatedLeave-5*60000?60000:remaining<=4*3600000?5*60000:30*60000;
   if(plan.last_checked_at&&now-Date.parse(plan.last_checked_at)<interval)continue;
   // Compare alternative route choices automatically as the appointment approaches.
   // The background calculation always starts at the user-approved saved origin,
   // never an inferred live device location.
   const candidates=(await calculateRoute({
     origin:{lat:plan.origin_lat!,lon:plan.origin_lon!},
     destination:{lat:plan.destination_lat,lon:plan.destination_lon},
     travelMode:plan.travel_mode,arriveAt:plan.occurrence_start
   },{alternatives:remaining<=2*3600000?2:0})).routes;
   const ordered=[...candidates].sort((a,b)=>a.durationSeconds-b.durationSeconds);
   const best=ordered[0];if(!best)throw Error('No valid travel route');
   const impact=assessTravelImpact({
     travelSeconds:best.durationSeconds,delaySeconds:best.delaySeconds,
     priorTravelSeconds:plan.last_travel_seconds,priorDelaySeconds:plan.last_delay_seconds,
     startMs,nowMs:now,arrivalBufferMinutes:plan.arrival_buffer_minutes,
     routeOptions:ordered.length
   });
   const leaveMs=impact.leaveByMs;
   await admin.from('travel_estimates').insert({
     user_id:plan.user_id,appointment_id:plan.id,travel_seconds:best.durationSeconds,
     traffic_delay_seconds:best.delaySeconds,historic_seconds:best.historicSeconds,
     leave_by:new Date(leaveMs).toISOString(),
     traffic_basis:remaining>4*3600000?'historical':'live'
   });
   const update:TravelUpdate={
     travelSeconds:best.durationSeconds,delaySeconds:best.delaySeconds,
     leaveByMs:leaveMs,lockscreenPrivate:pref.lockscreen_private,
     impact,routeCount:ordered.length,silent:inQuietHours(now,safeTimezone(source?.profile?.timezone),source?.profile?.quietHoursStart,source?.profile?.quietHoursEnd)&&!impact.appointmentAtRisk&&now<leaveMs-5*60000
   };
   await admin.from('travel_appointments').update({
     last_travel_seconds:best.durationSeconds,last_delay_seconds:best.delaySeconds,
     last_checked_at:new Date(now).toISOString()
   }).eq('id',plan.id).eq('user_id',plan.user_id);
   checked++;
   // Update one notification per appointment, with urgent departure/risk taking priority.
   let kind:'preliminary'|'preparation'|'leave_now'|'traffic_change'|null=null;
   let reason:'routine'|'late-risk'|'late-risk-change'='routine';
   if(remaining>0&&impact.appointmentAtRisk){kind='traffic_change';reason=impact.meaningfulChange?'late-risk-change':'late-risk';}
   else if(remaining>0&&now>=leaveMs-5*60000)kind='leave_now';
   else if(remaining>0&&remaining<=4*3600000&&impact.meaningfulChange)kind='traffic_change';
   else if(remaining>0&&remaining<=60*60000)kind='preparation';
   else if(remaining>60*60000&&remaining<=24*3600000)kind='preliminary';
   if(kind){const result=await deliver(admin,plan,kind,now,update,reason);alerts+=result.accepted;failures+=result.failed;}
  }catch{ failures++; /* The next scheduled run can retry this appointment. */ }
 }
 return {checked,alerts_accepted:alerts,cancelled,failures};
}
