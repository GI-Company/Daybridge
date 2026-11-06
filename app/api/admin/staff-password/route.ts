import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';
import {requireCourtAdmin,CourtAccessError} from '../../../../lib/admin/courts';
import {staffPasswordInput} from '../../../../lib/admin/staff-input';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const parsed=staffPasswordInput.safeParse(await readPrivateJSON(request,2048));
  if(!parsed.success)return NextResponse.json({error:'Enter the current temporary password and a different new password of 12–256 characters'},{status:400,headers});
  const {court_id,current_password,password}=parsed.data;
  const staff=await requireCourtAdmin(court_id,{allowPasswordChange:true});
  if(!staff.passwordChangeRequired||!staff.credentialVersion)return NextResponse.json({error:'No pending staff password change'},{status:409,headers});
  if(staff.credentialOperationUntil&&new Date(staff.credentialOperationUntil).getTime()>Date.now())return NextResponse.json({error:'A reset is in progress. Retry shortly.'},{status:409,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw Error('Auth unavailable');
  // Independently prove the current password. A pre-reset session cannot clear
  // the restriction merely by presenting its still-unexpired access token.
  const verifier=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
   const {data,error}=await verifier.auth.signInWithPassword({email:staff.email,password:current_password});
   if(error||data.user?.id!==staff.userId)return NextResponse.json({error:'Temporary password was not accepted'},{status:400,headers});
   const {error:passwordError}=await verifier.auth.updateUser({password,current_password});
   if(passwordError)return NextResponse.json({error:'Password change was not accepted'},{status:400,headers});
   const {data:completed,error:completeError}=await staff.service.rpc('daybridge_complete_staff_password',{
    p_user:staff.userId,p_court:court_id,p_version:staff.credentialVersion
   });
   if(completeError||completed!==true)return NextResponse.json({error:'Password changed, but access changed during setup. Ask the owner to review or reset your login.'},{status:409,headers});
   return NextResponse.json({ok:true},{headers});
  }finally{await verifier.auth.signOut({scope:'local'});}
 }catch(error){
  const known=error instanceof CourtAccessError||error instanceof PrivateRequestError;
  return NextResponse.json({error:known?error.message:'Could not finish staff password setup'},{status:known?error.status:503,headers});
 }
}
