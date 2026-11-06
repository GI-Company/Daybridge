import 'server-only';
import {serverSupabase} from '../supabase/server';
import {CourtAccessError,serviceClient} from './courts';
/** Auth verifies the session; database lookup verifies the current server-owned role. */
export async function requirePlatformOwner(){
 const db=await serverSupabase();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new CourtAccessError(401,'Sign in with your DayBridge owner account');
 const service=serviceClient();
 const {data:current,error:lookupError}=await service.auth.admin.getUserById(user.id);
 if(lookupError||!current.user)throw new CourtAccessError(503,'Owner access could not be verified');
 if(current.user.app_metadata?.daybridge_platform_owner!==true)
  throw new CourtAccessError(403,'This account does not have DayBridge owner access');
 return {service,userId:user.id};
}
