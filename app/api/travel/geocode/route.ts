import {assertSameOrigin,readPrivateJSON} from '../../../../lib/security/request';
import { NextResponse } from 'next/server';
import { authenticated,checkRateLimit,jsonError,privateRequestError } from '../../../../lib/travel/auth';
import { geocode } from '../../../../lib/travel/tomtom';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const body=await readPrivateJSON(request) as {address?:unknown}|null;
  if(typeof body?.address!=='string'||body.address.trim().length<6||body.address.length>250)return jsonError('Invalid address',400);
  if(!await checkRateLimit(auth.userId,'geocode'))return jsonError('Too many requests. Try again shortly.',429);
  return NextResponse.json({results:await geocode(body.address)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return privateRequestError(error,'Address lookup unavailable. Please try again.')}
}
