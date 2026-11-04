import 'server-only';
import Stripe from 'stripe';

let instance:Stripe|undefined;
export function stripeClient(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw Error('Billing configuration unavailable');
 return instance??=new Stripe(key,{apiVersion:'2026-09-30.endive',maxNetworkRetries:2,timeout:15000});
}
export function billingConfigured(){return Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET&&process.env.STRIPE_PORTAL_CONFIGURATION_ID&&process.env.DAYBRIDGE_PUBLIC_URL);}
export function billingReturnURL(){
 const url=new URL(process.env.DAYBRIDGE_PUBLIC_URL||'');
 if(url.protocol!=='https:'||url.username||url.password)throw Error('Billing return address unavailable');
 return url.origin+'/';
}
export function personalPriceId(){const id=process.env.STRIPE_PRICE_ID;if(!id?.startsWith('price_'))throw Error('Billing price unavailable');return id;}
