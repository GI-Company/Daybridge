'use client';
import {useWorkspaceVisible} from '../workspace-visibility';
import {useSyncExternalStore} from 'react';
import {freshLocation,type LocationFix} from './location-fix';
type State={fix:LocationFix|null;status:'locating'|'current'|'denied'|'unavailable'};
const initial:State={fix:null,status:'locating'};
let state=initial,watch:number|undefined,timer:ReturnType<typeof setInterval>|undefined;
const listeners=new Set<()=>void>();
function publish(next:State){state=next;listeners.forEach(listener=>listener());}
function stop(){if(watch!==undefined)navigator.geolocation?.clearWatch(watch);watch=undefined;}
function start(){
 stop();publish(initial);
 if(document.visibilityState!=='visible')return;
 if(!navigator.geolocation){publish({fix:null,status:'unavailable'});return;}
 watch=navigator.geolocation.watchPosition(position=>{
  const point={lat:position.coords.latitude,lon:position.coords.longitude};
  const fix=freshLocation({point,recordedAt:position.timestamp,accuracy:position.coords.accuracy});
  if(!fix){publish({fix:null,status:'unavailable'});return;}
  // Preserve the point identity through GPS jitter, while keeping its real timestamp fresh.
  const prior=state.fix?.point;
  if(prior&&Math.abs(prior.lat-point.lat)<0.0004&&Math.abs(prior.lon-point.lon)<0.0004)fix.point=prior;
  publish({fix,status:'current'});
 },error=>publish({fix:null,status:error.code===1?'denied':'unavailable'}),{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
}
function visibility(){if(document.visibilityState==='visible')start();else {stop();publish(initial);}}
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(listeners.size===1){start();document.addEventListener('visibilitychange',visibility);window.addEventListener('online',start);timer=setInterval(()=>{if(state.fix&&!freshLocation(state.fix)){publish({fix:null,status:'locating'});start();}},10000);}
 return()=>{listeners.delete(listener);if(!listeners.size){stop();if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',start);state=initial;}};
}
const inactive=()=>()=>{};
const currentState=()=>state,initialState=()=>initial;
export function useCurrentLocation(){const visible=useWorkspaceVisible();return useSyncExternalStore(visible?subscribe:inactive,visible?currentState:initialState,initialState);}
