import type Stripe from 'stripe';
export const stripeId=(value:string|{id:string}|null|undefined)=>typeof value==='string'?value:value?.id??null;
export type SubscriptionState={subscription_id:string;status:string;access_until:string|null;cancel_at_period_end:boolean};
export function validPersonalPrice(price:Stripe.Price){return price.active&&price.currency==='usd'&&price.unit_amount===399&&price.recurring?.interval==='month'&&price.recurring.interval_count===1;}
export function invoiceSubscription(invoice:Stripe.Invoice){return invoice.parent?.type==='subscription_details'?stripeId(invoice.parent.subscription_details?.subscription):null;}

/** Refresh current Stripe state instead of granting access from redirect parameters or old event bodies. */
export async function customerSubscriptions(stripe:Stripe,customer:string,priceId:string):Promise<SubscriptionState[]>{
 const result:SubscriptionState[]=[];
 for await(const subscription of stripe.subscriptions.list({customer,status:'all',limit:100})){
  const item=subscription.items.data.find(item=>item.price.id===priceId&&item.quantity===1);
  if(!item)continue;
  let paidUntil=0;
  if(['active','past_due'].includes(subscription.status)&&!subscription.pause_collection){
   // A failed renewal retains only the already-paid period; no free access from an active status alone.
   for await(const invoice of stripe.invoices.list({customer,subscription:subscription.id,status:'paid',limit:10})){
    for await(const line of stripe.invoices.listLineItems(invoice.id,{limit:100})){
     if(stripeId(line.pricing?.price_details?.price)===priceId&&line.amount>0&&line.quantity===1)
      paidUntil=Math.max(paidUntil,Math.min(line.period.end,item.current_period_end));
    }
    if(paidUntil>=item.current_period_end)break;
    // Older expired periods cannot grant access. Don't scan years of billing history.
    if(invoice.period_end<Date.now()/1000-86400)break;
   }
  }
  result.push({subscription_id:subscription.id,status:subscription.status,access_until:paidUntil?new Date(paidUntil*1000).toISOString():null,cancel_at_period_end:subscription.cancel_at_period_end});
 }
 return result;
}

/** Endive graph: Charge/Dispute/FraudWarning -> PaymentIntent -> InvoicePayment -> Invoice -> Subscription. */
export async function riskSubscriptions(stripe:Stripe,event:Stripe.Event){
 if(!['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type))return [];
 const object=event.data.object as Stripe.Charge|Stripe.Dispute|Stripe.Radar.EarlyFraudWarning;
 const charge=object.object==='charge'?object:await stripe.charges.retrieve(stripeId(object.charge)!);
 const paymentIntent=stripeId(charge.payment_intent);if(!paymentIntent)return [];
 const ids=new Set<string>();
 for await(const payment of stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:paymentIntent},status:'paid',limit:100})){
  const invoice=await stripe.invoices.retrieve(stripeId(payment.invoice)!);
  const id=invoiceSubscription(invoice);if(id)ids.add(id);
 }
 // Partial refunds are recorded for review. Full refunds/disputes/fraud warnings block the affected subscription.
 return [...ids].map(subscription_id=>({subscription_id,blocks_access:event.type!=='charge.refunded'||charge.refunded}));
}
