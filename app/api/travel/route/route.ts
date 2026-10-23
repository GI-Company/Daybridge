import { NextResponse } from 'next/server';
import { authenticated,checkRateLimit,jsonError } from '../../../../lib/travel/auth';
import { calculateRoute,routeInput } from '../../../../lib/travel/tomtom';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const parsed=routeInput.safeParse(await request.json());if(!parsed.success)return jsonError('Invalid route coordinates or arrival time',400);
  if(!await checkRateLimit(auth.userId,'route'))return jsonError('Too many route requests',429);
  const result=await calculateRoute(parsed.data);
  return NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=0, no-store'}});
 }catch{return jsonError('Route temporarily unavailable. Your appointment has not changed.',503)}
}
