import 'server-only';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {serverSupabase} from '../supabase/server';

import {courtStaffAuthEmail} from '../auth/court-staff';

export type Court = {id:string;circuit_id:string;court_name:string;login_slug:string;seat_limit:number;enabled:boolean;is_demo:boolean;subscription_plan:string;subscription_status:string};
export type CourtParticipant = {user_id:string;court_id:string;username:string;status:'active'|'suspended'|'removed';created_at:string};

export function serviceClient():SupabaseClient {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Never prefix this with NEXT_PUBLIC_. Never instantiate it in a client module.
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Court administration backend not configured');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export class CourtAccessError extends Error {
  status:number;
  constructor(status:number, message:string){super(message);this.status=status;}
}

export class StaffPasswordRequired extends CourtAccessError {
  constructor(){super(403,'Change your temporary staff password before using the court portal');}
}
export async function requireCourtAdmin(courtId:string,{allowPasswordChange=false}:{allowPasswordChange?:boolean}={}) {
  const browserSession=await serverSupabase();
  const {data:{user},error}=await browserSession.auth.getUser();
  if(error||!user)throw new CourtAccessError(401,'Sign in as a court administrator');

  const service=serviceClient();
  const {data:membership,error:membershipError}=await service.from('daybridge_court_staff')
    .select('role,password_change_required,credential_version,credential_operation_until,credential_valid_after').eq('court_id',courtId).eq('user_id',user.id).eq('active',true).maybeSingle();
  if(membershipError)throw new CourtAccessError(503,'Court access temporarily unavailable');
  if(!membership)throw new CourtAccessError(403,'You are not assigned to this court');

  const {data:court,error:courtError}=await service.from('daybridge_courts')
    .select('id,circuit_id,court_name,login_slug,seat_limit,enabled,is_demo,subscription_plan,subscription_status').eq('id',courtId).single();
  if(courtError||!court||!court.enabled)
    throw new CourtAccessError(403,'Court unavailable');

  const {data:circuit,error:circuitError}=await service.from('daybridge_judicial_circuits')
    .select('state_code,login_slug').eq('id',court.circuit_id).single();
  const localPart=user.email?.toLowerCase().split('@')[0]||'';
  const expected=circuit ? courtStaffAuthEmail(localPart,circuit.state_code,circuit.login_slug,court.login_slug):null;
  if(circuitError||!expected||user.email?.toLowerCase()!==expected)
    throw new CourtAccessError(403,'Administrator identity does not match the selected court');
  if(membership.password_change_required&&!allowPasswordChange)throw new StaffPasswordRequired();
  if(membership.credential_valid_after&&!allowPasswordChange){
    const {data:claims,error:claimsError}=await browserSession.auth.getClaims();
    const session=claims?.claims?.session_id;
    if(claimsError||claims?.claims?.sub!==user.id||typeof session!=='string')throw new CourtAccessError(401,'Sign in again with your current staff password');
    const {data:current,error:sessionError}=await service.rpc('daybridge_staff_session_current',{p_user:user.id,p_court:courtId,p_session:session});
    if(sessionError)throw new CourtAccessError(503,'Staff session could not be verified');
    if(current!==true)throw new CourtAccessError(401,'Sign in again with your current staff password');
  }
  return {service,userId:user.id,court:court as Court,role:membership.role as string,administratorUsername:localPart,
    email:user.email!,passwordChangeRequired:membership.password_change_required===true,
    credentialVersion:membership.credential_version as string|null,credentialOperationUntil:membership.credential_operation_until as string|null};
}
