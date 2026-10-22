'use client';

import React,{useEffect,useMemo,useState} from 'react';
import {MapPinned,Plus,Trash2,Navigation,Route as RouteIcon,MapPin,LocateFixed} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import {createClient} from '../../lib/supabase/client';
import type {SavedPlace,SavedPlaceCategory} from '../../lib/types';
import {defaults,mapsUrl,type Mode,type Point,type RouteResult} from '../../lib/travel/types';
import {ExploreMap,type MapPlace} from './ExploreMap';
import {TravelPreferencesCard} from './TravelPreferences';

type AddressResult=Point&{label:string};
const categories:{id:SavedPlaceCategory;label:string}[]=[
 {id:'home',label:'Home'}, {id:'work',label:'Work'},
 {id:'therapy',label:'Therapy'}, {id:'class',label:'Classes'},
 {id:'drug_testing',label:'Drug testing'}, {id:'court',label:'Court'},
 {id:'other',label:'Other'}
];
const niceCategory=(key:SavedPlaceCategory)=>categories.find(c=>c.id===key)?.label||'Other';
function placeValid(p:AddressResult){return Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
export function LocationsView(){
 const {savedPlaces,addSavedPlace,updateSavedPlace,deleteSavedPlace,events,syncStatus}=useDayBridge();
 const [editId,setEditId]=useState<string|null>(null);
 const [adding,setAdding]=useState(false),[label,setLabel]=useState(''),[category,setCategory]=useState<SavedPlaceCategory>('therapy');
 const [address,setAddress]=useState(''),[results,setResults]=useState<AddressResult[]>([]),[verified,setVerified]=useState<AddressResult|null>(null);
 const [searching,setSearching]=useState(false),[notice,setNotice]=useState('');
 const [originChoice,setOriginChoice]=useState('current');
 const [destinationId,setDestinationId]=useState('');
 const [searchedDestination,setSearchedDestination]=useState<(AddressResult&{address:string})|null>(null);
 const [placeQuery,setPlaceQuery]=useState('');
 const [placeResults,setPlaceResults]=useState<Array<AddressResult&{address:string}>>([]);
 const [placeBusy,setPlaceBusy]=useState(false);
 const [placeMessage,setPlaceMessage]=useState('');
 const [mode,setMode]=useState<Mode>('car');
 const [route,setRoute]=useState<RouteResult|null>(null),[routeFrom,setRouteFrom]=useState<Point|null>(null);
 const [routeBusy,setRouteBusy]=useState(false),[routeMessage,setRouteMessage]=useState('');
 const [alt,setAlt]=useState(0),[showAdvanced,setShowAdvanced]=useState(false);
 const [approvedOrigin,setApprovedOrigin]=useState<Point|null>(null);
 const db=createClient();
 useEffect(()=>{
  let valid=true;
  db?.from('travel_preferences')
   .select('travel_mode,saved_origin_lat,saved_origin_lon').maybeSingle()
   .then(({data}:{data:{travel_mode?:Mode;saved_origin_lat?:number|null;saved_origin_lon?:number|null}|null})=>{
    if(!valid)return;
    if(data?.travel_mode)setMode(data.travel_mode);
    if(typeof data?.saved_origin_lat==='number'&&typeof data?.saved_origin_lon==='number'){
     const point={lat:data.saved_origin_lat,lon:data.saved_origin_lon};
     if(placeValid({...point,label:'Approved origin'}))setApprovedOrigin(point);
    }
   });
  return()=>{valid=false};
 // The existing Supabase preference load runs once when entering Locations & Maps.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const selected=savedPlaces.find(p=>p.id===destinationId)||
  (destinationId==='__searched'&&searchedDestination
   ?{...searchedDestination,id:'__searched',category:'other' as const,userId:'',createdAt:'',updatedAt:''}
   :null);
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
  try{
   const response=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});
   if(!response.ok)throw Error('Lookup error');
   const body=await response.json() as {results?:AddressResult[]};
   const found=(body.results||[]).filter(placeValid);
   setResults(found);setNotice(found.length?'Select the correct verified address.':'No locations found. Try adding the city and state.');
  }catch{setNotice('Address lookup unavailable. Your saved locations have not changed.')}
  finally{setSearching(false)}
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
  deleteSavedPlace(place.id);if(destinationId===place.id){setDestinationId('');setRoute(null)}
 }
 async function searchPlaces(event:React.FormEvent){
  event.preventDefault();
  if(placeQuery.trim().length<2){setPlaceMessage('Enter a destination or place to search.');return;}
  setPlaceBusy(true);setPlaceMessage('Searching TomTom places…');setPlaceResults([]);
  try{
   const response=await fetch('/api/travel/places',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:placeQuery.trim()})
   });
   if(!response.ok)throw new Error();
   const data=await response.json() as {results?:Array<AddressResult&{address:string}>};
   const found=(data.results||[]).filter(placeValid);
   setPlaceResults(found);
   setPlaceMessage(found.length?'Select a result to plan a route.':'No matching places. Include a city or street address.');
  }catch{setPlaceMessage('Place search temporarily unavailable. Saved places still work.');}
  finally{setPlaceBusy(false);}
 }
 async function calculate(){
  if(!selected)return setRouteMessage('Choose a destination.');
  setRouteBusy(true);setRoute(null);setRouteMessage('Getting traffic-aware routes…');
  let from:Point|null=null;
  if(originChoice==='current'){
   if(!navigator.geolocation){setRouteMessage('GPS is unavailable. Choose a saved origin instead.');setRouteBusy(false);return}
   from=await new Promise<Point|null>(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),()=>resolve(null),{timeout:15000,maximumAge:60000,enableHighAccuracy:false}));
  }else{
   const origin=savedPlaces.find(p=>p.id===originChoice);
   if(origin)from={lat:origin.lat,lon:origin.lon};
  }
  if(!from){setRouteMessage('Location unavailable or permission declined. Choose a saved origin or allow GPS.');setRouteBusy(false);return}
  try{
   const response=await fetch('/api/travel/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin:from,destination:{lat:selected.lat,lon:selected.lon},travelMode:mode})});
   if(!response.ok)throw Error('Route request failed');
   const data=await response.json() as RouteResult;
   if(!data.routes.length)throw Error('No route');
   setRoute(data);setRouteFrom(from);setAlt(0);setRouteMessage('Route calculated. Times can change with traffic.');
  }catch{setRouteMessage('TomTom routing is currently unavailable. You can still open navigation below.')}
  finally{setRouteBusy(false)}
 }
 const destination=selected?{lat:selected.lat,lon:selected.lon}:null;
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
      address:searchedDestination.address}]:[])
 ],[savedPlaces,placeResults,searchedDestination]);
 const firstSaved=savedPlaces.find(placeValid);
 const initialMapCenter=approvedOrigin||
  (firstSaved?{lat:firstSaved.lat,lon:firstSaved.lon}:{lat:39.8283,lon:-98.5795});
 const initialMapZoom=approvedOrigin||firstSaved?12:4;
 const mapAreaLabel=approvedOrigin?'Centered on your approved starting point':
  firstSaved?'Centered on a saved location':'Showing United States — tap Use my location';
 function selectMapPlace(place:MapPlace){
  if(place.id==='__searched'||place.id.startsWith('search-')){
   const match=place.id==='__searched'
    ?searchedDestination
    :placeResults.find((p,i)=>p!==searchedDestination&&'search-'+i===place.id);
   if(match){setSearchedDestination(match);setDestinationId('__searched')}
  }else{
   setDestinationId(place.id);
  }
  setRoute(null);setRouteFrom(null);
  setRouteMessage('Destination selected. Preview a route if you want travel time.');
 }

 const best=route?.routes[alt];
 // Android navigation can open using only the destination; no GPS or route preview required.
 function directMapLink(place:SavedPlace){const u=new URL('https://www.google.com/maps/dir/');u.searchParams.set('api','1');u.searchParams.set('destination',place.lat+','+place.lon);return u.toString();}
 return <div className="space-y-5 pb-24">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950"><MapPinned className="h-6 w-6 text-teal-800"/>Locations & maps</h2>
    <p className="mt-1 text-sm text-slate-700">Save places once. Select them for appointments or travel without typing again.</p></div>
   <button onClick={()=>openAdd('therapy')} className="flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Add a place</button>
  </div>
  <ExploreMap
   initialCenter={initialMapCenter} initialZoom={initialMapZoom} areaLabel={mapAreaLabel}
   places={mapPlaces} selectedId={selected?.id||null}
   origin={routeFrom} route={best||null} onSelectPlace={selectMapPlace}
  />
  {selected&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
   <div className="min-w-0">
    <p className="text-xs font-semibold text-teal-950">Selected destination</p>
    <p className="truncate text-sm text-slate-900">{selected.label}</p>
   </div>
   <button type="button" disabled={routeBusy} onClick={()=>void calculate()}
    className="min-h-[44px] rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
    {routeBusy?'Checking traffic…':'Get route & ETA'}
   </button>
  </div>}
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
      setRoute(null);setRouteMessage('Destination selected. Choose a starting point to preview the route.');
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
      <button type="button" onClick={()=>{setDestinationId(p.id);setRoute(null);setRouteMessage('Select an origin, then preview this trip.')}} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white">Plan trip</button>
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
  {(savedPlaces.length>0||searchedDestination)&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
   <h3 className="flex items-center gap-2 font-bold text-slate-900"><RouteIcon className="h-5 w-5 text-teal-800"/>Plan a trip</h3>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium text-slate-800">From
     <select value={originChoice} onChange={e=>{setOriginChoice(e.target.value);setRoute(null)}} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3">
      <option value="current">My current location (ask GPS)</option>
      {savedPlaces.map(p=><option key={p.id} value={p.id}>{p.label} · {niceCategory(p.category)}</option>)}
     </select>
    </label>
    <label className="text-sm font-medium text-slate-800">To
     <select value={destinationId} onChange={e=>{setDestinationId(e.target.value);setRoute(null)}} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3">
      <option value="">Choose a place</option>
      {searchedDestination&&<option value="__searched">{searchedDestination.label} · Search result</option>}
      {savedPlaces.map(p=><option key={p.id} value={p.id}>{p.label} · {niceCategory(p.category)}</option>)}
     </select>
    </label>
   </div>
   <label className="block text-sm font-medium text-slate-800">Travel mode
    <select value={mode} onChange={e=>{setMode(e.target.value as Mode);setRoute(null)}} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="car">Driving / traffic</option><option value="pedestrian">Walking</option><option value="bicycle">Cycling</option></select>
   </label>
   <button type="button" disabled={!selected||routeBusy||originChoice===destinationId} onClick={()=>void calculate()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 p-3 text-sm font-bold text-white disabled:opacity-50"><LocateFixed className="h-4 w-4"/>Preview route & traffic</button>
   {routeMessage&&<p role="status" className="text-xs text-slate-700">{routeMessage}</p>}
   {selected&&<a href={directMapLink(selected)} rel="noopener noreferrer" target="_blank" className="flex items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white p-3 text-sm font-semibold text-teal-900"><Navigation className="h-4 w-4"/>Open navigation to {selected.label}</a>}
   {best&&routeFrom&&destination&&<div className="space-y-3">
    <div className="flex flex-wrap gap-2">{route!.routes.map((r,i)=><button key={i} type="button" onClick={()=>setAlt(i)} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(i===alt?'bg-teal-800 text-white':'bg-white text-slate-800')}>{i===0?'Fastest':'Alternative '+i} · {Math.ceil(r.durationSeconds/60)} min</button>)}</div>
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
     <p><strong>Travel</strong><br/>{Math.ceil(best.durationSeconds/60)} minutes</p>
     <p><strong>Traffic delay</strong><br/>{Math.ceil(best.delaySeconds/60)} minutes</p>
     <p><strong>Distance</strong><br/>{(best.distanceMeters/1609.344).toFixed(1)} miles</p>
     <p><strong>Arrival ETA</strong><br/>{new Date(Date.now()+best.durationSeconds*1000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <a target="_blank" rel="noopener noreferrer" href={mapsUrl('google',routeFrom,destination,mode)} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white">Google Maps</a>
     <a target="_blank" rel="noopener noreferrer" href={mapsUrl('apple',routeFrom,destination,mode)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800">Apple Maps</a>
    </div>
    {!!best.instructions?.length&&<details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-900">Turn-by-turn route instructions</summary><ol className="mt-2 max-h-64 list-decimal space-y-2 overflow-auto pl-5 text-xs text-slate-700">{best.instructions.map((item,i)=><li key={i}>{item}</li>)}</ol></details>}
   </div>}
  </section>}
  <details className="rounded-2xl border border-slate-200 bg-white p-4" open={showAdvanced} onToggle={e=>setShowAdvanced(e.currentTarget.open)}>
   <summary className="cursor-pointer text-sm font-semibold text-slate-900">Travel settings & background alerts</summary>
   <div className="mt-4"><TravelPreferencesCard/></div>
   <p className="mt-3 text-xs text-slate-600">Background departure alerts also require an approved saved origin, notification permissions and an active server monitoring schedule. GPS is requested only when you choose it.</p>
  </details>
 </div>;
}
