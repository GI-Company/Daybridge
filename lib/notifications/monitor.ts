import 'server-only';
import {adminClient,vapidReady} from '../travel/monitor';
import {deliverNotification} from './delivery';
import {dueReminders} from './reminders';
import {monitorContext,eachAccount,type MonitorContext} from './monitor-context';
export async function monitorReminders(context?:MonitorContext){
 vapidReady();
 const admin=adminClient(),now=Date.now();
 const records=context??monitorContext(admin);
 const {data:devices,error}=await admin.from('push_subscriptions').select('user_id').is('disabled_at',null);
 if(error)throw Error('Could not read reminder accounts');
 const userIds=[...new Set((devices||[]).map(row=>row.user_id))];
 let checked=0,accepted=0,failures=0;
 await eachAccount(userIds,async userId=>{
  try{
  const snapshot=await records.snapshot(userId);
  if(!snapshot)return;
  for(const reminder of dueReminders(snapshot,userId,now)){
   checked++;
   try{const result=await deliverNotification(admin,{userId,key:reminder.key,kind:reminder.kind,expires:reminder.expires,
    message:{kind:reminder.kind,title:reminder.title,body:reminder.body,url:reminder.url,silent:reminder.silent}},now);accepted+=result.accepted;failures+=result.failed;}
   catch{failures++;}
  }
  }catch{failures++;}
 });
 return {checked,accepted,failures};
}
