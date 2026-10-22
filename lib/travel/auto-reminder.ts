'use client';

import {createClient} from '../supabase/client';
import type {CalendarEvent,SavedPlace} from '../types';

/**
 * Auto-enrolls appointments with a verified saved destination when the user
 * previously approved a saved origin and enabled traffic notifications.
 * Does not access GPS, expose credentials, or block saving the appointment.
 * The server cron worker uses the same plans for closed-app reminders.
 */
export async function enrollTrafficAlerts(event:CalendarEvent,destination:SavedPlace):Promise<boolean>{
 if(event.venueType!=='in_person'||!event.startTime||!event.location||
    event.location.trim()!==destination.address.trim())return false;
 const db=createClient();
 if(!db)return false;
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return false;
 const {data:prefs,error:prefError}=await db.from('travel_preferences')
  .select('traffic_notifications,saved_origin_lat,saved_origin_lon,saved_origin_label,travel_mode,arrival_buffer_minutes')
  .eq('user_id',user.id).maybeSingle();
 if(prefError||!prefs?.traffic_notifications||
   !Number.isFinite(prefs.saved_origin_lat)||!Number.isFinite(prefs.saved_origin_lon)||
   prefs.saved_origin_lat===null||prefs.saved_origin_lon===null)return false;

 const original=new Date(event.startTime);
 if(!Number.isFinite(original.getTime()))return false;
 // Enroll recurring weekly commitments for the next 12 months.
 // Without approved saved coordinates nothing is sent to the server.
 const weekly=event.rrule?.includes('FREQ=WEEKLY')??false;
 const rows=[];
 for(let week=0;week<(weekly?53:1);week++){
  const date=new Date(original);
  if(week)date.setDate(original.getDate()+week*7);
  if(date.getTime()<=Date.now()||date.getTime()>Date.now()+366*86400000)continue;
  rows.push({
   user_id:user.id,source_event_id:event.id,occurrence_start:date.toISOString(),
   destination_address:destination.address,destination_lat:destination.lat,
   destination_lon:destination.lon,
   origin_lat:prefs.saved_origin_lat,origin_lon:prefs.saved_origin_lon,
   origin_label:prefs.saved_origin_label||null,
   travel_mode:prefs.travel_mode||'car',
   arrival_buffer_minutes:prefs.arrival_buffer_minutes??15,
   timezone:event.timezone||'America/New_York',
   source_revision:[event.id,event.startTime,event.location,event.rrule||'',week].join(':'),
   enabled:true,cancelled:false,updated_at:new Date().toISOString()
  });
 }
 if(!rows.length)return false;
 // Supabase/PostgREST normally accepts this list in one request.
 const {error}=await db.from('travel_appointments').upsert(rows,{onConflict:'user_id,source_event_id,occurrence_start',ignoreDuplicates:true});
 return !error;
}
