import {NextResponse} from 'next/server';
import {assertSameOrigin,PrivateRequestError} from '../../../../lib/security/request';
import {serverSupabase} from '../../../../lib/supabase/server';
import {serviceClient} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{
    assertSameOrigin(request);
    const db=await serverSupabase();
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)return NextResponse.json({error:'Not signed in'},{status:401,headers});
    if(user.app_metadata?.daybridge_managed!==true)return NextResponse.json({error:'Not a managed account'},{status:403,headers});
    const service=serviceClient();
    const {data:member,error:memberError}=await service.from('daybridge_court_participants')
      .select('status').eq('user_id',user.id).maybeSingle();
    if(memberError||member?.status!=='active')return NextResponse.json({error:'Account unavailable'},{status:403,headers});
    // The password was changed by Supabase Auth in the browser before this endpoint is called.
    // Clearing the first-use flag never changes roles, court assignments or user-owned data.
    const {error:updateError}=await service.auth.admin.updateUserById(user.id,{
      app_metadata:{...user.app_metadata,daybridge_must_change_password:false}
    });
    if(updateError)return NextResponse.json({error:'Could not finish setup'},{status:503,headers});
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    const status=error instanceof PrivateRequestError?error.status:503;
    return NextResponse.json({error:'Could not finish account setup'},{status,headers});
  }
}
