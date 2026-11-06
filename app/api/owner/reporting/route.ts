import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requirePlatformOwner} from '../../../../lib/admin/owner';
import {readPrivateJSON,PrivateRequestError} from '../../../../lib/security/request';
import {privateReportHeaders,reportFailure,rpcFailure} from '../../../../lib/reporting/response';
export const dynamic='force-dynamic';
const input=z.object({court_id:z.string().uuid(),enabled:z.boolean()}).strict();
async function run(court:string,enabled:boolean|null){
 const {service,userId}=await requirePlatformOwner();
 const {data,error}=await service.rpc('daybridge_owner_reporting',{p_actor:userId,p_court:court,p_enabled:enabled});
 rpcFailure(error);return NextResponse.json({enabled:data===true},{headers:privateReportHeaders});
}
export async function GET(request:Request){try{const court=new URL(request.url).searchParams.get('court_id');if(!z.string().uuid().safeParse(court).success)throw new PrivateRequestError('Choose a valid court',400);return await run(court!,null);}catch(e){return reportFailure(e);}}
export async function PATCH(request:Request){try{const parsed=input.safeParse(await readPrivateJSON(request));if(!parsed.success)throw new PrivateRequestError('Choose a valid court and availability',400);return await run(parsed.data.court_id,parsed.data.enabled);}catch(e){return reportFailure(e);}}
