import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,jsonError} from '../../../../../../../lib/travel/auth';
import {adminClient} from '../../../../../../../lib/travel/monitor';
import {tomTomKey} from '../../../../../../../lib/travel/tomtom';
import {orbisRasterTileUrl} from '../../../../../../../lib/travel/map-layers';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Proxy TomTom Orbis v2 raster PNG tiles through DayBridge.
 * The TomTom API key never appears in HTML, client JS, or tile URLs.
 */
const tileCoords=z.object({
 z:z.coerce.number().int().min(0).max(18),
 x:z.coerce.number().int().min(0),
 y:z.coerce.number().int().min(0)
});

export async function GET(
 _request:Request,
 context:{params:Promise<{z:string;x:string;y:string}>}
){
 try{
  const auth=await authenticated();
  if(!auth)return jsonError('Unauthorized',401);
  const parsed=tileCoords.safeParse(await context.params);
  if(!parsed.success)return jsonError('Invalid street-map tile',400);
  const {z,x,y}=parsed.data;
  const width=2**z;
  if(x>=width||y>=width)return jsonError('Street-map tile out of range',400);
  // Pan and zoom loads tiles concurrently. Use an atomic database increment
  // so initial tile bursts don't fail on a first-insert race.
  const bucket=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  const {data:allowed,error:limitError}=await adminClient().rpc('take_travel_api_slot',{
   p_user_id:auth.userId,p_bucket:bucket,p_limit:240
  });
  if(limitError)return jsonError('Map rate limiter temporarily unavailable',503);
  if(!allowed)return jsonError('Street map request limit reached',429);

  const url=orbisRasterTileUrl('streets',z,x,y);
  const upstream=await fetch(url.toString(),{
   headers:{'TomTom-Api-Key':process.env.MAPS_DISPLAY?.trim()||tomTomKey(),'TomTom-Api-Version':'2',
    'Accept':'image/png'},
   cache:'no-store',
   signal:AbortSignal.timeout(8000)
  });
  if(!upstream.ok){
   console.warn('TomTom Orbis map tile rejected',{status:upstream.status});
   if(upstream.status===429)return jsonError('Map imagery temporarily rate-limited',429);
   return jsonError('Map imagery unavailable (HTTP '+upstream.status+')',502);
  }
  const mime=upstream.headers.get('content-type')||'';
  if(!mime.startsWith('image/png'))return jsonError('Unexpected map tile format',502);
  const bytes=await upstream.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>1024*1024)
   return jsonError('Invalid map tile response',502);
  return new NextResponse(bytes,{
   headers:{
    'Content-Type':'image/png',
    'Cache-Control':'private, max-age=300',
    'X-Content-Type-Options':'nosniff',
    'Vary':'Cookie'
   }
  });
 }catch{
  return jsonError('Map tile service temporarily unavailable',503);
 }
}
