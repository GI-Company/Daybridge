'use client';
import React,{useEffect,useRef,useState} from 'react';
import type {Point,Route} from '../../lib/travel/types';
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
const raw=route.points.length?route.points:[origin,destination];
 const x=raw.map(p=>p.lon),y=raw.map(p=>p.lat);
 const minX=Math.min(...x),maxX=Math.max(...x),minY=Math.min(...y),maxY=Math.max(...y);
 const scaleX=(lon:number)=>20+(lon-minX)/(maxX-minX||1)*360;
 const scaleY=(lat:number)=>180-(lat-minY)/(maxY-minY||1)*160;
 const line=raw.filter((_,i)=>i%Math.max(1,Math.floor(raw.length/800))===0).map(p=>scaleX(p.lon).toFixed(1)+','+scaleY(p.lat).toFixed(1)).join(' ');
 if(!publicKey)return <div className="rounded-2xl border border-slate-200 bg-white p-3">
  <svg viewBox="0 0 400 200" className="w-full rounded-lg bg-teal-50" role="img" aria-label="Route geometry preview derived from TomTom route coordinates; this is not a street map">
   <polyline points={line} stroke="#0f766e" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
   <circle cx={scaleX(origin.lon)} cy={scaleY(origin.lat)} r="7" fill="#0f766e"/>
   <circle cx={scaleX(destination.lon)} cy={scaleY(destination.lat)} r="7" fill="#b45309"/>
  </svg>
  <p className="mt-2 text-xs text-slate-700">Actual TomTom route shape. Street-map tiles require a separately restricted map-display key; route ETA and external navigation remain available.</p>
 </div>;
 return <div><div ref={holder} aria-label="TomTom route map" role="img" className="h-64 w-full rounded-xl border border-slate-200 bg-slate-100"/>{failure&&<p className="mt-2 text-xs text-slate-600" role="status">{failure}</p>}</div>;
}
