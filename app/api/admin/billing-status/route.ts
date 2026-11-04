import {NextResponse} from 'next/server';
import {z} from 'zod';
import {CourtAccessError,requireCourtAdmin} from '../../../../lib/admin/courts';
import {billingConfigured,personalPriceId,stripeClient} from '../../../../lib/billing/stripe';
import {validPersonalPrice} from '../../../../lib/billing/reconcile';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Read-only operator verification: no customers, sessions, subscriptions or charges are created. */
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const courtId=new URL(request.url).searchParams.get('court_id');
  if(!z.string().uuid().safeParse(courtId).success)return NextResponse.json({error:'Choose a valid court'},{status:400,headers});
  await requireCourtAdmin(courtId!);
  if(!billingConfigured())return NextResponse.json({ready:false,error:'Billing configuration incomplete'},{status:503,headers});
  const stripe=stripeClient();
  const [price,portal]=await Promise.all([stripe.prices.retrieve(personalPriceId()),stripe.billingPortal.configurations.retrieve(process.env.STRIPE_PORTAL_CONFIGURATION_ID!)]);
  const ready=validPersonalPrice(price)&&price.livemode&&portal.active&&portal.features.subscription_cancel.enabled&&portal.features.subscription_cancel.mode==='at_period_end';
  return NextResponse.json({ready,livemode:price.livemode,amount:price.unit_amount,currency:price.currency,interval:price.recurring?.interval,cancelAtPeriodEnd:portal.features.subscription_cancel.mode==='at_period_end'},{status:ready?200:503,headers});
 }catch(error){return NextResponse.json({ready:false,error:error instanceof CourtAccessError?error.message:'Billing provider verification failed'},{status:error instanceof CourtAccessError?error.status:503,headers});}
}
