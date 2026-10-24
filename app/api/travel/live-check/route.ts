import {arrivalTarget} from '../../../../lib/travel/timing';
import {NextResponse} from 'next/server';
import {authenticated,checkRateLimit,jsonError,privateRequestError} from '../../../../lib/travel/auth';
import {assertSameOrigin,readPrivateJSON} from '../../../../lib/security/request';
import {adminClient,vapidReady} from '../../../../lib/travel/monitor';
import {validPushEndpoint} from '../../../../lib/security/urls';
import {freshLocation,type LocationFix} from '../../../../lib/travel/location-fix';
import {scheduledTrips} from '../../../../lib/travel/scheduled-trips';
import {calculateRoute} from '../../../../lib/travel/tomtom';
import {currentTravelNotice} from '../../../../lib/travel/live-notice';
import {deliverNotification} from '../../../../lib/notifications/delivery';
import {inQuietHours,safeTimezone} from '../../../../lib/notifications/time';
import type {CalendarEvent,EventOccurrence,SavedPlace,UserProfile} from '../../../../lib/types';
export const runtime='nodejs';
/** Stateless foreground heartbeat: coordinates are used for this request, never saved as location history. */
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
  if(!await checkRateLimit(viewer.userId,'route'))return jsonError('Too many travel checks. Retry shortly.',429);
  const body=await readPrivateJSON(request) as {endpoint?:unknown;fix?:LocationFix}|null;
  const fix=freshLocation(body?.fix),now=Date.now();
  if(!fix||!validPushEndpoint(body?.endpoint))return jsonError('A fresh, accurate device location and connected notification device are required.',400);
  const admin=adminClient();
  const [{data:device,error:deviceError},{data:row,error:snapshotError},{data:prefs,error:prefError}]=await Promise.all([
   admin.from('push_subscriptions').select('id').eq('user_id',viewer.userId).eq('endpoint',body.endpoint).is('disabled_at',null).maybeSingle(),
   admin.from('private_snapshots').select('payload').eq('user_id',viewer.userId).maybeSingle(),
   admin.from('travel_preferences').select('traffic_notifications,lockscreen_private,origin_kind,travel_mode,arrival_buffer_minutes').eq('user_id',viewer.userId).maybeSingle()
  ]);
  if(deviceError||snapshotError||prefError)throw Error('Travel records unavailable');
  if(!device)return jsonError('Connect notifications on this device first.',409);
  const payload=row?.payload as {events?:CalendarEvent[];eventOccurrences?:EventOccurrence[];savedPlaces?:SavedPlace[];profile?:UserProfile}|undefined;
  if(prefs?.traffic_notifications===false||prefs?.origin_kind==='saved'||!payload)return NextResponse.json({checked:false},{headers:{'Cache-Control':'no-store'}});
  const candidates=scheduledTrips(payload.events||[],payload.eventOccurrences||[],payload.savedPlaces||[],new Date(now)).filter(trip=>trip.startTime.getTime()>now&&trip.startTime.getTime()-now<=36*3600000&&trip.destination);
  if(!candidates.length)return NextResponse.json({checked:false},{headers:{'Cache-Control':'no-store'}});
  const {data:plans,error:planError}=await admin.from('travel_appointments').select('source_event_id,occurrence_start,enabled,cancelled').eq('user_id',viewer.userId).gte('occurrence_start',new Date(now).toISOString()).lte('occurrence_start',new Date(now+36*3600000).toISOString());
  if(planError)throw Error('Travel preference unavailable');
  const trip=candidates.find(candidate=>!plans?.some(plan=>plan.source_event_id===candidate.eventId&&Date.parse(plan.occurrence_start)===candidate.startTime.getTime()&&(plan.enabled===false||plan.cancelled)));
  if(!trip?.destination)return NextResponse.json({checked:false},{headers:{'Cache-Control':'no-store'}});
  trip.bufferMinutes=Math.max(trip.bufferMinutes,prefs?.arrival_buffer_minutes??15);
  const result=await calculateRoute({origin:fix.point,destination:trip.destination,travelMode:trip.travelMode||prefs?.travel_mode||'car',arriveAt:arrivalTarget(trip.startTime,trip.bufferMinutes).toISOString()},{alternatives:2});
  // The provider request can outlast the GPS freshness window: validate again before queueing.
  const sentAt=Date.now(),route=[...result.routes].sort((a,b)=>a.durationSeconds-b.durationSeconds)[0];
  const notice=route?currentTravelNotice(trip,route,fix,viewer.userId,device.id,trip.timezone||payload.profile?.timezone||'America/New_York',sentAt,prefs?.lockscreen_private!==false,trip.reminderLeadMinutes??payload.profile?.reminderLeadMinutes):null;
  if(!notice)return NextResponse.json({checked:true},{headers:{'Cache-Control':'no-store'}});
  const quiet=inQuietHours(sentAt,safeTimezone(payload.profile?.timezone),payload.profile?.quietHoursStart,payload.profile?.quietHoursEnd);
  vapidReady();
  const delivered=await deliverNotification(admin,{userId:viewer.userId,subscriptionId:device.id,key:notice.key,kind:notice.kind,expires:notice.expires,
   message:{...notice.message,silent:quiet&&notice.kind!=='leave_now'},urgent:notice.kind==='leave_now'},sentAt);
  return NextResponse.json({checked:true,accepted:delivered.accepted},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return privateRequestError(error,'Live travel checking is unavailable. Appointment reminders remain scheduled.');}
}
