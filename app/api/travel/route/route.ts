import {assertSameOrigin,readPrivateJSON} from '../../../../lib/security/request';
import { NextResponse } from 'next/server';
import { authenticated,checkRateLimit,jsonError,privateRequestError } from '../../../../lib/travel/auth';
import { calculateRoute,routeInput,TomTomRoutingError } from '../../../../lib/travel/tomtom';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const parsed=routeInput.safeParse(await readPrivateJSON(request));if(!parsed.success)return jsonError('Invalid route coordinates or arrival time',400);
  if(!await checkRateLimit(auth.userId,'route'))return jsonError('Too many route requests',429);
  const result=await calculateRoute(parsed.data,{allowTrafficFallback:true});
  return NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=0, no-store'}});
 }catch(error){
  if(error instanceof TomTomRoutingError){
   // No raw provider URLs, API credentials, or private GPS coordinates in logs.
   console.warn('TomTom routing failure',{status:error.status,category:error.category});
   const reason=error.status===401||error.status===403?'TomTom Routing API access denied. Check the routing key permissions.':
    error.status===429?'TomTom routing request limit reached. Retry later.':
    error.status===400?'TomTom rejected the route request. Verify the destination and travel mode.':
    error.category==='timeout'?'TomTom routing timed out. Retry shortly.':
    error.category==='response'?'TomTom returned an unusable route. Try another destination.':
    'TomTom routing service unavailable. Try again shortly.';
   return jsonError(reason,502);
  }
  return privateRequestError(error,'Route temporarily unavailable. Your appointment has not changed.');
 }
}
