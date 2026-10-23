import 'server-only';
import {adminClient,vapidReady} from '../travel/monitor';
import {deliverNotification} from './delivery';
import {dueReminders,type ReminderSnapshot} from './reminders';
export async function monitorReminders(){
 vapidReady();
 const admin=adminClient(),now=Date.now();
 const {data:devices,error}=await admin.from('push_subscriptions').select('user_id').is('disabled_at',null);
 if(error)throw Error('Could not read reminder accounts');
 const userIds=[...new Set((devices||[]).map(row=>row.user_id))];
 let checked=0,accepted=0,failures=0;
 for(const userId of userIds){
  const {data:snapshot,error:snapshotError}=await admin.from('private_snapshots').select('payload').eq('user_id',userId).maybeSingle();
  if(snapshotError){failures++;continue;}
  if(!snapshot?.payload)continue;
  for(const reminder of dueReminders(snapshot.payload as ReminderSnapshot,userId,now)){
   checked++;
   try{const result=await deliverNotification(admin,{userId,key:reminder.key,kind:reminder.kind,expires:reminder.expires,
    message:{kind:reminder.kind,title:reminder.title,body:reminder.body,url:reminder.url,silent:reminder.silent}},now);accepted+=result.accepted;failures+=result.failed;}
   catch{failures++;}
  }
 }
 return {checked,accepted,failures};
}
