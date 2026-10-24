import { NextResponse } from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {monitorReminders} from '../../../../lib/notifications/monitor';
import {monitorTravel} from '../../../../lib/travel/monitor';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=process.env.DAYBRIDGE_CRON_SECRET;
 const actual=req.headers.get('x-daybridge-cron-secret')||'';
 const expectedBytes=Buffer.from(expected||''),actualBytes=Buffer.from(actual);
 if(!expected||actualBytes.length!==expectedBytes.length||!timingSafeEqual(actualBytes,expectedBytes))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  // Independent pipelines: a routing outage must not block ordinary reminders.
  const results=await Promise.allSettled([monitorReminders(),monitorTravel()]);
  const output={reminders:results[0].status==='fulfilled'?results[0].value:{error:'Reminder monitoring failed'},travel:results[1].status==='fulfilled'?results[1].value:{error:'Travel monitoring failed'}};
  const failed=results.some(result=>result.status==='rejected'||result.value.failures>0);
  return NextResponse.json(output,{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Travel monitoring failed; subsequent scheduled checks may retry.'},{status:503});
 }
}
