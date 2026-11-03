import 'server-only';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {serverSupabase} from '../supabase/server';

export type Court = {id:string;state_code:string;state_name:string;circuit_name:string;seat_limit:number;enabled:boolean};
export type CourtParticipant = {user_id:string;court_id:string;username:string;status:'active'|'suspended'|'removed';created_at:string};

export function serviceClient():SupabaseClient {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Never prefix this with NEXT_PUBLIC_. Never instantiate it in a client module.
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Court administration backend not configured');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export class CourtAccessError extends Error {
  constructor(public status:number, message:string){super(message);}
}

export async function requireCourtAdmin(courtId:string) {
  const browserSession=await serverSupabase();
  const {data:{user},error}=await browserSession.auth.getUser();
  if(error||!user)throw new CourtAccessError(401,'Sign in as a court administrator');

  // MFA is mandatory for court-staff administrative operations.
  const {data:assurance,error:mfaError}=await browserSession.auth.mfa.getAuthenticatorAssuranceLevel();
  if(mfaError||assurance?.currentLevel!=='aal2')
    throw new CourtAccessError(403,'Complete administrator two-factor verification');

  const service=serviceClient();
  const {data:membership,error:membershipError}=await service.from('daybridge_court_staff')
    .select('role').eq('court_id',courtId).eq('user_id',user.id).eq('active',true).maybeSingle();
  if(membershipError)throw new CourtAccessError(503,'Court access temporarily unavailable');
  if(!membership)throw new CourtAccessError(403,'You are not assigned to this court');

  const {data:court,error:courtError}=await service.from('daybridge_courts')
    .select('id,state_code,state_name,circuit_name,seat_limit,enabled').eq('id',courtId).single();
  if(courtError||!court||!court.enabled)
    throw new CourtAccessError(403,'Court unavailable');

  return {service,userId:user.id,court:court as Court,role:membership.role as string};
}
