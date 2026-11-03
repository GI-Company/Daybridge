import {NextResponse} from 'next/server';
import {z} from 'zod';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
import {serverSupabase} from '../../../../lib/supabase/server';
import {serviceClient} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const input=z.object({password:z.string().min(12).max(256)}).strict();

export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const parsed=input.safeParse(await readPrivateJSON(request,2048));
    if(!parsed.success)return NextResponse.json({error:'Password must contain 12–256 characters'},{status:400,headers});
    const db=await serverSupabase();
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)return NextResponse.json({error:'Not signed in'},{status:401,headers});
    if(user.app_metadata?.daybridge_managed!==true||user.app_metadata?.daybridge_must_change_password!==true)
      return NextResponse.json({error:'Not a pending managed account'},{status:403,headers});
    const service=serviceClient();
    const {data:member,error:memberError}=await service.from('daybridge_court_participants')
      .select('status').eq('user_id',user.id).maybeSingle();
    if(memberError||member?.status!=='active')return NextResponse.json({error:'Account unavailable'},{status:403,headers});

    // Change the actual Auth password BEFORE removing the first-use restriction.
    // A caller cannot clear the flag simply by hitting this endpoint.
    const {error:passwordError}=await db.auth.updateUser({password:parsed.data.password});
    if(passwordError)return NextResponse.json({error:'Password change rejected'},{status:400,headers});
    const {error:updateError}=await service.auth.admin.updateUserById(user.id,{
      app_metadata:{...user.app_metadata,daybridge_must_change_password:false}
    });
    if(updateError)return NextResponse.json({error:'Password changed; setup needs finishing. Please retry.'},{status:503,headers});
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    const status=error instanceof PrivateRequestError?error.status:503;
    return NextResponse.json({error:'Could not finish account setup'},{status,headers});
  }
}
