import 'server-only';
import { serverSupabase } from '../supabase/server';
import {takeTravelApiSlot, type TravelRequestScope} from './rate-limit';
import { NextResponse } from 'next/server';

export async function authenticated() {
 const db=await serverSupabase();
 const { data, error }=await db.auth.getUser();
 if(error||!data.user)return null;
 return {db,userId:data.user.id};
}
export function jsonError(message:string,status:number) {
 return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store',
  ...(status===429?{'Retry-After':String(60-new Date().getSeconds())}:{})}});
}
export async function checkRateLimit(userId:string,scope:TravelRequestScope){
 return takeTravelApiSlot(userId,scope);
}
