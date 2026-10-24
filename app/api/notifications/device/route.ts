import {NextResponse} from 'next/server';
import {authenticated,checkRateLimit,jsonError,privateRequestError} from '../../../../lib/travel/auth';
import {assertSameOrigin,readPrivateJSON} from '../../../../lib/security/request';
import {validPushEndpoint,validPushKeys} from '../../../../lib/security/urls';
import {adminClient} from '../../../../lib/travel/monitor';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
  if(!await checkRateLimit(viewer.userId,'device'))return jsonError('Too many device requests. Retry shortly.',429);
  const body=await readPrivateJSON(request) as {endpoint?:unknown;keys?:unknown}|null;
  if(!validPushEndpoint(body?.endpoint)||!validPushKeys(body?.keys))return jsonError('Invalid device subscription',400);
  const {data,error}=await adminClient().rpc('register_private_push_device',{
   p_user_id:viewer.userId,p_endpoint:body.endpoint,p_p256dh:body.keys.p256dh,p_auth:body.keys.auth
  });
  if(error||data!==true)return jsonError('Device registration was not accepted. Reconnect notifications on this device.',409);
  return NextResponse.json({connected:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return privateRequestError(error,'Could not connect this device. Retry when online.');}
}
export async function DELETE(request:Request){
 try{
  assertSameOrigin(request);
  const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
  if(!await checkRateLimit(viewer.userId,'device'))return jsonError('Too many device requests. Retry shortly.',429);
  const body=await readPrivateJSON(request) as {endpoint?:unknown}|null;
  if(!validPushEndpoint(body?.endpoint))return jsonError('Invalid device subscription',400);
  const {error}=await adminClient().rpc('disable_private_push_device',{p_user_id:viewer.userId,p_endpoint:body.endpoint});
  if(error)return jsonError('Could not disconnect this device',503);
  return NextResponse.json({connected:false},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return privateRequestError(error,'Could not disconnect this device. Retry when online.');}
}
