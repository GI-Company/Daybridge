import {NextResponse} from 'next/server';
import {billingHeaders,billingIdentity} from '../../../../lib/billing/server';
import {PrivateRequestError} from '../../../../lib/security/request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const {user,service}=await billingIdentity();
  if(user.app_metadata?.daybridge_managed===true&&user.app_metadata?.daybridge_must_change_password===true)
   throw new PrivateRequestError('Finish password setup before exporting records.',403);
  const {data,error}=await service.from('private_snapshots').select('payload,revision,updated_at').eq('user_id',user.id).maybeSingle();
  if(error)throw Error('Export unavailable');
  return NextResponse.json({exportedAt:new Date().toISOString(),snapshot:data},{headers:{...billingHeaders,'Content-Disposition':'attachment; filename="daybridge-cloud-records.json"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return NextResponse.json({error:'Sign in and reconnect to export your own records.'},{status:error instanceof PrivateRequestError?error.status:503,headers:billingHeaders});}
}
