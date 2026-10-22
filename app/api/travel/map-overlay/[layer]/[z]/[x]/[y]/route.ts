import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,jsonError} from '../../../../../../../../lib/travel/auth';
import {adminClient} from '../../../../../../../../lib/travel/monitor';
import {tomTomKey} from '../../../../../../../../lib/travel/tomtom';
import {orbisRasterTileUrl} from '../../../../../../../../lib/travel/map-layers';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const fields=z.object({
 layer:z.enum(['flow','incidents']),
 z:z.coerce.number().int().min(0).max(18),
 x:z.coerce.number().int().min(0),
 y:z.coerce.number().int().min(0)
});

/** Private, authenticated Orbis Traffic API v2 raster overlays. */
export async function GET(
 _request:Request,
 context:{params:Promise<{layer:string;z:string;x:string;y:string}>}
){
 try{
  const auth=await authenticated();
  if(!auth)return jsonError('Unauthorized',401);
  const parsed=fields.safeParse(await context.params);
  if(!parsed.success)return jsonError('Invalid traffic tile',400);
  const {layer,z,x,y}=parsed.data;
  if(x>=2**z||y>=2**z)return jsonError('Traffic tile out of range',400);
  const bucket=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  // Share the same atomic per-user map tile budget as the basemap.
  const {data:allowed,error:limitError}=await adminClient().rpc('take_travel_api_slot',{
   p_user_id:auth.userId,p_bucket:bucket,p_limit:240
  });
  if(limitError)return jsonError('Traffic map temporarily unavailable',503);
  if(!allowed)return jsonError('Traffic map request limit reached',429);

  const url=orbisRasterTileUrl(layer,z,x,y);
  const upstream=await fetch(url,{
   headers:{'TomTom-Api-Key':tomTomKey(),'TomTom-Api-Version':'2','Accept':'image/png'},
   cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!upstream.ok){
   console.warn('TomTom Orbis traffic tile unavailable',{layer,status:upstream.status});
   return jsonError(upstream.status===429?'Traffic overlay rate-limited':'Traffic overlay unavailable',upstream.status===429?429:502);
  }
  if(!upstream.headers.get('content-type')?.startsWith('image/png'))
   return jsonError('Unexpected traffic overlay format',502);
  const bytes=await upstream.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>1024*1024)
   return jsonError('Invalid traffic overlay response',502);
  return new NextResponse(bytes,{
   headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=45',
    'X-Content-Type-Options':'nosniff','Vary':'Cookie'}
  });
 }catch{return jsonError('Traffic map unavailable',503);}
}
