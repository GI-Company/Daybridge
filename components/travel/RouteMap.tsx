'use client';

import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {Point, Route} from '../../lib/travel/types';
import {projectRoute} from '../../lib/travel/projection';

// Only use a browser key if it is independently configured and origin-restricted.
// Otherwise DayBridge proxies the static map through its authenticated server API.
const publicKey=process.env.NEXT_PUBLIC_TOMTOM_MAP_KEY;

export function RouteMap({origin,destination,route}:{origin:Point;destination:Point;route:Route}){
 const holder=useRef<HTMLDivElement>(null);
 const [failure,setFailure]=useState('');
 const [retry,setRetry]=useState(0);
 const [mapState,setMapState]=useState<{src:string;loading:boolean;error:string}>({src:'',loading:true,error:''});
 const projected=useMemo(()=>projectRoute(route.points,origin,destination),[route,origin.lat,origin.lon,destination.lat,destination.lon]);
 const mapQuery=new URLSearchParams({
  lat:projected.center.lat.toFixed(6),
  lon:projected.center.lon.toFixed(6),
  zoom:String(projected.zoom)
 }).toString();

 useEffect(()=>{
  if(!publicKey)return;
  let removed=false;
  let instance:{mapLibreMap:{remove:()=>void}}|undefined;
  async function initialize(){
   try{
    const [{TomTomConfig},{TomTomMap}]=await Promise.all([import('@tomtom-org/maps-sdk/core'),import('@tomtom-org/maps-sdk/map')]);
    if(!holder.current||removed)return;
    TomTomConfig.instance.put({apiKey:publicKey!,language:'en-US'});
    const map=new TomTomMap({mapLibre:{container:holder.current,center:[origin.lon,origin.lat],zoom:12}});
    instance=map;
    const gl=map.mapLibreMap;
    const render=()=>{
     if(removed||gl.getSource('daybridge-route'))return;
     const line=route.points.length?route.points:[origin,destination];
     gl.addSource('daybridge-route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:line.map(x=>[x.lon,x.lat])},properties:{}}});
     gl.addLayer({id:'daybridge-route-line',source:'daybridge-route',type:'line',paint:{'line-color':'#0f766e','line-width':6}});
     const xs=line.map(x=>x.lon),ys=line.map(x=>x.lat);
     gl.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:36,maxZoom:15});
    };
    gl.on('load',render);
    if(gl.isStyleLoaded())render();
   }catch{
    if(!removed)setFailure('Interactive map rendering is unavailable. Use route details or open navigation.');
   }
  }
  void initialize();
  return()=>{removed=true;instance?.mapLibreMap.remove();};
 },[origin.lat,origin.lon,destination.lat,destination.lon,route]);

 useEffect(()=>{
  if(publicKey)return;
  let cancelled=false;
  let objectUrl='';
  const controller=new AbortController();
  setMapState({src:'',loading:true,error:''});
  async function load(){
   try{
    const response=await fetch('/api/travel/static-map?'+mapQuery,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!response.ok){
     const body=await response.json().catch(()=>null) as {error?:string}|null;
     throw new Error(body?.error||('Street map unavailable (HTTP '+response.status+').'));
    }
    const type=response.headers.get('content-type')||'';
    if(!type.startsWith('image/'))throw new Error('Street map returned an unexpected format.');
    const imageBlob=await response.blob();
    if(cancelled)return;
    objectUrl=URL.createObjectURL(imageBlob);
    setMapState({src:objectUrl,loading:false,error:''});
   }catch(error){
    if(cancelled)return;
    setMapState({src:'',loading:false,error:error instanceof Error?error.message:'Street map unavailable.'});
   }
  }
  void load();
  return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[mapQuery,retry]);

 if(publicKey)return <div>
  <div ref={holder} aria-label="TomTom route map" role="img" className="h-64 w-full rounded-xl border border-slate-200 bg-slate-100"/>
  {failure&&<p className="mt-2 text-xs text-slate-600" role="status">{failure}</p>}
 </div>;

 return <div className="rounded-2xl border border-slate-200 bg-white p-3">
  <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-teal-50">
   {mapState.src&&<img src={mapState.src} alt="TomTom street map" className="absolute inset-0 h-full w-full" draggable={false} />}
   <svg viewBox="0 0 640 320" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" role="img" aria-label="Selected route with start and destination markers">
    <polyline points={projected.line} stroke="#ffffff" strokeWidth="9" opacity="0.95" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points={projected.line} stroke="#00645f" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={projected.start.x} cy={projected.start.y} r="9" fill="#00645f" stroke="#ffffff" strokeWidth="3"/>
    <circle cx={projected.finish.x} cy={projected.finish.y} r="9" fill="#b45309" stroke="#ffffff" strokeWidth="3"/>
   </svg>
   {mapState.loading&&<span role="status" className="absolute left-3 bottom-3 rounded-md bg-white/95 px-2 py-1 text-xs text-slate-800">Loading street map…</span>}
  </div>
  {mapState.error?<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
    <p role="status" className="text-xs text-slate-700">{mapState.error} Route geometry is still shown.</p>
    <button type="button" onClick={()=>setRetry(n=>n+1)} className="rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-900">Retry street map</button>
   </div>:<p className="mt-2 text-xs text-slate-700">{mapState.loading?'Retrieving TomTom Map Display imagery…':'TomTom street map with your selected route. Open navigation for spoken directions.'}</p>}
 </div>;
}
