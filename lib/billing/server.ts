import 'server-only';
import type Stripe from 'stripe';
import {serviceClient} from '../admin/courts';
import {serverSupabase} from '../supabase/server';
import {PrivateRequestError} from '../security/request';
import {billingConfigured,billingReturnURL,personalPriceId,stripeClient} from './stripe';
import {customerSubscriptions,riskSubscriptions,stripeId,validPersonalPrice} from './reconcile';

export const billingHeaders={'Cache-Control':'private, no-store'};
export async function billingIdentity(){
 const db=await serverSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new PrivateRequestError('Sign in to manage your account',401);
 return {user,db,service:serviceClient()};
}
export async function participantAccess(userId:string,managed=false){
 const service=serviceClient();
 const {data:participant,error}=await service.from('daybridge_court_participants').select('status').eq('user_id',userId).maybeSingle();
 if(error)throw Error('Access check unavailable');
 if(!participant)return {allowed:!managed,managed,reason:managed?'unassigned':'personal',hasBilling:false};
 const {data:customer,error:customerError}=await service.from('daybridge_billing_customers').select('customer_id').eq('user_id',userId).maybeSingle();
 if(customerError)throw Error('Billing access unavailable');
 if(participant.status!=='removed')return {allowed:participant.status==='active',managed:true,reason:participant.status,hasBilling:Boolean(customer)};
 const {data:subscriptions,error:subError}=await service.from('daybridge_billing_subscriptions').select('subscription_id,status,access_until,cancel_at_period_end').eq('user_id',userId);
 if(subError)throw Error('Billing access unavailable');
 const ids=(subscriptions||[]).map(s=>s.subscription_id);
 const {data:risks,error:riskError}=ids.length?await service.from('daybridge_billing_risks').select('subscription_id').in('subscription_id',ids).eq('blocks_access',true):{data:[],error:null};
 if(riskError)throw Error('Billing access unavailable');
 const blocked=new Set((risks||[]).map(r=>r.subscription_id));
 const paid=(subscriptions||[]).find(s=>['active','past_due'].includes(s.status)&&new Date(s.access_until||0).getTime()>Date.now()&&!blocked.has(s.subscription_id));
 return {allowed:Boolean(paid),managed:true,reason:paid?'subscribed':'subscription_required',hasBilling:Boolean(customer),accessUntil:paid?.access_until,cancelAtPeriodEnd:paid?.cancel_at_period_end,billingReview:blocked.size>0};
}
export async function customerForUser(userId:string){
 const service=serviceClient();
 const {data:existing,error}=await service.from('daybridge_billing_customers').select('customer_id').eq('user_id',userId).maybeSingle();
 if(error)throw Error('Billing account unavailable');if(existing)return existing.customer_id as string;
 // No medical, court, schedule data or internal sign-in aliases are sent to Stripe.
 const customer=await stripeClient().customers.create({metadata:{application:'daybridge'}},{idempotencyKey:'daybridge-customer-'+userId});
 const {error:saveError}=await service.from('daybridge_billing_customers').upsert({user_id:userId,customer_id:customer.id},{onConflict:'user_id',ignoreDuplicates:true});
 if(saveError)throw Error('Billing account could not be saved');
 const {data:mapped,error:mapError}=await service.from('daybridge_billing_customers').select('customer_id').eq('user_id',userId).single();
 if(mapError||mapped.customer_id!==customer.id)throw Error('Billing account mapping unavailable');return customer.id;
}
export async function refreshBilling(customer:string,event?:Stripe.Event){
 const service=serviceClient(),stripe=stripeClient();
 const {data:version,error}=await service.rpc('daybridge_begin_billing_sync',{p_customer_id:customer});
 if(error)throw Error('Billing synchronization unavailable');if(version===null)return; // another product in the merchant account
 const subscriptions=await customerSubscriptions(stripe,customer,personalPriceId());
 const allowedIds=new Set(subscriptions.map(s=>s.subscription_id));
 const risks=event?(await riskSubscriptions(stripe,event)).filter(r=>allowedIds.has(r.subscription_id)):[];
 // Prevent another renewal after a dispute, fraud warning, or full refund.
 for(const risk of risks.filter(r=>r.blocks_access)){
  const status=subscriptions.find(s=>s.subscription_id===risk.subscription_id)?.status;
  if(status&&!['canceled','incomplete_expired'].includes(status))await stripe.subscriptions.update(risk.subscription_id,{cancel_at_period_end:true},{idempotencyKey:`daybridge-risk-${event!.id}-${risk.subscription_id}`});
 }
 const {data:accepted,error:saveError}=await service.rpc('daybridge_finish_billing_sync',{p_customer_id:customer,p_version:version,p_subscriptions:subscriptions,p_event_id:event?.id??null,p_event_type:event?.type??null,p_risks:risks});
 if(saveError||accepted!==true)throw Error('Billing synchronization will retry');
}
export async function eventCustomer(event:Stripe.Event){
 const object=event.data.object;
 if(object.object==='checkout.session'){
  if(object.mode!=='subscription'||!['paid','no_payment_required'].includes(object.payment_status))return null;
  // A completed async checkout with unpaid status never grants access.
  return stripeId(object.customer);
 }
 if(object.object==='subscription'||object.object==='invoice')return stripeId(object.customer);
 if(object.object==='charge')return stripeId(object.customer);
 if(object.object==='dispute'||object.object==='radar.early_fraud_warning'){
  const charge=await stripeClient().charges.retrieve(stripeId(object.charge)!);return stripeId(charge.customer);
 }
 return null;
}
export async function portalURL(customer:string){
 const session=await stripeClient().billingPortal.sessions.create({customer,configuration:process.env.STRIPE_PORTAL_CONFIGURATION_ID,return_url:billingReturnURL()});return session.url;
}
export async function checkoutURL(userId:string){
 if(!billingConfigured())throw new PrivateRequestError('Subscriptions are being connected. Your records remain safe. Try again shortly.',503);
 const access=await participantAccess(userId);
 if(access.reason!=='subscription_required')throw new PrivateRequestError('A personal subscription is only needed after court sponsorship ends.',409);
 const stripe=stripeClient(),priceId=personalPriceId();const price=await stripe.prices.retrieve(priceId);
 if(!validPersonalPrice(price)||price.livemode!==(process.env.NODE_ENV==='production'))throw Error('Personal price configuration mismatch');
 const customer=await customerForUser(userId);
 for await(const subscription of stripe.subscriptions.list({customer,status:'all',limit:100})){
  if(subscription.items.data.some(i=>i.price.id===priceId)&&!['canceled','incomplete_expired'].includes(subscription.status))return portalURL(customer);
 }
 const service=serviceClient();
 const {data:reserved,error}=await service.rpc('daybridge_reserve_checkout',{p_user_id:userId});
 const row=reserved?.[0];if(error||!row)throw Error('Checkout reservation unavailable');
 if(row.checkout_session_id){
  const existing=await stripe.checkout.sessions.retrieve(row.checkout_session_id);
  if(existing.status==='open'&&existing.url)return existing.url;
  if(existing.status==='complete')return portalURL(customer);
 }
 const session=await stripe.checkout.sessions.create({mode:'subscription',customer,customer_update:{address:'auto',name:'auto'},line_items:[{price:priceId,quantity:1}],subscription_data:{billing_mode:{type:'flexible'}},integration_identifier:'daybridge_personal_kvhtxqna',success_url:billingReturnURL()+'?billing=returned',cancel_url:billingReturnURL()+'?billing=cancelled',expires_at:Math.floor(new Date(row.checkout_expires_at).getTime()/1000)},{idempotencyKey:`daybridge-checkout-${userId}-${row.checkout_generation}`});
 if(!session.url)throw Error('Checkout unavailable');
 const {error:saveError}=await service.from('daybridge_billing_customers').update({checkout_session_id:session.id,checkout_url:session.url}).eq('user_id',userId).eq('checkout_generation',row.checkout_generation);
 if(saveError)throw Error('Checkout could not be saved');return session.url;
}
