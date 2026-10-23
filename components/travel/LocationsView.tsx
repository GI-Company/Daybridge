'use client';

import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {MapPinned,Plus,Trash2,MapPin} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import {createClient} from '../../lib/supabase/client';
import type {SavedPlace,SavedPlaceCategory} from '../../lib/types';
import {defaults,type Point,type TravelPrefs} from '../../lib/travel/types';
import {ExploreMap,type MapPlace} from './ExploreMap';
import {TravelPreferencesCard} from './TravelPreferences';
import {useTravelRequest} from '../../lib/travel/use-travel-request';
import {scheduledTrips} from '../../lib/travel/scheduled-trips';
import {useAutomaticRoute} from '../../lib/travel/use-automatic-route';
import {TripDetails} from './TripDetails';
import {validMapPoint} from '../../lib/travel/geometry';
import {calendarDayKey} from '../../lib/calendar';

type AddressResult=Point&{label:string};
const categories:{id:SavedPlaceCategory;label:string}[]=[
 {id:'home',label:'Home'}, {id:'work',label:'Work'},
 {id:'therapy',label:'Therapy'}, {id:'class',label:'Classes'},
 {id:'drug_testing',label:'Drug testing'}, {id:'court',label:'Court'},
 {id:'other',label:'Other'}
];
const niceCategory=(key:SavedPlaceCategory)=>categories.find(c=>c.id===key)?.label||'Other';
function placeValid(p:AddressResult){return validMapPoint(p);}
type Focus={focusEventId?:string;focusDate?:string;focusRevision?:number};
type Records=Pick<ReturnType<typeof useDayBridge>,'savedPlaces'|'addSavedPlace'|'updateSavedPlace'|'deleteSavedPlace'|'events'|'eventOccurrences'|'syncStatus'>;
export function LocationsView({onOpenSchedule,...focus}:Focus&{onOpenSchedule?:(date?:string)=>void}){
 const records=useDayBridge();
 const [preferences,setPreferences]=useState<TravelPrefs>(defaults);
 useEffect(()=>{
  const db=createClient();
  let active=true,revision=0;
  const load=()=>{
   const current=++revision;
   void db?.from('travel_preferences').select('*').maybeSingle().then(({data})=>{
    if(active&&current===revision&&data)setPreferences({...defaults,...data});
   });
  };
  load();window.addEventListener('daybridge:travel-prefs-updated',load);
  return()=>{active=false;window.removeEventListener('daybridge:travel-prefs-updated',load)};
 },[]);
 return <LocationsContent {...records} {...focus} preferences={preferences} onOpenSchedule={onOpenSchedule}/>;
}

export function LocationsContent({savedPlaces,addSavedPlace,updateSavedPlace,deleteSavedPlace,events,eventOccurrences,syncStatus,preferences,onOpenSchedule,focusEventId,focusDate,focusRevision}:Records&Focus&{preferences:TravelPrefs;onOpenSchedule?:(date?:string)=>void}){
 const [editId,setEditId]=useState<string|null>(null);
 const [adding,setAdding]=useState(false),[label,setLabel]=useState(''),[category,setCategory]=useState<SavedPlaceCategory>('therapy');
 const [address,setAddress]=useState(''),[results,setResults]=useState<AddressResult[]>([]),[verified,setVerified]=useState<AddressResult|null>(null);
 const [searching,setSearching]=useState(false),[notice,setNotice]=useState('');
 const [destinationId,setDestinationId]=useState('');
 const [tripId,setTripId]=useState<string|null>(null);
 const [searchedDestination,setSearchedDestination]=useState<(AddressResult&{address:string})|null>(null);
 const [placeQuery,setPlaceQuery]=useState('');
 const [placeResults,setPlaceResults]=useState<Array<AddressResult&{address:string}>>([]);
 const [placeBusy,setPlaceBusy]=useState(false),[placeMessage,setPlaceMessage]=useState('');
 const [alt,setAlt]=useState(0),[showAdvanced,setShowAdvanced]=useState(false);
 const [currentFix,setCurrentFix]=useState<{point:Point;at:number}|null>(null);
 const [searchCenter,setSearchCenter]=useState<Point|null>(null);
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
 const trips=useMemo(()=>scheduledTrips(events,eventOccurrences,savedPlaces,now),[events,eventOccurrences,savedPlaces,now]);
 const handledFocus=React.useRef('');
 const [notificationNotice,setNotificationNotice]=useState('');
 useEffect(()=>{
  if(!focusEventId)return;
  const key=[focusEventId,focusDate,focusRevision].join(':');if(handledFocus.current===key)return;
  const match=trips.find(item=>item.eventId===focusEventId&&(!focusDate||calendarDayKey(item.startTime)===focusDate));
  if(match){setTripId(match.id);setDestinationId('');setNotificationNotice('');handledFocus.current=key;}
  else if(syncStatus==='synced'){setNotificationNotice('This appointment has changed or ended. Your current calendar trips are shown below.');}
 },[focusEventId,focusDate,focusRevision,trips,syncStatus]);
 const trip=trips.find(item=>item.id===tripId)||trips[0]||null;
 const manual=savedPlaces.find(place=>place.id===destinationId)||
  (destinationId==='__searched'&&searchedDestination?{...searchedDestination,id:'__searched'}:null);
 const activeTrip=manual?null:trip;
 const scheduledDestination=activeTrip?.destination?{...activeTrip.destination,id:'schedule-'+activeTrip.id,label:activeTrip.title,address:activeTrip.address}:null;
 const selected=manual||scheduledDestination;
 const approvedPoint={lat:preferences.saved_origin_lat,lon:preferences.saved_origin_lon};
 const approvedOrigin=validMapPoint(approvedPoint)?approvedPoint:null;
 const freshFix=currentFix&&now.getTime()-currentFix.at<120000?currentFix.point:null;
 const automaticOrigin=preferences.origin_kind==='saved'&&approvedOrigin?approvedOrigin:freshFix||approvedOrigin;
 const originLabel=!automaticOrigin?'a starting location':automaticOrigin===freshFix?'your current location':preferences.saved_origin_label||'your approved starting location';
 const mode=activeTrip?.travelMode||preferences.travel_mode;
 const target=selected?{id:selected.id,point:{lat:selected.lat,lon:selected.lon},mode,arriveAt:activeTrip?.startTime.toISOString()}:null;
 const {state:routeState,refresh}=useAutomaticRoute(target,automaticOrigin);
 const route=routeState?.result||null;
 const best=route?.routes[alt]||route?.routes[0]||null;
 const routeFrom=routeState?.from||null;
 useEffect(()=>setAlt(0),[route]);
 const onLocate=useCallback((point:Point)=>setCurrentFix(previous=>{
  // Keep GPS jitter from repeatedly recalculating an otherwise unchanged trip.
  const same=previous&&Math.abs(previous.point.lat-point.lat)<0.0005&&Math.abs(previous.point.lon-point.lon)<0.0005;
  return {point:same?previous.point:point,at:Date.now()};
 }),[]);
 const beginSearch=useTravelRequest(placeQuery);
 const beginAddress=useTravelRequest(address);
 useEffect(()=>{setPlaceBusy(false);setPlaceResults([]);setPlaceMessage('');},[placeQuery]);
 useEffect(()=>{setSearching(false);setResults([]);},[address]);
 function openAdd(forCategory:SavedPlaceCategory='therapy'){
  setAdding(true);setEditId(null);setLabel(niceCategory(forCategory));setAddress('');setCategory(forCategory);setVerified(null);setResults([]);setNotice('');
 }
 function edit(place:SavedPlace){
  setAdding(true);setEditId(place.id);setLabel(place.label);setAddress(place.address);
  setCategory(place.category);setVerified({label:place.address,lat:place.lat,lon:place.lon});
  setResults([]);setNotice('');
 }
 async function search(){
  if(address.trim().length<6)return setNotice('Enter a full street address and city.');
  setSearching(true);setResults([]);setVerified(null);setNotice('Checking the address with TomTom…');
  const request=beginAddress();
  try{
   const response=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:request.signal});
   if(!response.ok)throw Error('Lookup error');
   const body=await response.json() as {results?:AddressResult[]};
   if(!request.current())return;
   const found=(body.results||[]).filter(placeValid);
   setResults(found);setNotice(found.length?'Select the correct verified address.':'No locations found. Try adding the city and state.');
  }catch{if(request.current())setNotice('Address lookup unavailable. Check your connection and try again.')}
  finally{if(request.current())setSearching(false)}
 }
 function save(){
  if(!label.trim()||!verified){setNotice('Enter a place name and verify its address first.');return;}
  const exists=savedPlaces.some(p=>p.id!==editId&&p.category===category&&p.address.toLowerCase()===verified.label.toLowerCase());
  if(exists){setNotice('That address is already saved under this category.');return}
  const data={label:label.trim().slice(0,80),category,address:verified.label,lat:verified.lat,lon:verified.lon};
  if(editId)updateSavedPlace(editId,data);else addSavedPlace(data);
  setAdding(false);setNotice('Saved to your private locations.');
 }
 function remove(place:SavedPlace){
  if(!window.confirm('Remove '+place.label+' from your saved locations? Existing appointments will keep their address.'))return;
  deleteSavedPlace(place.id);if(destinationId===place.id)setDestinationId('')
 }
 async function searchPlaces(event:React.FormEvent){
  event.preventDefault();
  if(placeQuery.trim().length<2){setPlaceMessage('Enter a destination or place to search.');return;}
  setPlaceBusy(true);setPlaceMessage('Searching TomTom places…');setPlaceResults([]);
  const request=beginSearch();
  try{
   const response=await fetch('/api/travel/places',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:placeQuery.trim(),lat:searchCenter?.lat,lon:searchCenter?.lon}),signal:request.signal
   });
   if(!response.ok)throw new Error();
   const data=await response.json() as {results?:Array<AddressResult&{address:string}>};
   if(!request.current())return;
   const found=(data.results||[]).filter(placeValid);
   setPlaceResults(found);
   setPlaceMessage(found.length?'Select a result to show its route.':'No matching places. Include a city or street address.');
  }catch{if(request.current())setPlaceMessage('Place search unavailable. Check your connection and try again.');}
  finally{if(request.current())setPlaceBusy(false);}
 }
 const mapPlaces=useMemo<MapPlace[]>(()=>[
  ...savedPlaces.filter(p=>placeValid(p)).map(p=>({
   id:p.id,label:p.label,lat:p.lat,lon:p.lon,address:p.address
  })),
  ...placeResults.filter(placeValid).map((p,i)=>({
   id:p===searchedDestination?'__searched':'search-'+i,
   label:p.label,lat:p.lat,lon:p.lon,address:p.address
  })),
  ...(searchedDestination&&!placeResults.includes(searchedDestination)
   ?[{id:'__searched',label:searchedDestination.label,
      lat:searchedDestination.lat,lon:searchedDestination.lon,
      address:searchedDestination.address}]:[]),
  ...trips.filter(item=>item.destination).map(item=>({...item.destination!,id:'schedule-'+item.id,label:item.title,address:item.address}))
 ],[savedPlaces,placeResults,searchedDestination,trips]);
 const firstSaved=savedPlaces.find(placeValid);
 const initialMapCenter=approvedOrigin||
  (firstSaved?{lat:firstSaved.lat,lon:firstSaved.lon}:{lat:39.8283,lon:-98.5795});
 const initialMapZoom=approvedOrigin||firstSaved?12:4;
 const mapAreaLabel=approvedOrigin?'Centered on your approved starting point':
  firstSaved?'Centered on a saved location':'Showing United States — tap Use my location';
 function selectMapPlace(place:MapPlace){
  if(place.id.startsWith('schedule-')){
   setTripId(place.id.slice('schedule-'.length));setDestinationId('');return;
  }
  if(place.id==='__searched'||place.id.startsWith('search-')){
   const match=place.id==='__searched'?searchedDestination:placeResults.find((p,i)=>'search-'+i===place.id);
   if(match){setSearchedDestination(match);setDestinationId('__searched')}
  }else setDestinationId(place.id);
 }
 function openSchedule(){onOpenSchedule?.(activeTrip?calendarDayKey(activeTrip.startTime):undefined)}
 function directMapLink(place:{lat:number;lon:number}){const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',place.lat+','+place.lon);return url.toString();}
 return <div className="space-y-5 pb-24">
   {notificationNotice&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{notificationNotice}</p>}

  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950"><MapPinned className="h-6 w-6 text-teal-800"/>Locations & maps</h2>
    <p className="mt-1 text-sm text-slate-700">Your calendar supplies the trip. Routes and traffic load automatically.</p></div>
   <button onClick={()=>openAdd('therapy')} className="flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Add a place</button>
  </div>
  <ExploreMap
   initialCenter={initialMapCenter} initialZoom={initialMapZoom} areaLabel={mapAreaLabel}
   places={mapPlaces} selectedId={selected?.id||null}
   origin={routeFrom} route={best||null} onSelectPlace={selectMapPlace}
   onLocate={onLocate} onViewChange={setSearchCenter}
  />
  <TripDetails trip={activeTrip} destination={selected} origin={routeFrom||automaticOrigin} originLabel={originLabel}
   result={route} status={routeState?.status} mode={mode} now={now} index={alt} onChoose={setAlt} onRefresh={refresh}
   navigationEnabled={preferences.navigation_enabled} onOpenSchedule={onOpenSchedule?openSchedule:undefined}/>
  {(manual||trips.length>1)&&<div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3" aria-label="Calendar destinations">
   {manual&&<button type="button" onClick={()=>{setDestinationId('');setTripId(null)}} className="min-h-[44px] text-sm font-semibold text-teal-900 underline">Back to calendar trip</button>}
   {trips.length>1&&<label className="block text-sm font-semibold text-slate-800">Upcoming appointment
    <select aria-label="Upcoming appointment" value={manual?'':trip?.id||''} onChange={event=>{setDestinationId('');setTripId(event.target.value)}} className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white p-3">
     {manual&&<option value="">Choose a calendar appointment</option>}
     {trips.map(item=><option value={item.id} key={item.id}>{item.title} · {item.startTime.toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})}</option>)}
    </select>
   </label>}
  </div>}
  {destinationId==='__searched'&&searchedDestination&&<button type="button" onClick={()=>{
   setAdding(true);setEditId(null);setLabel(searchedDestination.label);setCategory('other');
   setAddress(searchedDestination.address);setVerified({...searchedDestination,label:searchedDestination.address});setResults([]);setNotice('Verified search result ready to save.');
  }} className="min-h-[44px] rounded-xl border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-900">Save this place</button>}
  <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Find a destination">
   <h3 className="text-base font-bold text-slate-950">Find a destination</h3>
   <p className="text-xs text-slate-700">Search addresses, businesses, and places using TomTom. You don't have to save a location first.</p>
   <form onSubmit={e=>void searchPlaces(e)} className="flex flex-wrap gap-2">
    <label className="min-w-[190px] flex-1 text-sm font-medium text-slate-800">Place or address
     <input value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)}
      placeholder="e.g. Pharmacy in Cleveland, GA" maxLength={90}
      className="mt-1 block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"/>
    </label>
    <button type="submit" disabled={placeBusy||placeQuery.trim().length<2}
     className="min-h-[44px] self-end rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
     {placeBusy?'Searching…':'Search'}
    </button>
   </form>
   {placeMessage&&<p role="status" className="text-xs text-slate-700">{placeMessage}</p>}
   {!!placeResults.length&&<div className="space-y-2" aria-label="Place search results">
    {placeResults.map((p,i)=><button key={i} type="button" onClick={()=>{
      setSearchedDestination(p);setDestinationId('__searched');
    }} className="block min-h-[52px] w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-teal-400">
     <strong className="block text-sm text-slate-950">{p.label}</strong>
     <span className="block text-xs text-slate-700">{p.address}</span>
    </button>)}
   </div>}
  </section>
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
   <h3 className="font-bold text-slate-900">Your saved places</h3>
   <p className="mt-1 text-xs text-slate-600">Only your signed-in account can access these private entries.</p>
   {!savedPlaces.length&&<div className="mt-4 space-y-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-950">
     <p>Choose the type of place to save first. DayBridge remembers its verified address for future appointments.</p>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {categories.filter(c=>c.id!=='other').map(c=><button type="button" key={c.id} onClick={()=>openAdd(c.id)} className="rounded-lg border border-teal-200 bg-white px-3 py-3 text-sm font-semibold text-teal-900">+ {c.label}</button>)}
     </div>
    </div>}
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {savedPlaces.map(p=><div key={p.id} className="rounded-xl border border-slate-200 p-3">
     <p className="text-xs font-semibold uppercase text-teal-800">{niceCategory(p.category)}</p>
     <p className="font-semibold text-slate-900">{p.label}</p>
     <p className="mt-1 text-xs leading-5 text-slate-700">{p.address}</p>
     <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={()=>setDestinationId(p.id)} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white">Show on map</button>
      <a href={directMapLink(p)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-900">Navigate</a>
      <button type="button" onClick={()=>edit(p)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800">Edit</button>
      <button type="button" aria-label={'Delete '+p.label} onClick={()=>remove(p)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-rose-800"><Trash2 className="h-4 w-4"/></button>
     </div>
    </div>)}
   </div>
  </section>
  {adding&&<section className="space-y-3 rounded-2xl border border-teal-300 bg-white p-4" aria-label={editId?'Edit saved place':'Add saved place'}>
   <h3 className="font-bold text-slate-950">{editId?'Edit place':'Save a new place'}</h3>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium text-slate-800">Type of place
     <select value={category} onChange={e=>{const newCategory=e.target.value as SavedPlaceCategory;if(label===niceCategory(category))setLabel(niceCategory(newCategory));setCategory(newCategory)}} className="mt-1 block w-full rounded-lg border border-slate-300 p-3">{categories.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select>
    </label>
    <label className="text-sm font-medium text-slate-800">Name (e.g. Tuesday group)
     <input maxLength={80} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Name this location" className="mt-1 block w-full rounded-lg border border-slate-300 p-3"/>
    </label>
   </div>
   <label className="block text-sm font-medium text-slate-800">Street address, city, state
    <input value={address} onChange={e=>{setAddress(e.target.value);setVerified(null)}} placeholder="123 Main St, Cleveland, GA" className="mt-1 block w-full rounded-lg border border-slate-300 p-3"/>
   </label>
   <button type="button" disabled={searching||address.trim().length<6} onClick={()=>void search()} className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50">Verify with TomTom</button>
   {!!results.length&&<div className="space-y-1">{results.map((r,i)=><button key={i} type="button" onClick={()=>{setVerified(r);setAddress(r.label);setResults([]);setNotice('Verified address selected.')}} className="block w-full rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50">{r.label}</button>)}</div>}
   {verified&&<p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-900"><MapPin className="mr-1 inline h-4 w-4"/>Verified: {verified.label}</p>}
   <div className="flex gap-2">
    <button type="button" disabled={!label.trim()||!verified||syncStatus==='offline'} onClick={save} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editId?'Save changes':'Save place'}</button>
    <button type="button" onClick={()=>{setAdding(false);setNotice('')}} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
   </div>
   {notice&&<p role="status" className="text-xs text-slate-700">{notice}</p>}
  </section>}
  <details className="rounded-2xl border border-slate-200 bg-white p-4" open={showAdvanced} onToggle={e=>setShowAdvanced(e.currentTarget.open)}>
   <summary className="cursor-pointer text-sm font-semibold text-slate-900">Travel settings & background alerts</summary>
   <div className="mt-4"><TravelPreferencesCard/></div>
   <p className="mt-3 text-xs text-slate-600">Background departure alerts also require an approved saved origin, notification permissions and an active server monitoring schedule. GPS is requested only when you choose it.</p>
  </details>
 </div>;
}
