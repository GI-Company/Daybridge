import { NextResponse } from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {monitorTravel} from '../../../../lib/travel/monitor';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=process.env.DAYBRIDGE_CRON_SECRET;
 const actual=req.headers.get('x-daybridge-cron-secret')||'';
 if(!expected||actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const output=await monitorTravel();
  return NextResponse.json(output,{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Travel monitoring failed; subsequent scheduled checks may retry.'},{status:503});
 }
}
