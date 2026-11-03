import {NextResponse} from 'next/server';
import {serverSupabase} from '../../../../lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';

// Public court picker: only explicitly listed/active court names, not users.
export async function GET(){
  try {
    const db=await serverSupabase();
    const {data,error}=await db.rpc('daybridge_list_courts');
    if(error) return NextResponse.json({error:'Court directory not ready',courts:[]},
      {status:503,headers:{'Cache-Control':'no-store'}});
    return NextResponse.json({courts:data||[]},{headers:{'Cache-Control':'no-store'}});
  }catch {
    return NextResponse.json({error:'Court directory unavailable',courts:[]},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
}