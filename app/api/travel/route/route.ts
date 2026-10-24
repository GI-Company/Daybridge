import {assertSameOrigin,readPrivateJSON} from '../../../../lib/security/request';
import { NextResponse } from 'next/server';
import { authenticated,checkRateLimit,jsonError,privateRequestError } from '../../../../lib/travel/auth';
import { calculateRoute,routeInput } from '../../../../lib/travel/tomtom';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const parsed=routeInput.safeParse(await readPrivateJSON(request));if(!parsed.success)return jsonError('Invalid route coordinates or arrival time',400);
  if(!await checkRateLimit(auth.userId,'route'))return jsonError('Too many route requests',429);
  const result=await calculateRoute(parsed.data);
  return NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=0, no-store'}});
 }catch(error){return privateRequestError(error,'Route temporarily unavailable. Your appointment has not changed.')}
}
