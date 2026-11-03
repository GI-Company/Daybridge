import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {assertSameOrigin,readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
import {requireCourtAdmin,CourtAccessError} from '../../../../lib/admin/courts';
import {usernameToAuthEmail} from '../../../../lib/auth/username';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const courtId=z.string().uuid();
const createInput=z.object({
  court_id:courtId,
  username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{2,31}$/)
}).strict();
const changeInput=z.object({
  court_id:courtId,
  user_id:z.string().uuid(),
  action:z.enum(['suspend','restore','remove','reset'])
}).strict();
const headers={'Cache-Control':'private, no-store'};
function fail(message:string,status=400) {
  return NextResponse.json({error:message},{status,headers});
}
function errorResponse(error:unknown){
  if(error instanceof CourtAccessError||error instanceof PrivateRequestError)
    return fail(error.message,error.status);
  return fail('Account management is temporarily unavailable',503);
}

export async function GET(request:Request){
  try{
    const id=new URL(request.url).searchParams.get('court_id');
    if(!courtId.safeParse(id).success)return fail('Choose a valid court');
    const {service,court}=await requireCourtAdmin(id!);
    const {data,error}=await service.from('daybridge_court_participants')
      .select('user_id,username,status,created_at')
      .eq('court_id',court.id).order('created_at',{ascending:false});
    if(error)return fail('Unable to load court accounts',503);
    const participants=(data||[]) as {user_id:string;username:string;status:string;created_at:string}[];
    return NextResponse.json({
      court:{id:court.id,name:court.court_name,is_demo:court.is_demo,seat_limit:court.seat_limit,subscription_plan:court.subscription_plan,subscription_status:court.subscription_status},
      participants,
      occupied_seats:participants.filter(p=>p.status!=='removed').length
    },{headers});
  }catch(e){return errorResponse(e);}
}

export async function POST(request:Request){
  try{
    const parsed=createInput.safeParse(await readPrivateJSON(request));
    if(!parsed.success)return fail('Enter a valid court and a 3–32 character username');
    const {court_id,username}=parsed.data;
    const {service,userId,court}=await requireCourtAdmin(court_id);
    if(!['pilot','active'].includes(court.subscription_status))
      return fail('New accounts are unavailable for this court subscription',403);
    const email=usernameToAuthEmail(username);
    if(!email)return fail('Invalid participant username');
    // One-time secret is shown once in the secured admin response; never logged or stored here.
    const temporaryPassword=randomBytes(24).toString('base64url');
    const {data:created,error:createError}=await service.auth.admin.createUser({
      email,password:temporaryPassword,email_confirm:true,
      app_metadata:{daybridge_managed:true,daybridge_must_change_password:true}
    });
    if(createError||!created.user)return fail('Username is unavailable or identity provider rejected the request',409);
    const {error:seatError}=await service.rpc('daybridge_assign_participant',{
      p_court_id:court_id,p_user_id:created.user.id,p_username:username,p_actor_id:userId
    });
    if(seatError){
      const {error:rollbackError}=await service.auth.admin.deleteUser(created.user.id);
      if(rollbackError)console.error('DayBridge court provisioning rollback failed; review orphaned account');
      return fail('Seat assignment failed. Check capacity and try again.',409);
    }
    return NextResponse.json({username,temporaryPassword},{status:201,headers});
  }catch(e){return errorResponse(e);}
}

export async function PATCH(request:Request){
  try{
    const parsed=changeInput.safeParse(await readPrivateJSON(request));
    if(!parsed.success)return fail('Invalid court, participant or account action');
    const {court_id,user_id,action}=parsed.data;
    const {service,userId}=await requireCourtAdmin(court_id);
    const {data:member,error:memberError}=await service.from('daybridge_court_participants')
      .select('user_id,status').eq('court_id',court_id).eq('user_id',user_id).maybeSingle();
    if(memberError||!member)return fail('Participant is not assigned to this court',404);
    if(action==='reset'){
      if(member.status!=='active')return fail('Restore the account before resetting credentials',409);
      const temporaryPassword=randomBytes(24).toString('base64url');
      const {data:oldUser,error:lookupError}=await service.auth.admin.getUserById(user_id);
      if(lookupError||!oldUser.user)return fail('Unable to verify managed account',503);
      if(!oldUser.user.app_metadata?.daybridge_managed)return fail('Not a managed participant account',403);
      const {error:resetError}=await service.auth.admin.updateUserById(user_id,{
        password:temporaryPassword,
        app_metadata:{...oldUser.user.app_metadata,daybridge_must_change_password:true}
      });
      if(resetError)return fail('Password reset was not accepted',503);
      const {error:auditError}=await service.from('daybridge_court_audit').insert({
        court_id,actor_id:userId,subject_user_id:user_id,action:'participant_password_reset'
      });
      if(auditError)console.error('DayBridge admin audit write failed after credential reset');
      return NextResponse.json({temporaryPassword},{headers});
    }

    // A suspended/removed account remains in Auth for participant data retention.
    // Existing access tokens may remain usable until expiry; do not claim instant remote wipe.
    const prior=member.status as 'active'|'suspended'|'removed';
    const shouldBan=action!=='restore';
    const {error:authError}=await service.auth.admin.updateUserById(user_id,{
      ban_duration:shouldBan?'876000h':'none'
    });
    if(authError)return fail('Identity provider rejected the account change',503);
    const {data:status,error:transitionError}=await service.rpc('daybridge_transition_participant',{
      p_court_id:court_id,p_user_id:user_id,p_actor_id:userId,p_action:action
    });
    if(transitionError){
      const {error:rollbackError}=await service.auth.admin.updateUserById(user_id,{
        ban_duration:prior==='active'?'none':'876000h'
      });
      if(rollbackError)console.error('DayBridge court status rollback failed; manual reconciliation required');
      return fail('Could not update the court record; review account status',409);
    }
    return NextResponse.json({status},{headers});
  }catch(e){return errorResponse(e);}
}
