import 'server-only';
import {serviceClient} from './courts';
/** One-time repair for accounts removed by the old ban-on-removal behavior. */
export async function releasePersonalSignIn(){
 const service=serviceClient();
 const {data:jobs,error}=await service.rpc('daybridge_claim_signin_releases');
 if(error)throw Error('Personal sign-in release queue unavailable');
 for(const job of jobs||[]){
  const {data:participant,error:readError}=await service.from('daybridge_court_participants').select('status').eq('user_id',job.user_id).maybeSingle();
  if(readError)throw Error('Personal sign-in release unavailable');
  // A later suspension wins over this old removal repair.
  if(participant?.status==='removed'){
   const {error:authError}=await service.auth.admin.updateUserById(job.user_id,{ban_duration:'none'});
   if(authError)throw Error('Personal sign-in release will retry');
  }
  const {error:doneError}=await service.from('daybridge_personal_signin_releases').update({completed_at:new Date().toISOString()}).eq('user_id',job.user_id);
  if(doneError)throw Error('Personal sign-in release receipt unavailable');
 }
}
