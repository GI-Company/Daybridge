import 'server-only';
import {randomBytes,randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CourtAccessError} from './courts';
import {courtStaffAuthEmail} from '../auth/court-staff';

type CreateInput={court_id:string;username:string;role:'case_manager'|'coordinator'};
type ResetInput={court_id:string;user_id:string};
async function finish(service:SupabaseClient,actor:string,court:string,user:string,version:string,action:'create'|'reset',success:boolean){
 const {data,error}=await service.rpc('daybridge_owner_finish_staff_credentials',{
  p_actor:actor,p_court:court,p_user:user,p_version:version,p_action:action,p_success:success
 });
 if(error||data!==true)throw new CourtAccessError(409,'Credentials changed or access was revoked. Refresh the court and retry.');
}
function rpcFailure(error:{code?:string;message?:string}){
 return new CourtAccessError(error.code==='42501'?403:409,error.code==='P0001'?error.message||'Staff credential operation rejected':'Staff credential operation was not accepted');
}
export async function createStaffCredentials(service:SupabaseClient,actor:string,input:CreateInput){
 const {data:court,error:courtError}=await service.from('daybridge_courts').select('circuit_id,login_slug').eq('id',input.court_id).single();
 if(courtError||!court)throw new CourtAccessError(404,'Court not found');
 const {data:circuit,error:circuitError}=await service.from('daybridge_judicial_circuits').select('state_code,login_slug').eq('id',court.circuit_id).single();
 const email=circuit&&courtStaffAuthEmail(input.username,circuit.state_code,circuit.login_slug,court.login_slug);
 if(circuitError||!email)throw new CourtAccessError(409,'Court sign-in configuration is unavailable');
 const temporaryPassword=randomBytes(24).toString('base64url'),version=randomUUID();
 const {data:created,error:createError}=await service.auth.admin.createUser({email,password:temporaryPassword,email_confirm:true,app_metadata:{daybridge_staff_managed:true}});
 if(createError||!created.user)throw new CourtAccessError(409,'That staff username is unavailable. Link the existing verified identity, or choose another username.');
 const user=created.user.id;
 const {error}=await service.rpc('daybridge_owner_staff_credentials',{
  p_actor:actor,p_court:input.court_id,p_user:user,p_action:'create',p_version:version,p_username:input.username,p_role:input.role
 });
 if(error){
  // This UUID was just created by this request. Failed assignment is transactional.
  const {error:cleanupError}=await service.auth.admin.deleteUser(user);
  if(cleanupError)console.error('DayBridge staff provisioning cleanup failed; review unassigned identity');
  throw rpcFailure(error);
 }
 await finish(service,actor,input.court_id,user,version,'create',true);
 return {username:input.username,email,temporaryPassword};
}
export async function resetStaffCredentials(service:SupabaseClient,actor:string,input:ResetInput){
 const version=randomUUID(),temporaryPassword=randomBytes(24).toString('base64url');
 // SQL verifies the exact active membership, confirmed court alias, non-owner,
 // non-participant identity, fresh owner role and exclusive operation lease.
 const {data:email,error}=await service.rpc('daybridge_owner_staff_credentials',{
  p_actor:actor,p_court:input.court_id,p_user:input.user_id,p_action:'reset',p_version:version
 });
 if(error)throw rpcFailure(error);
 const {error:resetError}=await service.auth.admin.updateUserById(input.user_id,{password:temporaryPassword});
 await finish(service,actor,input.court_id,input.user_id,version,'reset',!resetError);
 if(resetError)throw new CourtAccessError(503,'Password reset failed. Staff access stays restricted; retry the reset.');
 return {username:String(email).split('@')[0],email:String(email),temporaryPassword};
}
