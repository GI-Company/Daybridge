'use client';

import {useEffect,useRef,useState} from 'react';
import {useDayBridge} from '../../lib/storage/store';
import {enrollTrafficAlerts} from '../../lib/travel/auto-reminder';

/**
 * Enroll eligible existing and newly created appointments without foreground GPS.
 * Only events with a verified SavedPlace, an explicitly approved saved origin,
 * and enabled traffic notifications can produce a monitoring plan.
 * Enrollment never overrides a previously disabled plan.
 */
export function AutomaticTravelReminders(){
 const {events,savedPlaces,syncStatus}=useDayBridge();
 const enrolled=useRef(new Set<string>());
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const changed=()=>{enrolled.current.clear();setRevision(n=>n+1);};
  window.addEventListener('daybridge:travel-prefs-updated',changed);
  window.addEventListener('online',changed);
  return()=>{
   window.removeEventListener('daybridge:travel-prefs-updated',changed);
   window.removeEventListener('online',changed);
  };
 },[]);
 useEffect(()=>{
  if(syncStatus!=='synced')return;
  for(const event of events){
   if(event.venueType!=='in_person')continue;
   if(!event.rrule&&Date.parse(event.startTime)<=Date.now())continue;
   const place=savedPlaces.find(p=>p.address.trim()===event.location?.trim());
   if(!place)continue;
   const marker=[event.id,event.startTime,event.location,event.rrule||'',revision].join(':');
   if(enrolled.current.has(marker))continue;
   enrolled.current.add(marker);
   void enrollTrafficAlerts(event,place).catch(()=>undefined);
  }
 },[events,savedPlaces,syncStatus,revision]);
 return null;
}
