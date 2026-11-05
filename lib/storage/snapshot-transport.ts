import type {SupabaseClient} from '@supabase/supabase-js';
import type {Snapshot} from './merge-snapshots';
import type {RemoteSnapshot} from './snapshot-sync';

/** One account, one transport. Unchanged polls transfer only a revision. */
export function snapshotTransport(backend:SupabaseClient,userId:string){
 let cached:RemoteSnapshot|null=null;
 const absent=async()=>{
  const {data,error}=await backend.rpc('daybridge_workspace_access');
  // RLS can hide an existing row after suspension/reset. Never interpret that
  // as an empty workspace and reconcile away the encrypted device records.
  if(error||data!==true)throw Error('Cloud access unavailable');
  cached=null;
  return {payload:{},revision:0};
 };
 return {
  async read():Promise<RemoteSnapshot>{
   if(cached){
    const {data,error}=await backend.from('private_snapshots').select('revision').eq('user_id',userId).maybeSingle();
    if(error)throw Error('Cloud read failed');
    if(!data)return absent();
    if(Number(data.revision)===cached.revision)return structuredClone(cached);
   }
   const {data,error}=await backend.from('private_snapshots').select('payload,revision').eq('user_id',userId).maybeSingle();
   if(error)throw Error('Cloud read failed');
   if(!data)return absent();
   cached={payload:data.payload as Snapshot,revision:Number(data.revision)};
   return structuredClone(cached);
  },
  async history(revision:number){
   const {data,error}=await backend.from('private_snapshot_history').select('payload').eq('user_id',userId).eq('revision',revision).maybeSingle();
   if(error)return null;
   return data?.payload as Snapshot|null;
  },
  async save(value:Snapshot,revision:number){
   const {data,error}=await backend.rpc('save_private_snapshot_for_user',{p_user_id:userId,p_payload:value,p_expected_revision:revision});
   if(error)throw Error(error.message);
   const next=Number(data);
   if(!Number.isSafeInteger(next)||next<=revision)throw Error('Invalid cloud revision');
   cached={payload:structuredClone(value),revision:next};
   return next;
  }
 };
}
