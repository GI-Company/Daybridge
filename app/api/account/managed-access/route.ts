import {NextResponse} from 'next/server';
import {serverSupabase} from '../../../../lib/supabase/server';
import {serviceClient} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const db=await serverSupabase();
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)return NextResponse.json({allowed:false},{status:401,headers});
    if(user.app_metadata?.daybridge_managed!==true)
      return NextResponse.json({allowed:true,managed:false},{headers});
    const service=serviceClient();
    const {data:member,error:memberError}=await service.from('daybridge_court_participants')
      .select('status').eq('user_id',user.id).maybeSingle();
    if(memberError)return NextResponse.json({allowed:false,error:'Access check unavailable'},{status:503,headers});
    return NextResponse.json({allowed:member?.status==='active',managed:true},{headers});
  }catch{
    return NextResponse.json({allowed:false,error:'Access check unavailable'},{status:503,headers});
  }
}
