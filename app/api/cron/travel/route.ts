import { NextResponse } from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {monitorReminders} from '../../../../lib/notifications/monitor';
import {monitorTravel,adminClient} from '../../../../lib/travel/monitor';
import {monitorContext} from '../../../../lib/notifications/monitor-context';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=process.env.DAYBRIDGE_CRON_SECRET;
 const actual=req.headers.get('x-daybridge-cron-secret')||'';
 const expectedBytes=Buffer.from(expected||''),actualBytes=Buffer.from(actual);
 if(!expected||actualBytes.length!==expectedBytes.length||!timingSafeEqual(actualBytes,expectedBytes))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  // Independent pipelines: a routing outage must not block ordinary reminders.
  const started=Date.now(),context=monitorContext(adminClient());
  const results=await Promise.allSettled([monitorReminders(context),monitorTravel(context)]);
  const output={reminders:results[0].status==='fulfilled'?results[0].value:{error:'Reminder monitoring failed'},travel:results[1].status==='fulfilled'?results[1].value:{error:'Travel monitoring failed'}};
  const failed=results.some(result=>result.status==='rejected'||result.value.failures>0);
  // Counts only: no account IDs, record contents, coordinates or provider keys.
  console.info('DayBridge scheduled checks',JSON.stringify({duration_ms:Date.now()-started,ok:!failed,...output}));
  return NextResponse.json(output,{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Travel monitoring failed; subsequent scheduled checks may retry.'},{status:503});
 }
}
