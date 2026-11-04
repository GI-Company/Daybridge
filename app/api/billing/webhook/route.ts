import {NextResponse} from 'next/server';
import {stripeClient} from '../../../../lib/billing/stripe';
import {eventCustomer,refreshBilling} from '../../../../lib/billing/server';
import {serviceClient} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handled=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed','invoice.paid','invoice.payment_failed','charge.dispute.created','charge.refunded','radar.early_fraud_warning.created']);
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,signature=request.headers.get('stripe-signature');
 if(!secret)return NextResponse.json({error:'Webhook unavailable'},{status:503});
 if(!signature)return NextResponse.json({error:'Signature required'},{status:400});
 // Preserve exact bytes and bound streamed input before signature verification.
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
 let event;
 try{event=stripeClient().webhooks.constructEvent(Buffer.concat(chunks),signature,secret);}catch{return NextResponse.json({error:'Invalid signature'},{status:400});}
 if(event.livemode!==(process.env.NODE_ENV==='production')||!handled.has(event.type))return NextResponse.json({received:true});
 try{
  const service=serviceClient();
  const {data:seen,error}=await service.from('daybridge_billing_events').select('event_id').eq('event_id',event.id).maybeSingle();
  if(error)throw Error('Receipt unavailable');if(seen)return NextResponse.json({received:true});
  const customer=await eventCustomer(event);if(customer)await refreshBilling(customer,event);
  return NextResponse.json({received:true});
 }catch{
  // Do not leak provider errors or keys. A non-2xx response asks Stripe to retry.
  return NextResponse.json({error:'Billing event will retry'},{status:503});
 }
}
