import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { authenticated,checkRateLimit,jsonError } from '../../../../lib/travel/auth';
import {adminClient,vapidReady} from '../../../../lib/travel/monitor';
export const runtime='nodejs';
export async function POST(){
 try{
  const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
  if(!await checkRateLimit(viewer.userId,'push-test'))return jsonError('Too many test requests',429);
  vapidReady();
  const admin=adminClient();
  const {data,error}=await admin.from('push_subscriptions').select('id,endpoint,keys_auth,keys_p256dh').eq('user_id',viewer.userId).is('disabled_at',null);
  if(error)return jsonError('Subscription lookup failed',503);
  if(!data?.length)return jsonError('No active device subscriptions. Enable device notifications first.',409);
  let sent=0;
  for(const sub of data){
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{auth:sub.keys_auth,p256dh:sub.keys_p256dh}},JSON.stringify({kind:'test',url:'/'}),{TTL:60});
    sent++;
   }catch(e){
    if([404,410].includes(Number((e as {statusCode?:number}).statusCode)))
      await admin.from('push_subscriptions').update({disabled_at:new Date().toISOString(),last_failure_at:new Date().toISOString()}).eq('id',sub.id).eq('user_id',viewer.userId);
   }
  }
  return NextResponse.json({sent},{status:sent?200:503,headers:{'Cache-Control':'no-store'}});
 }catch{return jsonError('Web Push not yet configured or unreachable.',503)}
}
