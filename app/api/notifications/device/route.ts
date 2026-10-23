import {NextResponse} from 'next/server';
import {authenticated,jsonError} from '../../../../lib/travel/auth';
import {adminClient} from '../../../../lib/travel/monitor';
const knownPushEndpoint=(value:unknown):value is string=>{
 if(typeof value!=='string'||value.length>4096)return false;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname);}catch{return false;}
};
export async function POST(request:Request){
 const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
 const body=await request.json().catch(()=>null);
 if(!knownPushEndpoint(body?.endpoint)||!/^[-\w]{20,400}$/.test(body?.keys?.p256dh||'')||!/^[-\w]{10,100}$/.test(body?.keys?.auth||''))return jsonError('Invalid device subscription',400);
 const admin=adminClient(),stamp=new Date().toISOString();
 // A browser subscription belongs to its currently signed-in account only.
 const {error:detachError}=await admin.from('push_subscriptions').update({disabled_at:stamp}).eq('endpoint',body.endpoint).neq('user_id',viewer.userId).is('disabled_at',null);
 if(detachError)return jsonError('Could not update device ownership',503);
 const {error}=await admin.from('push_subscriptions').upsert({user_id:viewer.userId,endpoint:body.endpoint,keys_p256dh:body.keys.p256dh,keys_auth:body.keys.auth,user_agent:request.headers.get('user-agent')?.slice(0,500)||'',disabled_at:null,last_failure_at:null,updated_at:stamp},{onConflict:'user_id,endpoint'});
 if(error)return jsonError('Could not connect this device',503);
 return NextResponse.json({connected:true},{headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(request:Request){
 const viewer=await authenticated();if(!viewer)return jsonError('Unauthorized',401);
 const body=await request.json().catch(()=>null);if(!knownPushEndpoint(body?.endpoint))return jsonError('Invalid device subscription',400);
 const {error}=await adminClient().from('push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('user_id',viewer.userId).eq('endpoint',body.endpoint);
 if(error)return jsonError('Could not disconnect this device',503);
 return NextResponse.json({connected:false},{headers:{'Cache-Control':'no-store'}});
}
