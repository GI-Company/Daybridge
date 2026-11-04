import {NextResponse} from 'next/server';
import {assertSameOrigin,PrivateRequestError} from '../../../../lib/security/request';
import {billingHeaders,billingIdentity,checkoutURL} from '../../../../lib/billing/server';
import {takeTravelApiSlot} from '../../../../lib/travel/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);const {user}=await billingIdentity();
  if(!await takeTravelApiSlot(user.id,'billing'))return NextResponse.json({error:'Please wait a minute before trying billing again.'},{status:429,headers:billingHeaders});
  return NextResponse.json({url:await checkoutURL(user.id)},{headers:billingHeaders});
 }catch(error){return NextResponse.json({error:error instanceof PrivateRequestError?error.message:'Checkout is temporarily unavailable. Your records are preserved.'},{status:error instanceof PrivateRequestError?error.status:503,headers:billingHeaders});}
}
