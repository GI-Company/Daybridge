import {NextResponse} from 'next/server';
import {assertSameOrigin,PrivateRequestError} from '../../../../lib/security/request';
import {billingHeaders,billingIdentity,portalURL} from '../../../../lib/billing/server';
import {takeTravelApiSlot} from '../../../../lib/travel/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);const {user,service}=await billingIdentity();
  if(!await takeTravelApiSlot(user.id,'billing'))return NextResponse.json({error:'Please wait a minute before trying billing again.'},{status:429,headers:billingHeaders});
  const {data:customer,error}=await service.from('daybridge_billing_customers').select('customer_id').eq('user_id',user.id).maybeSingle();
  if(error)throw Error('Billing unavailable');
  if(!customer)throw new PrivateRequestError('No personal billing account is linked to your account.',404);
  return NextResponse.json({url:await portalURL(customer.customer_id)},{headers:billingHeaders});
 }catch(error){return NextResponse.json({error:error instanceof PrivateRequestError?error.message:'Billing management is temporarily unavailable.'},{status:error instanceof PrivateRequestError?error.status:503,headers:billingHeaders});}
}
