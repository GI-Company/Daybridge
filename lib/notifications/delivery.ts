import 'server-only';
import * as webpush from 'web-push';
import type {SupabaseClient} from '@supabase/supabase-js';

type Delivery={userId:string;key:string;kind:string;appointmentId?:string;message:{kind:string;title:string;body:string;url:string;tag?:string;silent?:boolean};expires:number;urgent?:boolean};
/** Provider acceptance is recorded per device, to avoid resending after a successful device receipt. */
export async function deliverNotification(admin:SupabaseClient,delivery:Delivery,now=Date.now(),send=webpush.sendNotification):Promise<{accepted:number;failed:number}>{
 if(delivery.expires<=now)return {accepted:0,failed:0};
 const {data:subscriptions,error:subError}=await admin.from('push_subscriptions').select('id,endpoint,keys_auth,keys_p256dh').eq('user_id',delivery.userId).is('disabled_at',null);
 if(subError)throw Error('Could not load notification devices');
 if(!subscriptions?.length)return {accepted:0,failed:0};
 const {data:inserted,error:insertError}=await admin.from('notification_deliveries').upsert({user_id:delivery.userId,appointment_id:delivery.appointmentId??null,dedupe_key:delivery.key,kind:delivery.kind,status:'pending'},{onConflict:'user_id,dedupe_key',ignoreDuplicates:true}).select('*').maybeSingle();
 if(insertError)throw Error('Could not queue notification');
 const {data:existing,error:readError}=inserted?{data:inserted,error:null}:await admin.from('notification_deliveries').select('*').eq('user_id',delivery.userId).eq('dedupe_key',delivery.key).maybeSingle();
 if(readError)throw Error('Could not read notification queue');
 if(!existing||existing.status==='sent'||existing.status==='cancelled'||existing.attempt_count>=4)return {accepted:0,failed:0};
 if(existing.last_attempt_at&&now-Date.parse(existing.last_attempt_at)<180000)return {accepted:0,failed:0};
 const stamp=new Date(now).toISOString();
 const {data:claim,error:claimError}=await admin.from('notification_deliveries').update({status:'sending',attempt_count:existing.attempt_count+1,last_attempt_at:stamp,updated_at:stamp}).eq('id',existing.id).eq('status',existing.status).eq('attempt_count',existing.attempt_count).select('id').maybeSingle();
 if(claimError)throw Error('Could not claim notification');
 if(!claim)return {accepted:0,failed:0};
 const {data:receipts,error:receiptError}=await admin.from('notification_device_receipts').select('subscription_id').eq('delivery_id',existing.id);
 if(receiptError)throw Error('Could not load delivery receipts');
 const accepted=new Set((receipts||[]).map(row=>row.subscription_id));
 let sent=0,failed=0;
 for(const sub of subscriptions){
  if(accepted.has(sub.id))continue;
  try{
   await send({endpoint:sub.endpoint,keys:{auth:sub.keys_auth,p256dh:sub.keys_p256dh}},JSON.stringify({...delivery.message,tag:delivery.message.tag||'daybridge-'+existing.id}),{
    TTL:Math.max(1,Math.min(1800,Math.floor((delivery.expires-now)/1000))),urgency:delivery.urgent?'high':'normal',timeout:8000
   });
   const {error}=await admin.from('notification_device_receipts').upsert({delivery_id:existing.id,subscription_id:sub.id,accepted_at:stamp},{onConflict:'delivery_id,subscription_id'});
   if(error)throw Error('Could not save device acceptance');
   accepted.add(sub.id);sent++;
  }catch(error){
   const code=Number((error as {statusCode?:number}).statusCode);
   if(code===404||code===410){
    await admin.from('push_subscriptions').update({disabled_at:stamp,last_failure_at:stamp}).eq('id',sub.id).eq('user_id',delivery.userId);
   }else{
    failed++;
    await admin.from('push_subscriptions').update({last_failure_at:stamp}).eq('id',sub.id).eq('user_id',delivery.userId);
   }
  }
 }
 const {error:finishError}=await admin.from('notification_deliveries').update({status:failed?'failed':accepted.size?'sent':'no_subscription',sent_at:accepted.size?stamp:null,updated_at:stamp}).eq('id',existing.id);
 if(finishError)throw Error('Could not update notification delivery');
 return {accepted:sent,failed};
}
