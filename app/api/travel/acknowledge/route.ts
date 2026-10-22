import {NextRequest,NextResponse} from 'next/server';
import {authenticated,jsonError} from '../../../../lib/travel/auth';

export const runtime='nodejs';

/**
 * Acknowledges user intent to depart. It does not verify motion, arrival,
 * attendance, or a device location, and is never an official court record.
 * The SW can call this while the UI is closed using same-origin auth cookies.
 */
export async function POST(request:NextRequest){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==request.nextUrl.origin)return jsonError('Invalid request origin',403);
  const site=request.headers.get('sec-fetch-site');
  if(site&&site!=='same-origin'&&site!=='none')return jsonError('Cross-site request blocked',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
   return jsonError('JSON required',415);
  const viewer=await authenticated();
  if(!viewer)return jsonError('Sign in required to acknowledge departure',401);
  const input=await request.json().catch(()=>null) as {appointmentId?:unknown;source?:unknown}|null;
  const id=typeof input?.appointmentId==='string'?input.appointmentId:'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
   return jsonError('Valid appointment ID required',400);
  const source=input?.source==='notification'?'notification':input?.source==='app'?'app':null;
  if(!source)return jsonError('Valid action source required',400);
  const {data:plan,error:readError}=await viewer.db.from('travel_appointments')
   .select('id,occurrence_start,enabled,cancelled,departed_at')
   .eq('id',id).eq('user_id',viewer.userId).maybeSingle();
  if(readError)return jsonError('Could not check appointment',503);
  if(!plan)return jsonError('Appointment monitoring not found',404);
  if(!plan.enabled||plan.cancelled)return jsonError('Appointment no longer monitored',409);
  if(plan.departed_at)return NextResponse.json({
   acknowledged:true,departedAt:plan.departed_at,alreadyAcknowledged:true
  },{headers:{'Cache-Control':'no-store'}});
  const startMs=Date.parse(plan.occurrence_start);
  const now=Date.now();
  if(!Number.isFinite(startMs)||now>startMs+30*60000||startMs-now>48*3600000)
   return jsonError('Appointment not in departure window',409);
  const departedAt=new Date(now).toISOString();
  const {data:updated,error}=await viewer.db.from('travel_appointments')
   .update({departed_at:departedAt,departure_ack_source:source})
   .eq('id',id).eq('user_id',viewer.userId).eq('enabled',true)
   .eq('cancelled',false).is('departed_at',null)
   .select('departed_at').maybeSingle();
  if(error)return jsonError('Departure acknowledgment was not saved',503);
  if(!updated){
   const {data:current}=await viewer.db.from('travel_appointments')
    .select('departed_at').eq('id',id).eq('user_id',viewer.userId).maybeSingle();
   if(!current?.departed_at)return jsonError('Could not confirm departure',409);
   return NextResponse.json({acknowledged:true,departedAt:current.departed_at,alreadyAcknowledged:true},
    {headers:{'Cache-Control':'no-store'}});
  }
  return NextResponse.json({acknowledged:true,departedAt:updated.departed_at,alreadyAcknowledged:false},
   {headers:{'Cache-Control':'no-store'}});
 }catch{return jsonError('Departure acknowledgment could not be completed',503);}
}
