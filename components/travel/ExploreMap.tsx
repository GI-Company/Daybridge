'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as MapLibreMap,GeoJSONSource} from 'maplibre-gl';
import type {Point,Route} from '../../lib/travel/types';
import {validMapPoint} from '../../lib/travel/geometry';

export type MapPlace={id:string;label:string;lat:number;lon:number;address?:string};
type Props={
 initialCenter:Point;initialZoom:number;areaLabel:string;
 places:MapPlace[];selectedId:string|null;origin:Point|null;route:Route|null;
 onSelectPlace:(place:MapPlace)=>void;
};
type Feature=GeoJSON.Feature<GeoJSON.Point,GeoJSON.GeoJsonProperties>;
type Line=GeoJSON.Feature<GeoJSON.LineString,GeoJSON.GeoJsonProperties>;
const xyz=(point:Point):[number,number]=>[point.lon,point.lat];
const fallbackCenter:Point={lat:39.8283,lon:-98.5795};

export function ExploreMap({
 initialCenter,initialZoom,areaLabel,places,selectedId,origin,route,onSelectPlace
}:Props){
 const host=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<MapLibreMap|null>(null);
 const selectionRef=useRef(onSelectPlace);
 selectionRef.current=onSelectPlace;
 const placesRef=useRef(places);
 placesRef.current=places;
 const hasInteracted=useRef(false);
 const gpsSelected=useRef(false);
 const [retry,setRetry]=useState(0);
 const [showFlow,setShowFlow]=useState(false);
 const [showIncidents,setShowIncidents]=useState(false);
 const [mapError,setMapError]=useState('');
 const [overlayError,setOverlayError]=useState('');
 const [tilesLoaded,setTilesLoaded]=useState(false);
 const [gpsState,setGpsState]=useState<'idle'|'locating'|'current'|'unavailable'>('idle');
 const [currentFix,setCurrentFix]=useState<Point|null>(null);
 const [staticUrl,setStaticUrl]=useState('');
 const [staticError,setStaticError]=useState('');
 const [fallbackView,setFallbackView]=useState<{point:Point;zoom:number}>({
  point:validMapPoint(initialCenter)?initialCenter:fallbackCenter,zoom:initialZoom
 });
 const currentPoint=validMapPoint(initialCenter)?initialCenter:fallbackCenter;
 const mapPlaces=useMemo(()=>places.filter(p=>validMapPoint(p)),[places]);
 const markerFeatures=useMemo<Feature[]>(()=>mapPlaces.map(p=>({
  type:'Feature',properties:{id:p.id,label:p.label,selected:p.id===selectedId?1:0},
  geometry:{type:'Point',coordinates:[p.lon,p.lat]}
 })),[mapPlaces,selectedId]);
 const lineCoords=useMemo(()=>route&&origin&&validMapPoint(origin)
  ?[origin,...route.points.filter(validMapPoint)].map(xyz):[],[route,origin]);
 const routeCoords=useMemo(()=>{
  const points=lineCoords.slice();
  const destination=mapPlaces.find(p=>p.id===selectedId);
  if(points.length&&destination)points.push([destination.lon,destination.lat]);
  return points;
 },[lineCoords,mapPlaces,selectedId]);
 const markers=useRef(markerFeatures),line=useRef(routeCoords);
 markers.current=markerFeatures;line.current=routeCoords;

 // Create the basemap independently of route calculation, saved-place count
 // and GPS permissions. MapLibre performs its own on-demand tile fetching.
 useEffect(()=>{
  let cancelled=false;
  let map:MapLibreMap|null=null;
  let watchdog:ReturnType<typeof setTimeout>|null=null;
  setTilesLoaded(false);setMapError('');setOverlayError('');
  void (async()=>{
   try{
    if(!host.current)throw Error('Map container unavailable');
    const {Map:MapLibre,LngLatBounds}=await import('maplibre-gl');
    if(cancelled||!host.current)return;
    const m=new MapLibre({
     container:host.current,
     center:xyz(currentPoint),zoom:initialZoom,minZoom:2,maxZoom:18,
     attributionControl:{compact:true},
     style:{version:8,sources:{
      streets:{type:'raster',tiles:['/api/travel/map-tile/{z}/{x}/{y}'],
       tileSize:256,minzoom:0,maxzoom:18,attribution:'© TomTom'},
      flow:{type:'raster',tiles:['/api/travel/map-overlay/flow/{z}/{x}/{y}'],
       tileSize:256,minzoom:0,maxzoom:18,attribution:'© TomTom Traffic'},
      incidents:{type:'raster',tiles:['/api/travel/map-overlay/incidents/{z}/{x}/{y}'],
       tileSize:256,minzoom:0,maxzoom:18,attribution:'© TomTom Traffic'}
     },layers:[
      {id:'streets-layer',type:'raster',source:'streets'},
      {id:'flow-layer',type:'raster',source:'flow',layout:{visibility:'none'},
       paint:{'raster-opacity':0.85}},
      {id:'incidents-layer',type:'raster',source:'incidents',layout:{visibility:'none'},
       paint:{'raster-opacity':0.95}}
     ]}
    });
    map=m;mapRef.current=m;
    const hideIfUnavailable=()=>{
     if(cancelled||m!==mapRef.current||m.isSourceLoaded('streets'))return;
     const center=m.getCenter();
     setFallbackView({point:{lat:center.lat,lon:center.lng},zoom:Math.max(3,Math.min(17,Math.round(m.getZoom())))});
     setMapError('Interactive street imagery did not load. Trying a static street map.');
    };
    watchdog=setTimeout(hideIfUnavailable,18000);
    m.on('error',e=>{
     if(cancelled)return;
     const sourceId=(e as {sourceId?:string}).sourceId;
     const message=String(e.error?.message||'');
     if(sourceId==='flow'||sourceId==='incidents'||message.includes('map-overlay')){
      setOverlayError('Traffic imagery is temporarily unavailable. Street maps and routes remain usable.');
      return;
     }
     hideIfUnavailable();
    });
    m.on('sourcedata',e=>{
     if(e.sourceId==='streets'&&e.isSourceLoaded){
      setTilesLoaded(true);
      if(watchdog){clearTimeout(watchdog);watchdog=null;}
     }
    });
    m.on('dragstart',()=>{hasInteracted.current=true});
    m.on('zoomstart',e=>{if((e as {originalEvent?:unknown}).originalEvent)hasInteracted.current=true});
    m.on('load',()=>{
     if(cancelled)return;
     m.addSource('places',{type:'geojson',data:{
      type:'FeatureCollection',features:markers.current
     }});
     m.addLayer({id:'places-halo',type:'circle',source:'places',paint:{
      'circle-radius':['case',['==',['get','selected'],1],13,10],
      'circle-color':'#ffffff','circle-stroke-color':'#ffffff','circle-stroke-width':2
     }});
     m.addLayer({id:'places-dots',type:'circle',source:'places',paint:{
      'circle-radius':['case',['==',['get','selected'],1],10,7],
      'circle-color':['case',['==',['get','selected'],1],'#b45309','#086a62'],
      'circle-stroke-color':'#ffffff','circle-stroke-width':2
     }});
     m.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},
      geometry:{type:'LineString',coordinates:line.current.length>=2?line.current:[]}}});
     m.addLayer({id:'route-halo',type:'line',source:'route',paint:{
      'line-color':'#ffffff','line-width':9
     }},'places-halo');
     m.addLayer({id:'route-line',type:'line',source:'route',paint:{
      'line-color':'#00645f','line-width':5
     }},'places-halo');
     m.addSource('origin-marker',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
     m.addLayer({id:'origin-dot',type:'circle',source:'origin-marker',paint:{
      'circle-radius':7,'circle-color':'#2563eb',
      'circle-stroke-color':'#ffffff','circle-stroke-width':3
     }});
     m.on('click','places-dots',e=>{
      const id=e.features?.[0]?.properties?.id;
      const place=placesRef.current.find(p=>p.id===id);
      if(place)selectionRef.current(place);
     });
     m.on('mouseenter','places-dots',()=>{m.getCanvas().style.cursor='pointer'});
     m.on('mouseleave','places-dots',()=>{m.getCanvas().style.cursor=''});
     m.resize();
    });
   }catch{
    if(!cancelled)setMapError('Interactive map unavailable. Trying a static street map.');
   }
  })();
  return()=>{cancelled=true;if(watchdog)clearTimeout(watchdog);if(mapRef.current===map)mapRef.current=null;map?.remove()};
 // The map persists while users choose places, routes and traffic layers.
 },[retry]);

 useEffect(()=>{
  const m=mapRef.current;
  if(m&&m.getSource('places'))
   (m.getSource('places') as GeoJSONSource).setData({type:'FeatureCollection',features:markerFeatures});
 },[markerFeatures,tilesLoaded]);

 useEffect(()=>{
  const m=mapRef.current;
  if(!m||!m.getSource('route'))return;
  (m.getSource('route') as GeoJSONSource).setData({
   type:'Feature',properties:{},
   geometry:{type:'LineString',coordinates:routeCoords.length>=2?routeCoords:[]}
  } as Line);
  if(m.getSource('origin-marker'))(m.getSource('origin-marker') as GeoJSONSource).setData({
   type:'FeatureCollection',features:origin&&validMapPoint(origin)?[{
    type:'Feature',properties:{},
    geometry:{type:'Point',coordinates:xyz(origin)}
   }]:[]
  });
  if(routeCoords.length>=2){
   void import('maplibre-gl').then(({LngLatBounds})=>{
    if(mapRef.current!==m)return;
    const bounds=new LngLatBounds(routeCoords[0],routeCoords[0]);
    routeCoords.forEach(p=>bounds.extend(p));
    m.fitBounds(bounds,{padding:45,maxZoom:15,duration:350});
   });
  }
 },[routeCoords,origin,tilesLoaded]);

 useEffect(()=>{
  const m=mapRef.current;
  if(m&&m.getLayer('flow-layer'))
   m.setLayoutProperty('flow-layer','visibility',showFlow?'visible':'none');
 },[showFlow,tilesLoaded]);
 useEffect(()=>{
  const m=mapRef.current;
  if(m&&m.getLayer('incidents-layer'))
   m.setLayoutProperty('incidents-layer','visibility',showIncidents?'visible':'none');
 },[showIncidents,tilesLoaded]);

 useEffect(()=>{
  if(!selectedId||route||!tilesLoaded)return;
  const p=mapPlaces.find(p=>p.id===selectedId);
  if(p&&mapRef.current)mapRef.current.flyTo({center:[p.lon,p.lat],zoom:Math.max(12,mapRef.current.getZoom()),essential:true});
 },[selectedId,mapPlaces,route,tilesLoaded]);

 useEffect(()=>{
  if(hasInteracted.current||gpsSelected.current||routeCoords.length>=2)return;
  mapRef.current?.flyTo({center:xyz(currentPoint),zoom:initialZoom,essential:true});
 },[currentPoint.lat,currentPoint.lon,initialZoom,routeCoords.length]);

 function locate(){
  if(!navigator.geolocation){
   setGpsState('unavailable');return;
  }
  setGpsState('locating');
  navigator.geolocation.getCurrentPosition(position=>{
   const point={lat:position.coords.latitude,lon:position.coords.longitude};
   if(!validMapPoint(point)){setGpsState('unavailable');return}
   gpsSelected.current=true;
   setCurrentFix(point);setGpsState('current');
   mapRef.current?.flyTo({center:xyz(point),zoom:14,essential:true});
  },()=>setGpsState('unavailable'),{
   enableHighAccuracy:true,maximumAge:30000,timeout:12000
  });
 }
 // If geolocation is already allowed, center automatically without asking
 // again. A new permission request only happens after a user taps the button.
 useEffect(()=>{
  if(!('permissions' in navigator)||!navigator.geolocation)return;
  let cancelled=false;
  void navigator.permissions.query({name:'geolocation'}).then(p=>{
   if(cancelled||p.state!=='granted'||gpsSelected.current)return;
   navigator.geolocation.getCurrentPosition(position=>{
    if(cancelled||hasInteracted.current)return;
    const point={lat:position.coords.latitude,lon:position.coords.longitude};
    if(validMapPoint(point)){
     gpsSelected.current=true;setCurrentFix(point);setGpsState('current');
     mapRef.current?.flyTo({center:xyz(point),zoom:14,essential:true});
    }
   },()=>{}, {maximumAge:30000,timeout:10000});
  }).catch(()=>{});
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{
  if(!mapError)return;
  let cancelled=false;
  let objectUrl='';
  const controller=new AbortController();
  setStaticError('');setStaticUrl('');
  const point=validMapPoint(fallbackView.point)?fallbackView.point:fallbackCenter;
  const query=new URLSearchParams({
   lat:point.lat.toFixed(6),lon:point.lon.toFixed(6),
   zoom:String(Math.min(17,Math.max(3,fallbackView.zoom)))
  });
  void (async()=>{
   try{
    const response=await fetch('/api/travel/static-map?'+query.toString(),{
     credentials:'same-origin',cache:'no-store',signal:controller.signal
    });
    if(!response.ok)throw Error('Street imagery not available');
    const blob=await response.blob();
    if(!blob.type.startsWith('image/'))throw Error('Invalid map image');
    if(cancelled)return;
    objectUrl=URL.createObjectURL(blob);
    setStaticUrl(objectUrl);
   }catch{
    if(!cancelled)setStaticError('Street-map imagery unavailable. Search and saved places are still accessible.');
   }
  })();
  return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[mapError,fallbackView]);

 const area=gpsState==='current'?'Centered using current phone location':areaLabel;
 return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-label="Explore map">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div>
    <h3 className="font-bold text-slate-950">Explore the map</h3>
    <p className="text-xs text-slate-600">{area}. Routes appear here when selected.</p>
   </div>
   <button type="button" onClick={locate} disabled={gpsState==='locating'}
    className="min-h-[44px] rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-900 disabled:opacity-60">
    {gpsState==='locating'?'Locating…':'Use my location'}
   </button>
  </div>
  {gpsState==='unavailable'&&<p role="status" className="text-xs text-amber-900">
   Current location wasn't available. You can still explore the map and use saved places.
  </p>}
  <div className="flex flex-wrap gap-2" role="group" aria-label="Optional map layers">
   <button type="button" aria-pressed={showFlow} onClick={()=>{setShowFlow(v=>!v);setOverlayError('')}}
    className={'min-h-[40px] rounded-lg border px-3 py-2 text-xs font-semibold '+(showFlow?'border-teal-800 bg-teal-800 text-white':'border-slate-300 text-slate-800')}>
    {showFlow?'✓ ':''}Traffic flow
   </button>
   <button type="button" aria-pressed={showIncidents} onClick={()=>{setShowIncidents(v=>!v);setOverlayError('')}}
    className={'min-h-[40px] rounded-lg border px-3 py-2 text-xs font-semibold '+(showIncidents?'border-teal-800 bg-teal-800 text-white':'border-slate-300 text-slate-800')}>
    {showIncidents?'✓ ':''}Road incidents
   </button>
  </div>
  {overlayError&&<p role="status" className="text-xs text-amber-900">{overlayError}</p>}
  <div className="relative h-[360px] w-full overflow-hidden rounded-xl bg-slate-100 sm:h-[480px]">
   <div ref={host} className="absolute inset-0" role="region" aria-label="TomTom street map with saved locations, search results and optional route"/>
   {mapError&&<div className="absolute inset-0 bg-slate-50">
    {staticUrl?<img src={staticUrl} alt="Street map of the selected area"
     className="h-full w-full object-cover"/>:
     <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p role="status" className="text-sm font-medium text-slate-700">{staticError||'Loading fallback map…'}</p>
     </div>}
    <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-between gap-2 rounded-xl bg-white/95 p-2">
     <span className="text-xs text-slate-700">Interactive map unavailable</span>
     <button type="button" onClick={()=>{setMapError('');setRetry(v=>v+1)}}
      className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white">Retry map</button>
    </div>
   </div>}
   {!tilesLoaded&&!mapError&&<p role="status" className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800">Loading street map…</p>}
  </div>
  <p className="text-xs text-slate-600">
   Tap a location marker to select it. The map works without an appointment or planned trip.
   Current location is used only with your permission.
  </p>
  {currentFix&&<p className="sr-only">A current device position has been obtained.</p>}
 </section>;
}
