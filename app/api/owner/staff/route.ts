import {NextResponse} from 'next/server';
import {requirePlatformOwner} from '../../../../lib/admin/owner';
import {CourtAccessError} from '../../../../lib/admin/courts';
import {staffCreateInput,staffResetInput} from '../../../../lib/admin/staff-input';
import {createStaffCredentials,resetStaffCredentials} from '../../../../lib/admin/staff-credentials';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function handle(request:Request,action:'create'|'reset'){
 try{
  const body=await readPrivateJSON(request);
  const {service,userId}=await requirePlatformOwner();
  if(action==='create'){
   const parsed=staffCreateInput.safeParse(body);
   if(!parsed.success)return NextResponse.json({error:'Enter a valid court, staff username and role'},{status:400,headers});
   return NextResponse.json(await createStaffCredentials(service,userId,parsed.data),{status:201,headers});
  }
  const parsed=staffResetInput.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Choose a valid court staff account'},{status:400,headers});
  return NextResponse.json(await resetStaffCredentials(service,userId,parsed.data),{headers});
 }catch(error){
  const known=error instanceof CourtAccessError||error instanceof PrivateRequestError;
  return NextResponse.json({error:known?error.message:'Staff credentials are temporarily unavailable'},{status:known?error.status:503,headers});
 }
}
export async function POST(request:Request){return handle(request,'create');}
export async function PATCH(request:Request){return handle(request,'reset');}
