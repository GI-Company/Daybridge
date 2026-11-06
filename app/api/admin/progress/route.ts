import {NextResponse} from 'next/server';
import {requireCourtAdmin} from '../../../../lib/admin/courts';
import {PrivateRequestError,assertSameOrigin} from '../../../../lib/security/request';
import {progressQuery} from '../../../../lib/reporting/input';
import {privateReportHeaders,reportFailure,rpcFailure} from '../../../../lib/reporting/response';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 assertSameOrigin(request);
 const parsed=progressQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)throw new PrivateRequestError('Select a court and reporting period of up to 93 days',400);
 const q=parsed.data;const {service,userId,staffSessionId}=await requireCourtAdmin(q.court_id);
 const {data,error}=await service.rpc('daybridge_staff_progress',{p_actor:userId,p_court:q.court_id,p_start:q.start,p_end:q.end,p_user:q.participant??null,p_category:q.category??null,p_session:staffSessionId??null});
 rpcFailure(error);return NextResponse.json(data,{headers:privateReportHeaders});
}catch(e){return reportFailure(e);}}
