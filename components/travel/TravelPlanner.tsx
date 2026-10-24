'use client';
import React,{useEffect,useState} from 'react';
import {MapPinned,LocateFixed,Save} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {defaults,mapsUrl,type Point,type TravelPrefs} from '../../lib/travel/types';
import {RouteMap} from './RouteMap';
import {useDayBridge} from '../../lib/storage/store';
import {arrivalBuffer,arrivalTarget,travelTimes} from '../../lib/travel/timing';
import {eventDestination} from '../../lib/travel/scheduled-trips';
import {safeTimezone} from '../../lib/notifications/time';
import {useCurrentLocation} from '../../lib/travel/use-current-location';
import {useAutomaticRoute} from '../../lib/travel/use-automatic-route';
import {useTravelRequest} from '../../lib/travel/use-travel-request';
import {validMapPoint} from '../../lib/travel/geometry';

type Place=Point&{label:string};
export function TravelPlanner({eventId,title,startTime,location}:{eventId:string;title:string;startTime:Date|string;location?:string}){
 const {updateEvent,savedPlaces,events,profile}=useDayBridge(),client=createClient();
 const [prefs,setPrefs]=useState<TravelPrefs>(defaults),[address,setAddress]=useState(location||'');
 const initialSaved=savedPlaces.find(p=>p.address===location);
 const savedEvent=events.find(event=>event.id===eventId&&event.location===location);
 const sourcePoint=savedEvent?eventDestination(savedEvent,savedPlaces):initialSaved||null;
 const [place,setPlace]=useState<Place|null>(sourcePoint&&location?{lat:sourcePoint.lat,lon:sourcePoint.lon,label:location}:null),[options,setOptions]=useState<Place[]>([]);
 useEffect(()=>{setAddress(location||'');setPlace(sourcePoint&&location?{lat:sourcePoint.lat,lon:sourcePoint.lon,label:location}:null);setOptions([]);},[eventId,location,sourcePoint?.lat,sourcePoint?.lon]);
 const [choice,setChoice]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const [monitor,setMonitor]=useState(true),[active,setActive]=useState(false);
 const deviceLocation=useCurrentLocation();
 const at=new Date(startTime).toISOString();
 const savedOrigin={lat:prefs.saved_origin_lat,lon:prefs.saved_origin_lon};
 const automaticOrigin=prefs.origin_kind==='saved'?(validMapPoint(savedOrigin)?savedOrigin:null):deviceLocation.fix?.point||null;
 const mode=savedEvent?.travelMode||prefs.travel_mode;
 const buffer=arrivalBuffer(savedEvent?.travelBufferMinutes,prefs.arrival_buffer_minutes);
 const zone=safeTimezone(savedEvent?.timezone||profile.timezone);
 const time=(date:Date)=>date.toLocaleString([],{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const target=place?{id:eventId,point:{lat:place.lat,lon:place.lon},mode,arriveAt:arrivalTarget(at,buffer).toISOString()}:null;
 const {state:routeState,refresh}=useAutomaticRoute(target,automaticOrigin);
 const estimate=routeState?.result||null,origin=routeState?.from||null;
 useEffect(()=>setChoice(0),[estimate]);
 const beginAddress=useTravelRequest(address);
 useEffect(()=>{
  let valid=true;
  let revision=0;
  const loadPreferences=()=>{
   const current=++revision;
   void client?.from('travel_preferences').select('*').maybeSingle().then(({data}: {data:Partial<TravelPrefs>|null})=>{if(valid&&current===revision&&data)setPrefs({...defaults,...data})});
  };
  loadPreferences();
  window.addEventListener('daybridge:travel-prefs-updated',loadPreferences);
  client?.from('travel_appointments').select('enabled,cancelled').eq('source_event_id',eventId).eq('occurrence_start',at).maybeSingle().then(({data})=>{
   if(!valid||!data)return;
   setActive(Boolean(data.enabled&&!data.cancelled));
   setMonitor(Boolean(data.enabled&&!data.cancelled));
  });
  return()=>{valid=false;window.removeEventListener('daybridge:travel-prefs-updated',loadPreferences)};
 },[eventId,at,location]);

 async function geocode(){
  setBusy(true);setOptions([]);setPlace(null);setStatus('');
  const request=beginAddress();
  try{const r=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:request.signal});if(!r.ok)throw Error();const j=await r.json();if(!request.current())return;setOptions(j.results||[]);setStatus(j.results?.length?'Select the matching destination.':'No matches found.');}
  catch{if(request.current())setStatus('Address lookup unavailable. Try another address.')}finally{if(request.current())setBusy(false)}
 }
 async function saveMonitor(){
  if(!place){setStatus('Select the destination first.');return}
  if(!client){setStatus('Supabase unavailable.');return}
  const user=await client.auth.getUser();if(!user.data.user){setStatus('Sign in required.');return}
  setBusy(true);
  const approved=monitor&&prefs.origin_kind==='saved'&&prefs.saved_origin_lat!==null&&prefs.saved_origin_lon!==null;
  if(monitor&&prefs.origin_kind==='saved'&&!approved){setStatus('To enable closed-app alerts, approve a saved location in Settings first.');setBusy(false);return}
  const revision=[at,place.lat,place.lon,mode,buffer].join(':');
  const {error}=await client.from('travel_appointments').upsert({
   user_id:user.data.user.id,source_event_id:eventId,occurrence_start:at,
   destination_address:place.label,destination_lat:place.lat,destination_lon:place.lon,
   origin_lat:approved?prefs.saved_origin_lat:null,origin_lon:approved?prefs.saved_origin_lon:null,
   origin_label:approved?prefs.saved_origin_label:null,
   travel_mode:mode,arrival_buffer_minutes:buffer,
   timezone:savedEvent?.timezone||profile.timezone,source_revision:revision,
   cancelled:!monitor,enabled:monitor,updated_at:new Date().toISOString()
  },{onConflict:'user_id,source_event_id,occurrence_start'});
  if(!error){
   updateEvent(eventId,{location:place.label,destinationLat:place.lat,destinationLon:place.lon,travelMode:mode,travelBufferMinutes:buffer});
   setActive(monitor);setStatus(monitor?(prefs.origin_kind==='saved'?'Saved-location forecast enabled for this appointment.':'Travel plan saved. Current-location alerts require fresh GPS while the app is open.'):'Travel plan saved with alerts disabled.');
  }else setStatus('Save failed. Please retry.');
  setBusy(false);
 }
 async function disable(){
  if(!client)return;
  const {error}=await client.from('travel_appointments').update({enabled:false,cancelled:true,updated_at:new Date().toISOString()}).eq('source_event_id',eventId).eq('occurrence_start',at);
  if(error)setStatus('Could not disable. Try again.');else{setActive(false);setStatus('Travel monitoring disabled for this appointment.')}
 }
 const selected=estimate?.routes[choice];
 const times=selected&&estimate?travelTimes(selected,estimate.basis,new Date(),at,buffer):null;
 const destination=place?{lat:place.lat,lon:place.lon}:null;
 return <section className="mt-4 space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-4" aria-label="Appointment travel planner">
  <h4 className="flex items-center gap-2 font-bold text-teal-950"><MapPinned className="h-5 w-5"/>Appointment travel</h4>
  <p className="text-xs text-slate-700">Appointment: {title}. Current location and routes load automatically after GPS permission is allowed. Appointment reminders continue while the app is closed; live departure timing requires a fresh device location.</p>
  <label className="block text-sm font-semibold text-slate-800">Destination street address</label>
  {!!savedPlaces.length&&<select aria-label="Choose saved destination" value={savedPlaces.find(p=>p.address===place?.label)?.id||''} onChange={e=>{const p=savedPlaces.find(p=>p.id===e.target.value);if(p){setPlace({label:p.address,lat:p.lat,lon:p.lon});setAddress(p.address);setOptions([])}}} className="w-full rounded-xl border border-teal-300 bg-white p-3 text-sm"><option value="">Choose a saved location</option>{savedPlaces.map(p=><option key={p.id} value={p.id}>{p.label} · {p.category.replace('_',' ')}</option>)}</select>}
  <div className="flex gap-2"><input value={address} onChange={e=>{setAddress(e.target.value);setPlace(null)}} placeholder="Street address, city, state" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-2 text-sm"/><button type="button" onClick={()=>void geocode()} disabled={busy||address.length<6} className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verify</button></div>
  {options.map((p,i)=><button type="button" key={i} onClick={()=>{setPlace(p);setAddress(p.label);setOptions([]);setStatus('Destination selected.')}} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-800">{p.label}</button>)}
  <p className="text-xs text-slate-600">{prefs.origin_kind==='current'?(deviceLocation.status==='current'?'Using your current device location.':deviceLocation.status==='denied'?'Location permission is denied. Enable it in device or browser settings.':'Acquiring an accurate current location automatically…'):'Explicit planning forecast from your saved location.'}</p>
  <button type="button" disabled={!place||!automaticOrigin||routeState?.status==='loading'} onClick={refresh} className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white p-3 text-sm font-bold text-teal-900 disabled:opacity-50"><LocateFixed className="h-4 w-4"/>Refresh traffic and alternatives</button>
  {routeState?.status==='loading'&&<p role="status" className="text-xs text-slate-600">Refreshing traffic from your selected starting location…</p>}
  {routeState?.status==='error'&&<p role="status" className="text-xs text-amber-900">Travel timing is unavailable. Check your connection and refresh traffic.</p>}
  {estimate&&selected&&origin&&destination&&<div className="space-y-3">
   <RouteMap origin={origin} destination={destination} route={selected}/>
   <div role="tablist" aria-label="Available routes" className="flex gap-2 overflow-x-auto">
    {estimate.routes.map((r,i)=><button key={i} type="button" role="tab" aria-selected={choice===i} onClick={()=>setChoice(i)} className={'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold '+(choice===i?'bg-teal-800 text-white':'bg-white text-slate-900')}>{i===0?'Fastest':'Alternative '+i}: {Math.ceil(r.durationSeconds/60)} min</button>)}
   </div>
   <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
    <div><strong>{estimate.basis==='historical'?'Arrival if leaving at leave-by':'Arrival if leaving now'}</strong><div>{times&&time(times.arrival)}</div></div>
    <div><strong>Traffic delay</strong><div>{Math.ceil(selected.delaySeconds/60)} min</div></div>
    <div><strong>Recommended leave-by</strong><div>{times?.departure&&time(times.departure)} · {buffer} min early</div></div>
    <div><strong>Appointment starts</strong><div>{time(new Date(at))}</div></div>
    {estimate.basis==='live'&&<div><strong>Arrival if leaving at leave-by</strong><div>{time(arrivalTarget(at,buffer))}</div></div>}
    <div><strong>Travel basis</strong><div>{estimate.basis==='historical'?'Historic forecast':'Current traffic'}</div></div>
   </div>
   {prefs.navigation_enabled&&<div className="flex flex-wrap gap-2">
    <a href={mapsUrl('google',origin,destination,mode)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-bold text-white">Open Google Maps</a>
    <a href={mapsUrl('apple',origin,destination,mode)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-400 bg-white px-4 py-2 text-xs font-bold text-teal-900">Open Apple Maps</a>

   </div>}

   {!!selected.instructions?.length&&<details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-900">Turn-by-turn route instructions</summary><ol className="mt-2 max-h-64 list-decimal space-y-2 overflow-auto pl-5 text-xs text-slate-700">{selected.instructions.map((instruction,index)=><li key={index}>{instruction}</li>)}</ol></details>}
   <p className="text-xs text-slate-600">Checked {time(new Date(estimate.checkedAt))}. Routes refresh automatically while open; use a navigation app for driving guidance.</p>
  </div>}
  <label className="flex gap-2 items-start text-xs text-slate-800"><input type="checkbox" className="mt-1 h-4 w-4 accent-teal-800" checked={monitor} onChange={e=>setMonitor(e.target.checked)}/>Enable travel alerts for this appointment. Current-location timing needs fresh GPS while DayBridge is open.</label>
  <div className="flex gap-2">
   <button type="button" disabled={!place||busy} onClick={()=>void saveMonitor()} className="flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>Save travel plan</button>
   {active&&<button type="button" onClick={()=>void disable()} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs text-rose-800">Disable travel plan</button>}
  </div>
  {status&&<p role="status" className="text-xs text-slate-700">{status}</p>}
 </section>;
}
