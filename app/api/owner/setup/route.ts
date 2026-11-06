import {NextResponse} from 'next/server';
import {requirePlatformOwner} from '../../../../lib/admin/owner';
import {CourtAccessError} from '../../../../lib/admin/courts';
import {ownerSetupInput} from '../../../../lib/admin/owner-input';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(error:unknown){return NextResponse.json({error:error instanceof CourtAccessError||error instanceof PrivateRequestError?error.message:'Court setup is temporarily unavailable'},{status:error instanceof CourtAccessError||error instanceof PrivateRequestError?error.status:503,headers});}
export async function GET(){
 try{
  const {service,userId}=await requirePlatformOwner();
  const {data,error}=await service.rpc('daybridge_owner_directory',{p_actor:userId});
  if(error)throw Error('Directory unavailable');
  return NextResponse.json(data,{headers});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const input=ownerSetupInput.safeParse(await readPrivateJSON(request));
  if(!input.success)return NextResponse.json({error:input.error.issues[0]?.message||'Check the setup fields'},{status:400,headers});
  const {service,userId}=await requirePlatformOwner();
  const {data,error}=await service.rpc('daybridge_owner_setup',{p_actor:userId,p_input:input.data});
  if(error){
   const message=error.code==='23505'?'That state, circuit, court name or sign-in code already exists.':error.code==='P0001'?error.message:'Could not save court setup. Check the fields and retry.';
   return NextResponse.json({error:message},{status:error.code==='42501'?403:409,headers});
  }
  return NextResponse.json({court_id:data},{status:input.data.action==='create'?201:200,headers});
 }catch(error){return failure(error);}
}
