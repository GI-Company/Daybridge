import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,jsonError} from '../../../../../../../lib/travel/auth';
import {adminClient} from '../../../../../../../lib/travel/monitor';
import {tomTomKey} from '../../../../../../../lib/travel/tomtom';
import {classicTomTomRasterTileUrl,orbisRasterTileUrl} from '../../../../../../../lib/travel/map-layers';

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

  // The classic TomTom static map can work when the dedicated Orbis tile key
  // is not entitled to Orbis v2. Prefer Orbis, but try the classic raster tiles
  // with the existing server-only routing/Map Display key before failing.
  const legacyKey=tomTomKey();
  const primaryUrl=orbisRasterTileUrl('streets',z,x,y);
  const requestPng=async (url:URL,headers:Record<string,string>={}):Promise<Response|null>=>{
   try{
    return await fetch(url.toString(),{
     headers:{Accept:'image/png',...headers},
     cache:'no-store',signal:AbortSignal.timeout(7000)
    });
   }catch{return null;}
  };
  const primary=await requestPng(primaryUrl,{
   'TomTom-Api-Key':process.env.MAPS_DISPLAY?.trim()||legacyKey,
   'TomTom-Api-Version':'2'
  });
  const isPng=(response:Response|null)=>Boolean(response?.ok&&
   response.headers.get('content-type')?.startsWith('image/png'));
  let upstream:Response|null=isPng(primary)?primary:null;
  let source:'orbis'|'classic'='orbis';
  // Never work around a TomTom 429 response by rotating API keys.
  if(primary?.status===429)return jsonError('Map imagery rate-limited',429);
  if(!upstream){
   const classicUrl=classicTomTomRasterTileUrl(z,x,y);
   // Classic API authentication requires a URL key, but this URL is only
   // generated and requested on the server and is never returned or logged.
   classicUrl.searchParams.set('key',legacyKey);
   const classic=await requestPng(classicUrl);
   if(classic?.status===429)return jsonError('Map imagery rate-limited',429);
   if(isPng(classic)){upstream=classic;source='classic';}
   else{
    console.warn('TomTom raster tile sources unavailable',{
     orbisStatus:primary?.status??null,classicStatus:classic?.status??null
    });
    return jsonError('Street-map raster tiles unavailable',502);
   }
  }
  const bytes=await upstream!.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>1024*1024)
   return jsonError('Invalid map tile response',502);
  return new NextResponse(bytes,{
   headers:{
    'Content-Type':'image/png',
    'Cache-Control':'private, max-age=300',
    'X-Content-Type-Options':'nosniff',
    'Vary':'Cookie',
    'X-DayBridge-Map-Source':source
   }
  });
 }catch{
  return jsonError('Map tile service temporarily unavailable',503);
 }
}
