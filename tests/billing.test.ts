import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {customerSubscriptions,invoiceSubscription,riskSubscriptions,validPersonalPrice} from '../lib/billing/reconcile.ts';
const iterable=(values:unknown[])=>({async *[Symbol.asyncIterator](){yield* values;}});
const until=Math.floor(Date.now()/1000)+86400;
const price={id:'price_personal',active:true,currency:'usd',unit_amount:399,recurring:{interval:'month',interval_count:1}} as Stripe.Price;
const sub=(status='active')=>({id:'sub_own',status,pause_collection:null,cancel_at_period_end:true,items:{data:[{price,quantity:1,current_period_end:until}]}});
const invoice={id:'in_paid',status:'paid',period_end:until,parent:{type:'subscription_details',subscription_details:{subscription:'sub_own'}}} as Stripe.Invoice;
const line={amount:399,quantity:1,pricing:{price_details:{price:price.id}},period:{end:until}};
function fixture(status='active',paid=true){return {subscriptions:{list:()=>iterable([sub(status)])},invoices:{list:()=>iterable(paid?[invoice]:[]),listLineItems:()=>iterable([line]),retrieve:async()=>invoice}} as unknown as Stripe;}
test('only the exact active USD 3.99 monthly price can be used',()=>{
 assert.equal(validPersonalPrice(price),true);
 for(const change of [{unit_amount:3990},{currency:'eur'},{active:false},{recurring:{interval:'year',interval_count:1}}])assert.equal(validPersonalPrice({...price,...change} as Stripe.Price),false);
});
test('entitlement requires a paid invoice, including async checkout; cancellation retains the paid period',async()=>{
 assert.deepEqual(await customerSubscriptions(fixture(),'cus_own',price.id),[{subscription_id:'sub_own',status:'active',access_until:new Date(until*1000).toISOString(),cancel_at_period_end:true}]);
 assert.equal((await customerSubscriptions(fixture('active',false),'cus_own',price.id))[0].access_until,null);
 assert.equal((await customerSubscriptions(fixture('canceled'),'cus_own',price.id))[0].access_until,null);
 assert.equal((await customerSubscriptions(fixture('past_due'),'cus_own',price.id))[0].access_until,new Date(until*1000).toISOString());
 assert.deepEqual(await customerSubscriptions(fixture(),'cus_own','price_other'),[]);
});
test('risk events follow payment graph, paginate invoice payments and never trust metadata',async()=>{
 const calls:unknown[]=[];
 const stripe={charges:{retrieve:async()=>({id:'ch_own',payment_intent:'pi_own',refunded:true})},invoicePayments:{list:(params:unknown)=>{calls.push(params);return iterable([{invoice:'in_paid'},{invoice:'in_other'}]);}},invoices:{retrieve:async(id:string)=>id==='in_paid'?invoice:{id,parent:null}}} as unknown as Stripe;
 for(const type of ['charge.dispute.created','radar.early_fraud_warning.created']){
  const event={type,data:{object:{object:type.startsWith('radar')?'radar.early_fraud_warning':'dispute',charge:'ch_own',payment_intent:null,metadata:{subscription:'sub_untrusted'}}}} as unknown as Stripe.Event;
  assert.deepEqual(await riskSubscriptions(stripe,event),[{subscription_id:'sub_own',blocks_access:true}]);
 }
 assert.deepEqual(calls[0],{payment:{type:'payment_intent',payment_intent:'pi_own'},status:'paid',limit:100});
 const partial={type:'charge.refunded',data:{object:{object:'charge',id:'ch_own',payment_intent:'pi_own',refunded:false}}} as unknown as Stripe.Event;
 assert.deepEqual(await riskSubscriptions(stripe,partial),[{subscription_id:'sub_own',blocks_access:false}]);
 assert.equal(invoiceSubscription({parent:null} as Stripe.Invoice),null);
});
test('Stripe raw webhook signature rejects tampering and stale signatures',()=>{
 const stripe=new Stripe('synthetic-key');const secret='synthetic-webhook-secret';
 const raw=JSON.stringify({id:'evt_fixture',object:'event',type:'invoice.paid'});
 const header=stripe.webhooks.generateTestHeaderString({payload:raw,secret});
 assert.equal(stripe.webhooks.constructEvent(raw,header,secret).id,'evt_fixture');
 assert.throws(()=>stripe.webhooks.constructEvent(raw+' ',header,secret));
 assert.throws(()=>stripe.webhooks.constructEvent(raw,stripe.webhooks.generateTestHeaderString({payload:raw,secret,timestamp:1}),secret));
});
