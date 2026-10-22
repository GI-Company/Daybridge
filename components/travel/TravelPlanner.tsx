'use client';
import React,{useEffect,useState} from 'react';
import {MapPinned,Navigation,Clock3,LocateFixed,Save} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {defaults,leaveBy,mapsUrl,type Point,type TravelPrefs,type RouteResult,type Mode} from '../../lib/travel/types';
import {RouteMap} from './RouteMap';
import {useDayBridge} from '../../lib/storage/store';

type Place=Point&{label:string};
export function TravelPlanner({eventId,title,startTime,location}:{eventId:string;title:string;startTime:Date|string;location?:string}){
 const {updateEvent}=useDayBridge(),client=createClient();
 const [prefs,setPrefs]=useState<TravelPrefs>(defaults),[address,setAddress]=useState(location||'');
 const [place,setPlace]=useState<Place|null>(null),[options,setOptions]=useState<Place[]>([]);
 const [origin,setOrigin]=useState<Point|null>(null),[estimate,setEstimate]=useState<RouteResult|null>(null);
 const [choice,setChoice]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const [monitor,setMonitor]=useState(false),[active,setActive]=useState(false);
 const [guiding,setGuiding]=useState(false),[guidance,setGuidance]=useState('');
 const at=new Date(startTime).toISOString();
 useEffect(()=>{
  let valid=true;
  client?.from('travel_preferences').select('*').maybeSingle().then(({data}: {data:Partial<TravelPrefs>|null})=>{if(valid&&data)setPrefs({...defaults,...data})});
  client?.from('travel_appointments').select('destination_address,destination_lat,destination_lon,enabled,cancelled,origin_lat,origin_lon').eq('source_event_id',eventId).eq('occurrence_start',at).maybeSingle().then(({data}: {data:{destination_address:string;destination_lat:number;destination_lon:number;enabled:boolean;cancelled:boolean;origin_lat:number|null;origin_lon:number|null}|null})=>{
   if(!valid||!data)return;
   setAddress(data.destination_address);setPlace({label:data.destination_address,lat:data.destination_lat,lon:data.destination_lon});setActive(Boolean(data.enabled&&!data.cancelled));
   setMonitor(data.origin_lat!==null&&data.origin_lon!==null);
  });
  return()=>{valid=false};
 },[eventId,at]);
 useEffect(()=>{if(!guiding)return; if(!navigator.geolocation){setGuidance('Device GPS unavailable.');return}
  const id=navigator.geolocation.watchPosition(p=>setGuidance('Position updated at '+new Date(p.timestamp).toLocaleTimeString()+'. Follow the mapped route and road signs.'),()=>setGuidance('Current GPS signal unavailable.'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  return()=>navigator.geolocation.clearWatch(id);
 },[guiding]);
 async function geocode(){
  setBusy(true);setOptions([]);setPlace(null);setEstimate(null);setStatus('');
  try{const r=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});if(!r.ok)throw Error();const j=await r.json();setOptions(j.results||[]);setStatus(j.results?.length?'Select the matching destination.':'No matches found.');}
  catch{setStatus('Address lookup unavailable. Try another address.')}finally{setBusy(false)}
 }
 async function getOrigin(){
  if(prefs.origin_kind==='saved'&&prefs.saved_origin_lat!==null&&prefs.saved_origin_lon!==null){
    const point={lat:prefs.saved_origin_lat,lon:prefs.saved_origin_lon};setOrigin(point);return point;
  }
  if(!navigator.geolocation){setStatus('This device does not support GPS. Approve a saved origin in Settings.');return null;}
  return new Promise<Point|null>(resolve=>navigator.geolocation.getCurrentPosition(p=>{
    const point={lat:p.coords.latitude,lon:p.coords.longitude};setOrigin(point);resolve(point);
  },()=>{setStatus('Current GPS unavailable or permission denied. Approve a saved origin in Settings.');resolve(null)},{enableHighAccuracy:true,maximumAge:30000,timeout:12000}));
 }
 async function preview(){
  if(!place){setStatus('Select a validated destination first.');return}
  setBusy(true);setStatus('Calculating TomTom routes…');
  const from=await getOrigin();
  if(!from){setBusy(false);return;}
  try{
   const result=await fetch('/api/travel/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin:from,destination:{lat:place.lat,lon:place.lon},travelMode:prefs.travel_mode,arriveAt:at})});
   if(!result.ok)throw Error();
   const data=await result.json() as RouteResult;setEstimate(data);setChoice(0);setStatus('Route updated. Times are estimates, not guarantees.');
  }catch{setStatus('Routing unavailable. The appointment remains scheduled.');setEstimate(null)}finally{setBusy(false)}
 }
 async function saveMonitor(){
  if(!place){setStatus('Select the destination first.');return}
  if(!client){setStatus('Supabase unavailable.');return}
  const user=await client.auth.getUser();if(!user.data.user){setStatus('Sign in required.');return}
  setBusy(true);
  const approved=monitor&&prefs.saved_origin_lat!==null&&prefs.saved_origin_lon!==null;
  if(monitor&&!approved){setStatus('To enable closed-app alerts, approve a saved location in Settings first.');setBusy(false);return}
  const revision=[at,place.lat,place.lon,prefs.travel_mode,prefs.arrival_buffer_minutes].join(':');
  const {error}=await client.from('travel_appointments').upsert({
   user_id:user.data.user.id,source_event_id:eventId,occurrence_start:at,
   destination_address:place.label,destination_lat:place.lat,destination_lon:place.lon,
   origin_lat:approved?prefs.saved_origin_lat:null,origin_lon:approved?prefs.saved_origin_lon:null,
   origin_label:approved?prefs.saved_origin_label:null,
   travel_mode:prefs.travel_mode,arrival_buffer_minutes:prefs.arrival_buffer_minutes,
   timezone:'America/New_York',source_revision:revision,
   cancelled:false,enabled:true,updated_at:new Date().toISOString()
  },{onConflict:'user_id,source_event_id,occurrence_start'});
  if(!error){
   updateEvent(eventId,{location:place.label,destinationLat:place.lat,destinationLon:place.lon,travelMode:prefs.travel_mode,travelBufferMinutes:prefs.arrival_buffer_minutes});
   setActive(true);setStatus(approved?'Saved with background departure alerts.':'Travel destination saved. Background monitoring off; current GPS only works while app is open.');
  }else setStatus('Save failed. Please retry.');
  setBusy(false);
 }
 async function disable(){
  if(!client)return;
  const {error}=await client.from('travel_appointments').update({enabled:false,cancelled:true,updated_at:new Date().toISOString()}).eq('source_event_id',eventId).eq('occurrence_start',at);
  if(error)setStatus('Could not disable. Try again.');else{setActive(false);setStatus('Travel monitoring disabled for this appointment.')}
 }
 const selected=estimate?.routes[choice];
 const destination=place?{lat:place.lat,lon:place.lon}:null;
 return <section className="mt-4 space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-4" aria-label="Appointment travel planner">
  <h4 className="flex items-center gap-2 font-bold text-teal-950"><MapPinned className="h-5 w-5"/>Appointment travel</h4>
  <p className="text-xs text-slate-700">Appointment: {title}. Optional navigation and alerts will not start without your action.</p>
  <label className="block text-sm font-semibold text-slate-800">Destination street address</label>
  <div className="flex gap-2"><input value={address} onChange={e=>{setAddress(e.target.value);setPlace(null);setEstimate(null)}} placeholder="Street address, city, state" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-2 text-sm"/><button type="button" onClick={()=>void geocode()} disabled={busy||address.length<6} className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verify</button></div>
  {options.map((p,i)=><button type="button" key={i} onClick={()=>{setPlace(p);setAddress(p.label);setOptions([]);setStatus('Destination selected.')}} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-800">{p.label}</button>)}
  <p className="text-xs text-slate-600">{prefs.origin_kind==='current'?'Route preview will request current location while this screen is open.':'Using your approved saved location for preview.'}</p>
  <button type="button" disabled={!place||busy} onClick={()=>void preview()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white p-3 text-sm font-bold text-teal-900 disabled:opacity-50"><LocateFixed className="h-4 w-4"/>Preview traffic and alternatives</button>
  {estimate&&selected&&origin&&destination&&<div className="space-y-3">
   <RouteMap origin={origin} destination={destination} route={selected}/>
   <div role="tablist" aria-label="Available routes" className="flex gap-2 overflow-x-auto">
    {estimate.routes.map((r,i)=><button key={i} type="button" role="tab" aria-selected={choice===i} onClick={()=>setChoice(i)} className={'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold '+(choice===i?'bg-teal-800 text-white':'bg-white text-slate-900')}>{i===0?'Fastest':'Alternative '+i}: {Math.ceil(r.durationSeconds/60)} min</button>)}
   </div>
   <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
    <div><strong>Estimated ETA</strong><div>{new Date(Date.now()+selected.durationSeconds*1000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div></div>
    <div><strong>Traffic delay</strong><div>{Math.ceil(selected.delaySeconds/60)} min</div></div>
    <div><strong>Recommended leave-by</strong><div>{leaveBy(at,selected.durationSeconds,prefs.arrival_buffer_minutes).toLocaleString([],{dateStyle:'short',timeStyle:'short'})}</div></div>
    <div><strong>Travel basis</strong><div>{estimate.basis==='historical'?'Historic forecast':'Current traffic'}</div></div>
   </div>
   {prefs.navigation_enabled&&<div className="flex flex-wrap gap-2">
    <a href={mapsUrl('google',origin,destination,prefs.travel_mode)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-bold text-white">Open Google Maps</a>
    <a href={mapsUrl('apple',origin,destination,prefs.travel_mode)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-400 bg-white px-4 py-2 text-xs font-bold text-teal-900">Open Apple Maps</a>
    <button type="button" onClick={()=>setGuiding(!guiding)} className="flex gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800"><Navigation className="h-4 w-4"/>{guiding?'Stop foreground guidance':'Start foreground guidance'}</button>
   </div>}
   {guiding&&<div className="rounded-xl bg-white p-3 text-xs text-slate-800"><p role="status">{guidance||'Foreground location tracking started. Use an external navigation app for spoken turns.'}</p>{selected.instructions?.length ? <ol className="mt-3 max-h-48 overflow-y-auto list-decimal space-y-2 pl-5" aria-label="Route maneuver instructions">{selected.instructions.map((step,i)=><li key={i}>{step}</li>)}</ol> : <p>Spoken turn guidance is not available; review the map or open your preferred navigation app.</p>}</div>}
  </div>}
  <label className="flex gap-2 items-start text-xs text-slate-800"><input type="checkbox" className="mt-1 h-4 w-4 accent-teal-800" checked={monitor} onChange={e=>setMonitor(e.target.checked)}/>Use my explicitly approved saved location for alerts while DayBridge is closed.</label>
  <div className="flex gap-2">
   <button type="button" disabled={!place||busy} onClick={()=>void saveMonitor()} className="flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>Save travel plan</button>
   {active&&<button type="button" onClick={()=>void disable()} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs text-rose-800">Disable travel plan</button>}
  </div>
  {status&&<p role="status" className="text-xs text-slate-700">{status}</p>}
 </section>;
}
