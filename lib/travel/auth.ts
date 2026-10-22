import 'server-only';
import { serverSupabase } from '../supabase/server';
import {adminClient} from './monitor';
import { NextResponse } from 'next/server';

export async function authenticated() {
 const db=await serverSupabase();
 const { data, error }=await db.auth.getUser();
 if(error||!data.user)return null;
 return {db,userId:data.user.id};
}
export function jsonError(message:string,status:number) {
 return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
}
export async function checkRateLimit(db:Awaited<ReturnType<typeof serverSupabase>>,userId:string,limit=30){
 const admin=adminClient();
 const bucket=new Date(Math.floor(Date.now()/60_000)*60_000).toISOString();
 const {data, error}=await admin.from('travel_api_limits').select('count').eq('user_id',userId).eq('bucket',bucket).maybeSingle();
 if(error)throw new Error('Rate limiter unavailable');
 if((data?.count??0)>=limit)return false;
 // Atomic guarded increment prevents two concurrent callers skipping the limit in normal operation.
 if(data){
  const {data:updated,error:err}=await admin.from('travel_api_limits').update({count:data.count+1}).eq('user_id',userId).eq('bucket',bucket).lt('count',limit).select('count').maybeSingle();
  if(err||!updated)return false;
 }else{
  const {error:err}=await admin.from('travel_api_limits').insert({user_id:userId,bucket,count:1});
  if(err)return false;
 }
 return true;
}
