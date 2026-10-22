'use client';
import React,{useEffect,useRef,useState} from 'react';
import type {Point,Route} from '../../lib/travel/types';
import {projectRoute} from '../../lib/travel/projection';
const publicKey=process.env.NEXT_PUBLIC_TOMTOM_MAP_KEY;
export function RouteMap({origin,destination,route}:{origin:Point;destination:Point;route:Route}){
 const holder=useRef<HTMLDivElement>(null),[failure,setFailure]=useState('');
 useEffect(()=>{
  if(!publicKey){setFailure('Interactive map requires its own browser-restricted TomTom map key. Route ETA remains available.');return;}
  let removed=false,instance:{mapLibreMap:{remove:()=>void}}|undefined;
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
    gl.on('load',render);if(gl.isStyleLoaded())render();
   }catch{if(!removed)setFailure('Map rendering unavailable on this device. Use the route details or open a navigation app.');}
  }
  void initialize();
  return()=>{removed=true;instance?.mapLibreMap.remove()};
 },[origin.lat,origin.lon,destination.lat,destination.lon,route]);
const [mapFailed,setMapFailed]=useState(false);
 const projected=projectRoute(route.points,origin,destination);
 const mapQuery=new URLSearchParams({
  lat:projected.center.lat.toFixed(6),
  lon:projected.center.lon.toFixed(6),zoom:String(projected.zoom)
 });
 if(!publicKey)return <div className="rounded-2xl border border-slate-200 bg-white p-3">
  <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-teal-50">
   {!mapFailed&&<img alt="" src={'/api/travel/static-map?'+mapQuery.toString()} onError={()=>setMapFailed(true)} className="absolute inset-0 h-full w-full" loading="lazy" draggable={false}/>}
   <svg viewBox="0 0 640 320" className="absolute inset-0 h-full w-full" role="img" aria-label="TomTom route overlay with start and destination; street map shown when available">
    <polyline points={projected.line} stroke="#fff" strokeWidth="8" opacity="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points={projected.line} stroke="#0f766e" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={projected.start.x} cy={projected.start.y} r="8" fill="#0f766e" stroke="#fff" strokeWidth="2"/>
    <circle cx={projected.finish.x} cy={projected.finish.y} r="8" fill="#b45309" stroke="#fff" strokeWidth="2"/>
   </svg>
  </div>
  <p className="mt-2 text-xs text-slate-700">{mapFailed?'Street-map imagery unavailable; showing the route geometry instead.':'Street map and route supplied by TomTom. Open navigation for live spoken guidance.'}</p>
 </div>;
 return <div><div ref={holder} aria-label="TomTom route map" role="img" className="h-64 w-full rounded-xl border border-slate-200 bg-slate-100"/>{failure&&<p className="mt-2 text-xs text-slate-600" role="status">{failure}</p>}</div>;
}
