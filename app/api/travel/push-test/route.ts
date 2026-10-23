import {NextResponse} from 'next/server';
import * as webpush from 'web-push';
import {authenticated,checkRateLimit,jsonError} from '../../../../lib/travel/auth';
import {adminClient,vapidReady} from '../../../../lib/travel/monitor';
import {notificationURL} from '../../../../lib/notifications/destination';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
  if(!await checkRateLimit(viewer.userId,'push-test'))return jsonError('Too many test requests. Wait a minute and retry.',429);
  const body=await request.json().catch(()=>null);
  if(typeof body?.endpoint!=='string'||body.endpoint.length>4096)return jsonError('Update DayBridge and connect notifications on this device before testing.',400);
  vapidReady();const admin=adminClient();
  const {data:sub,error}=await admin.from('push_subscriptions').select('id,endpoint,keys_auth,keys_p256dh').eq('user_id',viewer.userId).eq('endpoint',body.endpoint).is('disabled_at',null).maybeSingle();
  if(error)return jsonError('Device lookup failed. Retry when connected.',503);
  if(!sub)return jsonError('This device is not connected. Enable notifications first.',409);
  try{
   await webpush.sendNotification({endpoint:sub.endpoint,keys:{auth:sub.keys_auth,p256dh:sub.keys_p256dh}},JSON.stringify({kind:'test',title:'DayBridge notifications are connected',body:'Tap this notification to return to notification settings.',url:notificationURL({tab:'settings',account:viewer.userId}),tag:'daybridge-test-'+viewer.userId}),{TTL:60,timeout:8000});
  }catch(error){
   const stamp=new Date().toISOString(),expired=[404,410].includes(Number((error as {statusCode?:number}).statusCode));
   await admin.from('push_subscriptions').update({last_failure_at:stamp,...(expired?{disabled_at:stamp}:{})}).eq('id',sub.id).eq('user_id',viewer.userId);
   return jsonError(expired?'This device registration has expired. Connect notifications again.':'The push service did not accept this test. Retry when connected.',503);
  }
  return NextResponse.json({sent:1},{headers:{'Cache-Control':'no-store'}});
 }catch{return jsonError('Notification delivery is unavailable. Retry shortly.',503);}
}
