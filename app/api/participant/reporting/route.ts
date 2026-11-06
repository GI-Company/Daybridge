import {NextResponse} from 'next/server';
import {serverSupabase} from '../../../../lib/supabase/server';
import {CourtAccessError,serviceClient} from '../../../../lib/admin/courts';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
import {participantReportingInput} from '../../../../lib/reporting/input';
import {privateReportHeaders,reportFailure,rpcFailure} from '../../../../lib/reporting/response';
export const dynamic='force-dynamic';
async function run(input:unknown){
 const db=await serverSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new CourtAccessError(401,'Sign in to manage your court sharing');
 const {data,error:rpcError}=await serviceClient().rpc('daybridge_participant_reporting',{p_actor:user.id,p_input:input});
 rpcFailure(rpcError);return NextResponse.json(data,{headers:privateReportHeaders});
}
export async function GET(){try{return await run({action:'read'});}catch(e){return reportFailure(e);}}
export async function POST(request:Request){try{
 const parsed=participantReportingInput.safeParse(await readPrivateJSON(request));
 if(!parsed.success)throw new PrivateRequestError('Choose a valid reporting action',400);
 return await run(parsed.data);
}catch(e){return reportFailure(e);}}
