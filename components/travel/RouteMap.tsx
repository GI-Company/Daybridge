'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as MapLibreInstance} from 'maplibre-gl';
import type {Point,Route} from '../../lib/travel/types';
import {projectRoute} from '../../lib/travel/projection';
import {validMapPoint} from '../../lib/travel/geometry';

export function RouteMap({origin,destination,route}:{origin:Point;destination:Point;route:Route}){
 const holder=useRef<HTMLDivElement>(null);
 const mapRef=useRef<MapLibreInstance|null>(null);
 const [showTraffic,setShowTraffic]=useState(false);
 const [showIncidents,setShowIncidents]=useState(false);
 const trafficWanted=useRef(showTraffic);
 const incidentsWanted=useRef(showIncidents);
 const [overlayNotice,setOverlayNotice]=useState('');
 trafficWanted.current=showTraffic;
 incidentsWanted.current=showIncidents;
 const [fallback,setFallback]=useState(false);
 const [reason,setReason]=useState('');
 const [retry,setRetry]=useState(0);
 const [loading,setLoading]=useState(true);
 const [staticState,setStaticState]=useState<{src:string;loading:boolean;error:string}>({
  src:'',loading:false,error:''
 });
 // TomTom Routing v1 points must first be converted from latitude/longitude
 // to lat/lon. Guard stale snapshots from older DayBridge versions as well.
 const points=useMemo(()=>route.points.filter(validMapPoint),
  [route.points]);
 const projected=useMemo(()=>projectRoute(points,origin,destination),
  [points,origin.lat,origin.lon,destination.lat,destination.lon]);
 const query=new URLSearchParams({
  lat:projected.center.lat.toFixed(6),
  lon:projected.center.lon.toFixed(6),
  zoom:String(projected.zoom)
 }).toString();

 useEffect(()=>{
  if(!mapRef.current||fallback)return;
  if(mapRef.current.getLayer('daybridge-traffic-flow')){
   mapRef.current.setLayoutProperty('daybridge-traffic-flow','visibility',showTraffic?'visible':'none');
  }
 },[showTraffic,fallback]);
 useEffect(()=>{
  if(!mapRef.current||fallback)return;
  if(mapRef.current.getLayer('daybridge-traffic-incidents')){
   mapRef.current.setLayoutProperty('daybridge-traffic-incidents','visibility',showIncidents?'visible':'none');
  }
 },[showIncidents,fallback]);
 useEffect(()=>{
  if(fallback)return;
  let cancelled=false;
  let map:MapLibreInstance|null=null;
  let watchdog:ReturnType<typeof setTimeout>|null=null;
  setLoading(true);
  async function mount(){
   try{
    if(!holder.current||!validMapPoint(origin)||!validMapPoint(destination)){
     throw new Error('The starting or destination coordinates are invalid.');
    }
    const {Map:MapLibreMap,LngLatBounds}=await import('maplibre-gl');
    if(cancelled||!holder.current)return;
    const instance=new MapLibreMap({
     container:holder.current,
     center:[projected.center.lon,projected.center.lat],
     zoom:projected.zoom,
     minZoom:2,maxZoom:18,
     attributionControl:{compact:true},
     style:{
      version:8,
      sources:{
       'orbis-streets':{
        type:'raster',
        tiles:['/api/travel/map-tile/{z}/{x}/{y}'],
        tileSize:256,
        minzoom:0,maxzoom:18,
        attribution:'© TomTom'
       }
      },
      layers:[{id:'orbis-base',type:'raster',source:'orbis-streets'}]
     }
    });
    map=instance;
    mapRef.current=instance;
    // If the base raster cannot load, do not leave an empty map on screen.
    watchdog=setTimeout(()=>{
      if(cancelled||mapRef.current!==instance)return;
      if(!instance.isSourceLoaded('orbis-streets')){
       setReason('Street tiles did not finish loading. Trying static imagery.');
       setFallback(true);
      }
    },14000);
    instance.on('error',(e)=>{
     if(cancelled)return;
     const detail=String(e.error?.message||'');
     const sourceId=(e as {sourceId?:string}).sourceId;
     // Optional overlays must NEVER blank an otherwise functioning street map.
     if(sourceId==='daybridge-flow'||sourceId==='daybridge-incidents'||
        detail.includes('/map-overlay/')){
      setOverlayNotice('A traffic overlay is temporarily unavailable. The street map and routing still work.');
      return;
     }
     setReason('Street-map imagery unavailable. Trying the static map.');
     setFallback(true);
    });
    instance.on('sourcedata',(e)=>{
     if(!cancelled&&e.sourceId==='orbis-streets'&&e.isSourceLoaded){
      setLoading(false);
      if(watchdog){clearTimeout(watchdog);watchdog=null;}
     }
    });
    instance.on('load',()=>{
     if(cancelled)return;
     const line=[origin,...points,destination];
     const coordinates=line.map(p=>[p.lon,p.lat] as [number,number]);
     // Traffic overlays are optional and come from the user's traffic-enabled
     // TomTom key, not the map-display-only key.
     instance.addSource('daybridge-flow',{
      type:'raster',tiles:['/api/travel/map-overlay/flow/{z}/{x}/{y}'],
      tileSize:256,minzoom:0,maxzoom:18,attribution:'© TomTom Traffic'
     });
     instance.addLayer({
      id:'daybridge-traffic-flow',type:'raster',source:'daybridge-flow',
      layout:{visibility:trafficWanted.current?'visible':'none'},
      paint:{'raster-opacity':0.86}
     });
     instance.addSource('daybridge-incidents',{
      type:'raster',tiles:['/api/travel/map-overlay/incidents/{z}/{x}/{y}'],
      tileSize:256,minzoom:0,maxzoom:18,attribution:'© TomTom Traffic'
     });
     instance.addLayer({
      id:'daybridge-traffic-incidents',type:'raster',source:'daybridge-incidents',
      layout:{visibility:incidentsWanted.current?'visible':'none'},
      paint:{'raster-opacity':0.96}
     });
     instance.addSource('daybridge-route',{
      type:'geojson',data:{type:'Feature',properties:{},
       geometry:{type:'LineString',coordinates}}
     });
     instance.addLayer({
      id:'route-casing',type:'line',source:'daybridge-route',
      paint:{'line-color':'#ffffff','line-width':9,'line-opacity':0.95}
     });
     instance.addLayer({
      id:'route-highlight',type:'line',source:'daybridge-route',
      paint:{'line-color':'#00645f','line-width':5}
     });
     instance.addSource('daybridge-endpoints',{
      type:'geojson',data:{type:'FeatureCollection',features:[
       {type:'Feature',properties:{kind:'start'},
        geometry:{type:'Point',coordinates:[origin.lon,origin.lat]}},
       {type:'Feature',properties:{kind:'finish'},
        geometry:{type:'Point',coordinates:[destination.lon,destination.lat]}}
      ]}
     });
     instance.addLayer({
      id:'daybridge-pins',type:'circle',source:'daybridge-endpoints',
      paint:{
       'circle-radius':8,
       'circle-color':['match',['get','kind'],'start','#00645f','#b45309'],
       'circle-stroke-color':'#ffffff','circle-stroke-width':3
      }
     });
     const bounds=new LngLatBounds([origin.lon,origin.lat],[origin.lon,origin.lat]);
     for(const p of [...points,destination])bounds.extend([p.lon,p.lat]);
     instance.fitBounds(bounds,{padding:40,maxZoom:15,duration:0});
     instance.resize();
    });
   }catch{
    if(!cancelled){setReason('Interactive map unavailable. Trying a static street map.');setFallback(true)}
   }
  }
  void mount();
  return()=>{
   cancelled=true;
   if(watchdog)clearTimeout(watchdog);
   if(mapRef.current===map)mapRef.current=null;
   map?.remove();
  };
 },[fallback,retry,points,origin.lat,origin.lon,destination.lat,destination.lon,
    projected.center.lat,projected.center.lon,projected.zoom]);

 useEffect(()=>{
  if(!fallback)return;
  let cancelled=false;
  let objectUrl='';
  const controller=new AbortController();
  setStaticState({src:'',loading:true,error:''});
  void (async()=>{
   try{
    const response=await fetch('/api/travel/static-map?'+query,{
     credentials:'same-origin',cache:'no-store',signal:controller.signal
    });
    if(!response.ok){
     const j=await response.json().catch(()=>null) as {error?:string}|null;
     throw Error(j?.error||'Street image HTTP '+response.status);
    }
    if(!response.headers.get('content-type')?.startsWith('image/'))
     throw Error('Invalid street image format');
    const blob=await response.blob();
    if(cancelled)return;
    objectUrl=URL.createObjectURL(blob);
    setStaticState({src:objectUrl,loading:false,error:''});
   }catch(error){
    if(!cancelled)setStaticState({src:'',loading:false,
     error:error instanceof Error?error.message:'Static map unavailable'});
   }
  })();
  return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[fallback,query,retry]);

 return <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="TomTom route map">
  {!fallback&&<div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Optional map layers">
   <button type="button" aria-pressed={showTraffic} onClick={()=>{setShowTraffic(v=>!v);setOverlayNotice('')}}
    className={'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold '+
      (showTraffic?'border-teal-700 bg-teal-800 text-white':'border-slate-300 bg-white text-slate-900')}>
    {showTraffic?'✓ ':''}Traffic flow
   </button>
   <button type="button" aria-pressed={showIncidents} onClick={()=>{setShowIncidents(v=>!v);setOverlayNotice('')}}
    className={'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold '+
      (showIncidents?'border-teal-700 bg-teal-800 text-white':'border-slate-300 bg-white text-slate-900')}>
    {showIncidents?'✓ ':''}Road incidents
   </button>
  </div>}
  {overlayNotice&&!fallback&&<p role="status" className="mb-2 text-xs text-amber-900">{overlayNotice}</p>}
  {!fallback?<div className="relative">
   <div ref={holder} className="h-[320px] w-full overflow-hidden rounded-xl bg-teal-50"
    aria-label="Interactive TomTom street map showing your route" role="region"/>
   {loading&&<span role="status"
     className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-900">
      Loading TomTom street map…
    </span>}
  </div>:<>
   <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-teal-50">
    {staticState.src&&<img src={staticState.src} alt="TomTom street map"
     className="absolute inset-0 h-full w-full object-cover" draggable={false}/>}
    <svg viewBox="0 0 640 320" preserveAspectRatio="xMidYMid meet"
     className="absolute inset-0 h-full w-full" role="img"
     aria-label="Fallback route line and start/end markers">
     <polyline points={projected.line} stroke="#ffffff" strokeWidth="9"
      fill="none" strokeLinecap="round" strokeLinejoin="round"/>
     <polyline points={projected.line} stroke="#00645f" strokeWidth="5"
      fill="none" strokeLinecap="round" strokeLinejoin="round"/>
     <circle cx={projected.start.x} cy={projected.start.y} r="9"
      fill="#00645f" stroke="#ffffff" strokeWidth="3"/>
     <circle cx={projected.finish.x} cy={projected.finish.y} r="9"
      fill="#b45309" stroke="#ffffff" strokeWidth="3"/>
    </svg>
    {staticState.loading&&<span role="status"
     className="absolute bottom-3 left-3 rounded-md bg-white/95 px-2 py-1 text-xs text-slate-900">
     Loading fallback map…
    </span>}
   </div>
   {(staticState.error||reason)&&<p className="mt-2 text-xs text-slate-700" role="status">
    {staticState.error||reason}
    {staticState.error?' Route geometry remains visible.':''}
   </p>}
   <button type="button" onClick={()=>{setReason('');setStaticState({src:'',loading:false,error:''});setFallback(false);setRetry(x=>x+1)}}
    className="mt-2 min-h-[44px] rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-900">
    Retry interactive street map
   </button>
  </>}
  <p className="mt-2 text-xs text-slate-600">
   TomTom street imagery with your selected route. Use a navigation app for spoken directions.
  </p>
 </section>;
}
