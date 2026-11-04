import {NextResponse} from 'next/server';
import {serverSupabase} from '../../../../lib/supabase/server';
import {participantAccess,refreshBilling} from '../../../../lib/billing/server';
import {billingConfigured} from '../../../../lib/billing/stripe';
import {serviceClient} from '../../../../lib/admin/courts';
import {assertSameOrigin} from '../../../../lib/security/request';
import {takeTravelApiSlot} from '../../../../lib/travel/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const db=await serverSupabase();
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)return NextResponse.json({allowed:false},{status:401,headers});
    return NextResponse.json({...await participantAccess(user.id,user.app_metadata?.daybridge_managed===true),billingReady:billingConfigured()},{headers});
  }catch{
    return NextResponse.json({allowed:false,error:'Access check unavailable'},{status:503,headers});
  }
}

/** Explicit reconciliation after returning from Stripe. Redirect parameters never grant access. */
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  assertSameOrigin(request);const db=await serverSupabase();const {data:{user},error}=await db.auth.getUser();
  if(error||!user)return NextResponse.json({allowed:false},{status:401,headers});
  if(!await takeTravelApiSlot(user.id,'billing'))return NextResponse.json({error:'Try again in a minute'},{status:429,headers});
  const {data:customer,error:lookupError}=await serviceClient().from('daybridge_billing_customers').select('customer_id').eq('user_id',user.id).maybeSingle();
  if(lookupError)throw Error('Billing unavailable');
  if(customer)await refreshBilling(customer.customer_id);
  return NextResponse.json({...await participantAccess(user.id,user.app_metadata?.daybridge_managed===true),billingReady:billingConfigured()},{headers});
 }catch{return NextResponse.json({allowed:false,error:'Access check unavailable'},{status:503,headers});}
}
