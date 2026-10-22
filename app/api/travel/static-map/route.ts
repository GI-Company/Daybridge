import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,checkRateLimit,jsonError} from '../../../../lib/travel/auth';
import {tomTomKey} from '../../../../lib/travel/tomtom';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({
 lat:z.coerce.number().finite().min(-85).max(85),
 lon:z.coerce.number().finite().min(-180).max(180),
 zoom:z.coerce.number().int().min(3).max(17),
});
export async function GET(request:Request){
 try{
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const input=new URL(request.url).searchParams;
  const parsed=schema.safeParse({lat:input.get('lat'),lon:input.get('lon'),zoom:input.get('zoom')});
  if(!parsed.success)return jsonError('Invalid static map coordinates',400);
  if(!await checkRateLimit(auth.db,auth.userId,30))return jsonError('Map request limit reached',429);
  const {lat,lon,zoom}=parsed.data;
  const api=new URL('https://api.tomtom.com/map/1/staticimage');
  for(const [key,value] of Object.entries({key:tomTomKey(),center:lon.toFixed(6)+','+lat.toFixed(6),zoom:String(zoom),
   width:'640',height:'320',format:'png',layer:'basic',style:'main',language:'en-US',view:'Unified'}))
   api.searchParams.set(key,value);
  const upstream=await fetch(api.toString(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!upstream.ok)return jsonError('Street map temporarily unavailable',502);
  const type=upstream.headers.get('content-type')||'';
  if(!type.startsWith('image/'))return jsonError('Invalid map response',502);
  const bytes=await upstream.arrayBuffer();
  if(bytes.byteLength>4*1024*1024)return jsonError('Map response too large',502);
  return new NextResponse(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
 }catch{return jsonError('Street map unavailable',503)}
}
