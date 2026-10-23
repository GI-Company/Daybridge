import { NextResponse } from 'next/server';
import { authenticated,checkRateLimit,jsonError } from '../../../../lib/travel/auth';
import { geocode } from '../../../../lib/travel/tomtom';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const auth=await authenticated();if(!auth)return jsonError('Unauthorized',401);
  const body=await request.json();
  if(typeof body?.address!=='string'||body.address.trim().length<6||body.address.length>250)return jsonError('Invalid address',400);
  if(!await checkRateLimit(auth.userId,'geocode'))return jsonError('Too many requests. Try again shortly.',429);
  return NextResponse.json({results:await geocode(body.address)},{headers:{'Cache-Control':'no-store'}});
 }catch{return jsonError('Address lookup unavailable. Please try again.',503)}
}
