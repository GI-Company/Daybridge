import {NextResponse} from 'next/server';
import {authenticated,checkRateLimit,jsonError} from '../../../../lib/travel/auth';
import {tomTomKey} from '../../../../lib/travel/tomtom';

export const runtime='nodejs';
type FuzzyResult={
 type?:string;poi?:{name?:string};
 address?:{freeformAddress?:string};
 position?:{lat?:number;lon?:number};
};
export async function POST(request:Request){
 try{
  const auth=await authenticated();
  if(!auth)return jsonError('Unauthorized',401);
  const data=await request.json().catch(()=>null) as
    {query?:unknown;lat?:unknown;lon?:unknown}|null;
  const q=typeof data?.query==='string'?data.query.trim():'';
  if(q.length<2||q.length>90)return jsonError('Enter a valid place or address',400);
  if(!await checkRateLimit(auth.userId,'places'))
   return jsonError('Too many place searches. Try again shortly.',429);
  const url=new URL('https://api.tomtom.com/search/2/search/'+encodeURIComponent(q)+'.json');
  // Legacy Search API requires query-string authentication; this URL remains
  // exclusively server-side and is never returned or logged.
  url.searchParams.set('key',tomTomKey());
  url.searchParams.set('limit','8');
  url.searchParams.set('language','en-US');
  const lat=data?.lat,lon=data?.lon;
  if(typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&
     Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180){
   url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lon));
  }
  const upstream=await fetch(url.toString(),{signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!upstream.ok)return jsonError('Place search unavailable',502);
  const json=await upstream.json() as {results?:FuzzyResult[]};
  const results=(json.results||[]).flatMap(item=>{
   const p=item.position;
   if(typeof p?.lat!=='number'||typeof p.lon!=='number'||!Number.isFinite(p.lat)||
      !Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)return [];
   const address=(item.address?.freeformAddress||'').slice(0,180);
   const label=(item.poi?.name||address||'Place').slice(0,100);
   return [{label,address:address||label,lat:p.lat,lon:p.lon}];
  }).slice(0,8);
  return NextResponse.json({results},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return jsonError('Place search currently unavailable',503);}
}
