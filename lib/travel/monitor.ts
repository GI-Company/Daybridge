import 'server-only';
import {createClient} from '@supabase/supabase-js';
import * as webpush from 'web-push';
import {calculateRoute} from './tomtom';
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
type SourceEvent={id:string;startTime:string;rrule?:string;location?:string;venueType?:string;destinationLat?:number;destinationLon?:number};
type Plan={id:string;user_id:string;source_event_id:string;occurrence_start:string;timezone:string;destination_address:string;destination_lat:number;destination_lon:number;origin_lat:number|null;origin_lon:number|null;travel_mode:'car'|'pedestrian'|'bicycle';arrival_buffer_minutes:number;source_revision:string;last_travel_seconds:number|null;last_delay_seconds:number|null;last_checked_at:string|null;updated_at:string};
type Prefs={user_id:string;traffic_notifications:boolean;lockscreen_private:boolean;saved_origin_lat:number|null;saved_origin_lon:number|null};
function localTime(iso:string,timezone:string){
 const f=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const p=Object.fromEntries(f.formatToParts(new Date(iso)).map(q=>[q.type,q.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
function validSource(event:SourceEvent|undefined,plan:Plan){
 if(!event||event.venueType!=='in_person'||!event.startTime||!event.location)return false;
 if(event.location.trim()!==plan.destination_address.trim())return false;
 if(Number.isFinite(event.destinationLat)&&Math.abs((event.destinationLat??0)-plan.destination_lat)>0.00001)return false;
 if(Number.isFinite(event.destinationLon)&&Math.abs((event.destinationLon??0)-plan.destination_lon)>0.00001)return false;
 const target=localTime(plan.occurrence_start,plan.timezone);
 const source=event.startTime.slice(0,16);
 if(!event.rrule)return source===target;
 if(!event.rrule.toUpperCase().includes('WEEKLY'))return false;
 const weekday=(v:string)=>new Date(v.slice(0,10)+'T12:00:00Z').getUTCDay();
 return source.slice(11)===target.slice(11)&&weekday(source)===weekday(target)&&target.slice(0,10)>=source.slice(0,10);
}
type TravelUpdate={travelSeconds:number;delaySeconds:number;leaveByMs:number;lockscreenPrivate:boolean;
 impact:TravelImpactResult;routeCount:number};
async function deliver(admin:ReturnType<typeof adminClient>,plan:Plan,kind:'preliminary'|'preparation'|'leave_now'|'traffic_change',time:number,update:TravelUpdate,reason:'routine'|'late-risk'='routine'){
 const dedupeSlot=reason==='late-risk'?'late-risk':kind==='traffic_change'?Math.floor(time/(15*60000)):'once';
 const key=[plan.id,plan.source_revision,kind,dedupeSlot].join(':');
 const {data:existing}=await admin.from('notification_deliveries').select('*').eq('user_id',plan.user_id).eq('dedupe_key',key).maybeSingle();
 let record=existing;
 if(!record){
  const {data,error}=await admin.from('notification_deliveries').insert({user_id:plan.user_id,appointment_id:plan.id,dedupe_key:key,kind,status:'pending'}).select().single();
  if(error)return;record=data;
 }
 if(!record||record.status==='sent'||record.status==='cancelled'||record.attempt_count>=4)return;
 if(record.last_attempt_at&&time-Date.parse(record.last_attempt_at)<180000)return;
 const {data:claim}=await admin.from('notification_deliveries').update({status:'sending',attempt_count:record.attempt_count+1,last_attempt_at:new Date(time).toISOString(),updated_at:new Date(time).toISOString()}).eq('id',record.id).eq('status',record.status).eq('attempt_count',record.attempt_count).select('id').maybeSingle();
 if(!claim)return;
 const {data:subs,error:subError}=await admin.from('push_subscriptions').select('id,endpoint,keys_auth,keys_p256dh').eq('user_id',plan.user_id).is('disabled_at',null);
 if(subError){await admin.from('notification_deliveries').update({status:'failed'}).eq('id',record.id);return}
 if(!subs?.length){await admin.from('notification_deliveries').update({status:'no_subscription'}).eq('id',record.id);return}
 const title=update.lockscreenPrivate?'DayBridge travel update'
  :reason==='late-risk'?'Possible late arrival from saved start'
  :kind==='preparation'?'One-hour appointment traffic update'
  :kind==='leave_now'?'Departure time reached'
  :kind==='traffic_change'?'Your travel ETA has changed':'Upcoming appointment';
 const body=update.lockscreenPrivate
  ?'Open DayBridge to review your route and departure time.'
  :summarizeTrafficUpdate(update.impact,update.travelSeconds,update.delaySeconds,update.routeCount,plan.timezone);
 // The event ID and date are opaque app records, not street locations or directions.
 const date=localTime(plan.occurrence_start,plan.timezone).slice(0,10);
 const url='/?tab=schedule&event='+encodeURIComponent(plan.source_event_id)+'&date='+encodeURIComponent(date);
 const message={kind,title,body,url,tag:'daybridge-'+kind+'-'+plan.id};
 let success=0;
 for(const sub of subs){
  try{
   await webpush.sendNotification({endpoint:sub.endpoint,keys:{auth:sub.keys_auth,p256dh:sub.keys_p256dh}},JSON.stringify(message),{TTL:1800,urgency:'normal'});
   success++;
  }catch(err){
   const code=(err as {statusCode?:number}).statusCode;
   if(code===404||code===410)await admin.from('push_subscriptions').update({disabled_at:new Date(time).toISOString(),last_failure_at:new Date(time).toISOString()}).eq('id',sub.id).eq('user_id',plan.user_id);
   else await admin.from('push_subscriptions').update({last_failure_at:new Date(time).toISOString()}).eq('id',sub.id).eq('user_id',plan.user_id);
  }
 }
 await admin.from('notification_deliveries').update({status:success?'sent':'failed',sent_at:success?new Date(time).toISOString():null,updated_at:new Date(time).toISOString()}).eq('id',record.id);
}
export async function monitorTravel(){
 vapidReady();
 const admin=adminClient(),now=Date.now();
 const start=new Date(now-60000).toISOString(),end=new Date(now+36*3600000).toISOString();
 const {data:plans,error}=await admin.from('travel_appointments').select('*').eq('enabled',true).eq('cancelled',false).gt('occurrence_start',start).lt('occurrence_start',end).not('origin_lat','is',null).not('origin_lon','is',null).order('occurrence_start').limit(60);
 if(error)throw Error('Could not load upcoming travel');
 let checked=0,alerts=0,cancelled=0;
 for(const item of plans??[]){
  const plan=item as Plan;const startMs=Date.parse(plan.occurrence_start);
  const [{data:prefs},{data:snapshot}]=await Promise.all([
   admin.from('travel_preferences').select('user_id,traffic_notifications,lockscreen_private,saved_origin_lat,saved_origin_lon').eq('user_id',plan.user_id).maybeSingle(),
   admin.from('private_snapshots').select('payload').eq('user_id',plan.user_id).maybeSingle()
  ]);
  const pref=prefs as Prefs|null;
  if(!pref?.traffic_notifications)continue;
  if(pref.saved_origin_lat===null||pref.saved_origin_lon===null||Math.abs(pref.saved_origin_lat-plan.origin_lat!)>0.00001||Math.abs(pref.saved_origin_lon-plan.origin_lon!)>0.00001)continue;
  const source=(snapshot?.payload as {events?:SourceEvent[]}|null)?.events?.find(e=>e.id===plan.source_event_id);
  if(!validSource(source,plan)){
   // Avoid cancelling a brand-new appointment while its cloud snapshot write is still settling.
   if(now-Date.parse(plan.updated_at)<300000)continue;
   await admin.from('travel_appointments').update({cancelled:true,enabled:false}).eq('id',plan.id).eq('user_id',plan.user_id);
   await admin.from('notification_deliveries').update({status:'cancelled'}).eq('appointment_id',plan.id).in('status',['pending','failed','no_subscription']);
   cancelled++;continue;
  }
  try{
   const remaining=startMs-now;
   // Compare alternative route choices automatically as the appointment approaches.
   // The background calculation always starts at the user-approved saved origin,
   // never an inferred live device location.
   const candidates=(await calculateRoute({
     origin:{lat:plan.origin_lat!,lon:plan.origin_lon!},
     destination:{lat:plan.destination_lat,lon:plan.destination_lon},
     travelMode:plan.travel_mode,arriveAt:plan.occurrence_start
   },{alternatives:remaining<=2*3600000?2:0})).routes;
   const ordered=[...candidates].sort((a,b)=>a.durationSeconds-b.durationSeconds);
   const best=ordered[0];
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
     impact,routeCount:ordered.length
   };
   await admin.from('travel_appointments').update({
     last_travel_seconds:best.durationSeconds,last_delay_seconds:best.delaySeconds,
     last_checked_at:new Date(now).toISOString()
   }).eq('id',plan.id).eq('user_id',plan.user_id);
   checked++;
   // One priority notification per appointment per worker pass. Critical risk
   // supersedes ordinary one-hour reminders, preventing alert floods.
   if(remaining>0&&impact.appointmentAtRisk){
     await deliver(admin,plan,'traffic_change',now,update,'late-risk');alerts++;
   }else if(remaining>0&&now>=leaveMs-5*60000){
     await deliver(admin,plan,'leave_now',now,update);alerts++;
   }else if(remaining>0&&remaining<=4*3600000&&impact.meaningfulChange){
     await deliver(admin,plan,'traffic_change',now,update);alerts++;
   }else if(remaining>0&&remaining<=60*60000){
     await deliver(admin,plan,'preparation',now,update);alerts++;
   }else if(remaining>60*60000&&remaining<=24*3600000){
     await deliver(admin,plan,'preliminary',now,update);alerts++;
   }
  }catch{ /* Isolate third-party failures; next scheduled run retries. */ }
 }
 return {checked,alerts_attempted:alerts,cancelled};
}
