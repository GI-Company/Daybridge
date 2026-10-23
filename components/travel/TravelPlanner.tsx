'use client';
import React,{useEffect,useState} from 'react';
import {MapPinned,Navigation,Clock3,LocateFixed,Save} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';
import {defaults,leaveBy,mapsUrl,type Point,type TravelPrefs,type RouteResult,type Mode} from '../../lib/travel/types';
import {RouteMap} from './RouteMap';
import {useDayBridge} from '../../lib/storage/store';
import {useTravelRequest} from '../../lib/travel/use-travel-request';
import {validMapPoint} from '../../lib/travel/geometry';

type Place=Point&{label:string};
export function TravelPlanner({eventId,title,startTime,location}:{eventId:string;title:string;startTime:Date|string;location?:string}){
 const {updateEvent,savedPlaces,events,profile}=useDayBridge(),client=createClient();
 const [prefs,setPrefs]=useState<TravelPrefs>(defaults),[address,setAddress]=useState(location||'');
 const initialSaved=savedPlaces.find(p=>p.address===location);
 const savedEvent=events.find(event=>event.id===eventId&&event.location===location);
 const eventPoint={lat:savedEvent?.destinationLat,lon:savedEvent?.destinationLon};
 const [place,setPlace]=useState<Place|null>(initialSaved?{label:initialSaved.address,lat:initialSaved.lat,lon:initialSaved.lon}:
  validMapPoint(eventPoint)&&location?{...eventPoint,label:location}:null),[options,setOptions]=useState<Place[]>([]);
 const [origin,setOrigin]=useState<Point|null>(null),[estimate,setEstimate]=useState<RouteResult|null>(null);
 const [choice,setChoice]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const [monitor,setMonitor]=useState(false),[active,setActive]=useState(false);
 const [guiding,setGuiding]=useState(false),[guidance,setGuidance]=useState('');
 const at=new Date(startTime).toISOString();
 const routeContext=JSON.stringify([eventId,at,place?.lat,place?.lon,prefs.travel_mode,
  prefs.origin_kind,prefs.saved_origin_lat,prefs.saved_origin_lon,guiding]);
 const beginRoute=useTravelRequest(routeContext);
 const beginAddress=useTravelRequest(address);
 useEffect(()=>{setEstimate(null);setOrigin(null);setBusy(false);},[routeContext]);
 useEffect(()=>{
  let valid=true;
  let revision=0;
  const loadPreferences=()=>{
   const current=++revision;
   void client?.from('travel_preferences').select('*').maybeSingle().then(({data}: {data:Partial<TravelPrefs>|null})=>{if(valid&&current===revision&&data)setPrefs({...defaults,...data})});
  };
  loadPreferences();
  window.addEventListener('daybridge:travel-prefs-updated',loadPreferences);
  client?.from('travel_appointments').select('destination_address,destination_lat,destination_lon,enabled,cancelled,origin_lat,origin_lon').eq('source_event_id',eventId).eq('occurrence_start',at).maybeSingle().then(({data}: {data:{destination_address:string;destination_lat:number;destination_lon:number;enabled:boolean;cancelled:boolean;origin_lat:number|null;origin_lon:number|null}|null})=>{
   if(!valid||!data)return;
   setAddress(data.destination_address);setPlace({label:data.destination_address,lat:data.destination_lat,lon:data.destination_lon});setActive(Boolean(data.enabled&&!data.cancelled));
   setMonitor(data.origin_lat!==null&&data.origin_lon!==null);
  });
  return()=>{valid=false;window.removeEventListener('daybridge:travel-prefs-updated',loadPreferences)};
 },[eventId,at]);
 useEffect(()=>{
  if(!guiding)return;
  if(!place){setGuidance('Verify a destination before starting live route updates.');return;}
  if(!navigator.geolocation){
   setGuidance('Device GPS is unavailable. Open your preferred navigation app.');return;
  }
  let stopped=false;
  let activeRequest=false;
  let lastCheck=0;
  let lastPoint:Point|null=null;
  const controller=new AbortController();
  const distanceMeters=(a:Point,b:Point)=>{
   const r=6371000,rad=Math.PI/180;
   const dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
   const q=Math.sin(dLat/2)**2+
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
   return 2*r*Math.asin(Math.min(1,Math.sqrt(q)));
  };
  const watchId=navigator.geolocation.watchPosition(position=>{
   if(stopped)return;
   const point={lat:position.coords.latitude,lon:position.coords.longitude};
   const now=Date.now();
   // Refresh after meaningful movement, or every five minutes when stopped.
   // We use foreground GPS only after the user explicitly starts guidance.
   const moved=lastPoint?distanceMeters(point,lastPoint):Infinity;
   if(activeRequest||(lastPoint&&now-lastCheck<120000)||
      (lastPoint&&moved<50&&now-lastCheck<300000))return;
   lastPoint=point;lastCheck=now;activeRequest=true;
   setGuidance('Checking live traffic and faster routes from your current location…');
   const request=beginRoute();
   void (async()=>{
    try{
     const response=await fetch('/api/travel/route',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({origin:point,destination:{lat:place.lat,lon:place.lon},
       travelMode:prefs.travel_mode,arriveAt:at}),signal:AbortSignal.any([controller.signal,request.signal])
     });
     if(!response.ok)throw Error('Route refresh temporarily unavailable');
     const data=await response.json() as RouteResult;
     if(stopped||!request.current()||!data.routes?.length)return;
     const ranked={...data,routes:[...data.routes].sort((a,b)=>a.durationSeconds-b.durationSeconds)};
     setOrigin(point);
     setEstimate(ranked);
     setChoice(0);
     const best=ranked.routes[0];
     const minutes=Math.ceil(best.durationSeconds/60);
     const late=Math.max(0,Math.ceil((Date.now()+best.durationSeconds*1000-Date.parse(at))/60000));
     setGuidance((late>0
      ?'From your live position, arrival could be about '+late+' minutes after the appointment. '
      :'Live route refreshed. Fastest travel time: '+minutes+' minutes. ')+
      (ranked.routes.length>1?'Alternatives are available below. ':'')+
      'Follow road signs and use a full navigation app for turn-by-turn guidance.');
    }catch{
     if(!stopped&&request.current())setGuidance('Live route update unavailable. Check your connection and retry.');
    }finally{activeRequest=false;}
   })();
  },()=>{if(!stopped)setGuidance('GPS signal unavailable or location permission denied.');},
  {enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  return()=>{stopped=true;controller.abort();navigator.geolocation.clearWatch(watchId);};
 },[guiding,place?.lat,place?.lon,prefs.travel_mode,at,beginRoute]);
 useEffect(()=>{
  if(guiding||!place||prefs.saved_origin_lat===null||prefs.saved_origin_lon===null||
     !prefs.traffic_notifications)return;
  // A previously approved saved origin needs no new GPS permission.
  // Populate the appointment's route details automatically on open.
  const from={lat:prefs.saved_origin_lat,lon:prefs.saved_origin_lon};
  const controller=new AbortController();
  const request=beginRoute();
  let cancelled=false;
  void (async()=>{
   try{
    const response=await fetch('/api/travel/route',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({origin:from,destination:{lat:place.lat,lon:place.lon},
      travelMode:prefs.travel_mode,arriveAt:at}),signal:AbortSignal.any([controller.signal,request.signal])
    });
    if(!response.ok)throw Error();
    const data=await response.json() as RouteResult;
    if(cancelled||!request.current()||!data.routes.length)return;
    setOrigin(from);
    setEstimate({...data,routes:[...data.routes].sort((a,b)=>a.durationSeconds-b.durationSeconds)});
    setChoice(0);
    setStatus('Latest travel estimate loaded from your approved starting location.');
   }catch{
    if(!cancelled&&request.current())setStatus('Automatic route preview unavailable. Tap Preview to retry.');
   }
  })();
  return()=>{cancelled=true;controller.abort();};
 },[guiding,place?.lat,place?.lon,prefs.saved_origin_lat,prefs.saved_origin_lon,
    prefs.travel_mode,prefs.traffic_notifications,at,beginRoute]);

 async function geocode(){
  setBusy(true);setOptions([]);setPlace(null);setEstimate(null);setStatus('');
  const request=beginAddress();
  try{const r=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:request.signal});if(!r.ok)throw Error();const j=await r.json();if(!request.current())return;setOptions(j.results||[]);setStatus(j.results?.length?'Select the matching destination.':'No matches found.');}
  catch{if(request.current())setStatus('Address lookup unavailable. Try another address.')}finally{if(request.current())setBusy(false)}
 }
 async function getOrigin(){
  if(prefs.origin_kind==='saved'&&prefs.saved_origin_lat!==null&&prefs.saved_origin_lon!==null){
    return {lat:prefs.saved_origin_lat,lon:prefs.saved_origin_lon};
  }
  if(!navigator.geolocation){setStatus('This device does not support GPS. Approve a saved origin in Settings.');return null;}
  return new Promise<Point|null>(resolve=>navigator.geolocation.getCurrentPosition(p=>{
    const point={lat:p.coords.latitude,lon:p.coords.longitude};resolve(point);
  },()=>{setStatus('Current GPS unavailable or permission denied. Approve a saved origin in Settings.');resolve(null)},{enableHighAccuracy:true,maximumAge:30000,timeout:12000}));
 }
 async function preview(){
  if(!place){setStatus('Select a validated destination first.');return}
  setBusy(true);setStatus('Calculating TomTom routes…');
  const request=beginRoute();
  const from=await getOrigin();
  if(!request.current())return;
  if(!from){setBusy(false);return;}
  try{
   const result=await fetch('/api/travel/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin:from,destination:{lat:place.lat,lon:place.lon},travelMode:prefs.travel_mode,arriveAt:at}),signal:request.signal});
   if(!result.ok)throw Error();
   const data=await result.json() as RouteResult;if(!request.current())return;setOrigin(from);setEstimate({...data,routes:[...data.routes].sort((a,b)=>a.durationSeconds-b.durationSeconds)});setChoice(0);setStatus('Route updated. Times are estimates, not guarantees.');
  }catch{if(request.current()){setStatus('Routing unavailable. Check your connection and retry.');setEstimate(null)}}finally{if(request.current())setBusy(false)}
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
   timezone:savedEvent?.timezone||profile.timezone,source_revision:revision,
   cancelled:!approved,enabled:approved,updated_at:new Date().toISOString()
  },{onConflict:'user_id,source_event_id,occurrence_start'});
  if(!error){
   updateEvent(eventId,{location:place.label,destinationLat:place.lat,destinationLon:place.lon,travelMode:prefs.travel_mode,travelBufferMinutes:prefs.arrival_buffer_minutes});
   setActive(approved);setStatus(approved?'Saved with background departure alerts.':'Travel destination saved. Background monitoring off; current GPS only works while app is open.');
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
  <p className="text-xs text-slate-700">Appointment: {title}. Background traffic checks use only your approved saved starting location. Tap Start foreground guidance to refresh routes automatically from live GPS while this screen stays open.</p>
  <label className="block text-sm font-semibold text-slate-800">Destination street address</label>
  {!!savedPlaces.length&&<select aria-label="Choose saved destination" value={savedPlaces.find(p=>p.address===place?.label)?.id||''} onChange={e=>{const p=savedPlaces.find(p=>p.id===e.target.value);if(p){setPlace({label:p.address,lat:p.lat,lon:p.lon});setAddress(p.address);setOptions([]);setEstimate(null)}}} className="w-full rounded-xl border border-teal-300 bg-white p-3 text-sm"><option value="">Choose a saved location</option>{savedPlaces.map(p=><option key={p.id} value={p.id}>{p.label} · {p.category.replace('_',' ')}</option>)}</select>}
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
