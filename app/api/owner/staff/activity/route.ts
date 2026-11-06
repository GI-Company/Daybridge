import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requirePlatformOwner} from '../../../../../lib/admin/owner';
import {CourtAccessError} from '../../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const input=z.object({court_id:z.string().uuid(),user_id:z.string().uuid(),before:z.iso.datetime({offset:true}).optional(),before_id:z.string().uuid().optional()}).strict()
 .refine(value=>Boolean(value.before)===Boolean(value.before_id));
export async function GET(request:Request){
 try{
  const {service}=await requirePlatformOwner();
  const parsed=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return NextResponse.json({error:'Choose a valid court, staff member and activity cursor'},{status:400,headers});
  const {court_id,user_id,before,before_id}=parsed.data;
  // Include revoked memberships: employment changes must not hide their history.
  const {data:member,error:memberError}=await service.from('daybridge_court_staff').select('user_id').eq('court_id',court_id).eq('user_id',user_id).maybeSingle();
  if(memberError)throw memberError;
  if(!member)return NextResponse.json({error:'Staff identity is not assigned to this court'},{status:404,headers});
  const actor=`actor_id.eq.${user_id}`,subject=`subject_user_id.eq.${user_id}`;
  const cursor=before&&before_id?`or(created_at.lt.${before},and(created_at.eq.${before},id.lt.${before_id}))`:null;
  const filter=cursor?`and(${actor},${cursor}),and(${subject},${cursor})`:`${actor},${subject}`;
  const {data,error}=await service.from('daybridge_court_audit').select('id,action,actor_id,created_at')
   .eq('court_id',court_id).or(filter).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(26);
  if(error)throw error;
  const entries=(data||[]).slice(0,25),last=entries.at(-1);
  return NextResponse.json({entries:entries.map(({actor_id,...entry})=>({...entry,relation:actor_id===user_id?'Performed by this staff member':'Affected this staff member'})),
   nextCursor:(data?.length||0)>25&&last?{time:last.created_at,id:last.id}:null},{headers});
 }catch(error){return NextResponse.json({error:error instanceof CourtAccessError?error.message:'Staff activity is temporarily unavailable'},
  {status:error instanceof CourtAccessError?error.status:503,headers});}
}
