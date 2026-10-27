import 'server-only';
import { z } from 'zod';
import {normalizeTomTomRoutePoints} from './geometry.ts';
import {getGeorgiaIncidentsNearRoute} from './georgia511';
import type {GeorgiaIncident} from './georgia511-matching';

export const coordinateSchema = z.object({
 lat:z.number().finite().min(-90).max(90),
 lon:z.number().finite().min(-180).max(180)
});
export const modeSchema=z.enum(['car','pedestrian','bicycle']);
export const routeInput=z.object({
 origin:coordinateSchema,
 destination:coordinateSchema,
 travelMode:modeSchema.default('car'),
 arriveAt:z.string().datetime({offset:true}).optional()
});
export type Coordinates=z.infer<typeof coordinateSchema>;
export type RouteInput=z.infer<typeof routeInput>;
export type RouteOption={durationSeconds:number;delaySeconds:number;distanceMeters:number;historicSeconds:number|null;points:Coordinates[];departureTime?:string;arrivalTime?:string;instructions?:string[];incidents?:GeorgiaIncident[]};
export type RouteResult={basis:'live'|'historical';routes:RouteOption[];checkedAt:string};
const cache=new Map<string,{expires:number,value:RouteResult}>();
export function tomTomKey():string {
 const key=process.env.tom_tom?.trim() || process.env.TOMTOM_API_KEY?.trim();
 if(!key) throw new Error('TomTom server key not configured');
 return key;
}
export async function geocode(address:string){
 if(address.trim().length<6||address.length>250)throw new Error('Enter a complete destination address');
 const url=new URL('https://api.tomtom.com/search/2/geocode/'+encodeURIComponent(address.trim())+'.json');
 url.searchParams.set('key',tomTomKey());url.searchParams.set('limit','3');
 const res=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error('Geocoding currently unavailable');
 const data=await res.json() as {results?:Array<{position?:{lat:number;lon:number};address?:{freeformAddress?:string}}>} ;
 return (data.results??[]).filter(x=>x.position).map(x=>({lat:x.position!.lat,lon:x.position!.lon,label:x.address?.freeformAddress??address}));
}
export async function calculateRoute(input:RouteInput,options:{alternatives?:number}={}):Promise<RouteResult>{
 const valid=routeInput.parse(input);
 const key=JSON.stringify({origin:valid.origin,destination:valid.destination,mode:valid.travelMode,arriveAt:valid.arriveAt?.slice(0,16),alternatives:options.alternatives??2});
 const old=cache.get(key);if(old&&old.expires>Date.now())return old.value;
 const fmt=(p:Coordinates)=>p.lat.toFixed(6)+','+p.lon.toFixed(6);
 const url=new URL('https://api.tomtom.com/routing/1/calculateRoute/'+fmt(valid.origin)+':'+fmt(valid.destination)+'/json');
 url.searchParams.set('key',tomTomKey());
 url.searchParams.set('traffic','true');url.searchParams.set('routeType','fastest');
 url.searchParams.set('travelMode',valid.travelMode);
 url.searchParams.set('computeTravelTimeFor','all');
 url.searchParams.set('maxAlternatives',String(valid.travelMode==='car'?(options.alternatives??2):0));
 url.searchParams.set('instructionsType','text');url.searchParams.set('language','en-US');
 // Use historic departure/arrival profiles for future travel, but never treat them as live traffic guarantees.
 const future=valid.arriveAt && new Date(valid.arriveAt).getTime()>Date.now()+4*60*60_000;
 if(future)url.searchParams.set('arriveAt',valid.arriveAt!);
 else url.searchParams.set('departAt','now');
 const res=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw new Error('Routing currently unavailable ('+res.status+')');
 const data=await res.json() as {routes?:Array<{
  summary?:{travelTimeInSeconds?:number;trafficDelayInSeconds?:number;lengthInMeters?:number;historicTrafficTravelTimeInSeconds?:number;departureTime?:string;arrivalTime?:string};
  guidance?:{instructions?:Array<{message?:string}>};
  legs?:Array<{points?:Array<{latitude?:number;longitude?:number;lat?:number;lon?:number}>}>
 }>};
 const routes=(data.routes??[]).map(r=>({
  durationSeconds:Math.max(0,Math.round(r.summary?.travelTimeInSeconds??0)),
  delaySeconds:Math.max(0,Math.round(r.summary?.trafficDelayInSeconds??0)),
  distanceMeters:Math.max(0,Math.round(r.summary?.lengthInMeters??0)),
  historicSeconds: r.summary?.historicTrafficTravelTimeInSeconds??null,
  points:normalizeTomTomRoutePoints((r.legs??[]).flatMap(l=>l.points??[])),
  departureTime:r.summary?.departureTime,arrivalTime:r.summary?.arrivalTime,
  instructions:(r.guidance?.instructions??[]).map(i=>i.message??'').filter(Boolean).slice(0,100)
 })).filter(r=>r.durationSeconds>0&&r.points.length>=2).sort((a,b)=>a.durationSeconds-b.durationSeconds);
 if(!routes.length)throw new Error('No usable route found');
 // Georgia 511 adds current reported disruptions; TomTom remains the source of routing/ETA.
 // Do not attach today's road reports to a historical future departure estimate.
 const annotated=valid.travelMode==='car'&&!future
  ? await Promise.all(routes.map(async route=>({...route,incidents:await getGeorgiaIncidentsNearRoute(route.points)})))
  : routes;
 const value:RouteResult={basis:future?'historical':'live',routes:annotated,checkedAt:new Date().toISOString()};
 if(cache.size>200)cache.clear();
 cache.set(key,{expires:Date.now()+75_000,value});
 return value;
}
