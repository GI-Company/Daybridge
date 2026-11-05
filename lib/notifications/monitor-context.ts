import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ReminderSnapshot} from './reminders';
import type {SavedPlace} from '../types';

export type MonitorSnapshot=ReminderSnapshot&{savedPlaces?:SavedPlace[]};
/** Request-local only: share an authorized read across both reminder pipelines. */
export function monitorContext(admin:SupabaseClient){
 const snapshots=new Map<string,Promise<MonitorSnapshot|null>>();
 return {
  snapshot(userId:string){
   let pending=snapshots.get(userId);
   if(!pending){
    pending=(async()=>{
     const {data,error}=await admin.rpc('daybridge_reminder_snapshot',{p_user_id:userId});
     if(error)throw Error('Could not read authorized reminder records');
     return (data?.[0]?.payload??null) as MonitorSnapshot|null;
    })();
    snapshots.set(userId,pending);
   }
   return pending;
  }
 };
}
export type MonitorContext=ReturnType<typeof monitorContext>;

/** Bound account concurrency so a slow provider cannot serialize all 25 users. */
export async function eachAccount<T>(items:readonly T[],work:(item:T)=>Promise<void>,concurrency=4){
 let next=0;
 await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{
  while(next<items.length){const item=items[next++];await work(item);}
 }));
}
