import 'server-only';
import {parseGeorgiaEvents,eventsNearRoute,type GeorgiaEvent} from './georgia511-matching';
import type {Point} from './types';

const URL_511='https://511ga.org/api/v2/get/event';
let cached:{expires:number;events:GeorgiaEvent[]}|null=null;
let pending:Promise<GeorgiaEvent[]>|null=null;

/** A process-local cache and in-flight deduplication reduce 511GA requests.
 *  Serverless instances do not share this cache, so provider 429s fail open. */
async function feed():Promise<GeorgiaEvent[]>{
 const key=process.env.GEORGIA_511_API_KEY?.trim();
 if(!key)return [];
 if(cached&&cached.expires>Date.now())return cached.events;
 if(pending)return pending;
 pending=(async()=>{
  try{
   const url=new URL(URL_511);
   url.searchParams.set('key',key);
   url.searchParams.set('format','json');
   const response=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(5500)});
   if(!response.ok)throw Error('511GA unavailable');
   const data=await response.json() as unknown;
   const events=parseGeorgiaEvents(data);
   cached={expires:Date.now()+180000,events};
   return events;
  }catch{
   // Never log the request URL, credentials, or sensitive route coordinates.
   cached={expires:Date.now()+60000,events:[]};
   return [];
  }finally{pending=null;}
 })();
 return pending;
}

export async function getGeorgiaIncidentsNearRoute(points:Point[]){
 if(points.length<2)return [];
 return eventsNearRoute(await feed(),points);
}
