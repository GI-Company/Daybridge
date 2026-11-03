import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireCourtAdmin,CourtAccessError} from '../../../../lib/admin/courts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const query=z.object({court_id:z.string().uuid(),before:z.iso.datetime({offset:true}).optional(),before_id:z.string().uuid().optional()})
 .refine(value=>Boolean(value.before)===Boolean(value.before_id));
export async function GET(request:Request){
 try{
  const parsed=query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return NextResponse.json({error:'Choose a valid court and activity cursor'},{status:400,headers});
  const {court_id,before,before_id}=parsed.data;
  const {service,userId}=await requireCourtAdmin(court_id);
  let audit=service.from('daybridge_court_audit').select('id,actor_id,subject_user_id,action,created_at')
   .eq('court_id',court_id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
  // Both cursor components are strictly validated before constructing the PostgREST filter.
  if(before&&before_id)audit=audit.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${before_id})`);
  const {data,error}=await audit;
  if(error)throw error;
  const rows=(data||[]).slice(0,50);
  const ids=Array.from(new Set(rows.map(row=>row.subject_user_id).filter(Boolean))) as string[];
  const names=new Map<string,string>();
  if(ids.length){
   const participants=await service.from('daybridge_court_participants').select('user_id,username').eq('court_id',court_id).in('user_id',ids);
   if(participants.error)throw participants.error;
   for(const row of participants.data||[])names.set(row.user_id,row.username);
  }
  const last=rows.at(-1);
  return NextResponse.json({entries:rows.map(row=>({id:row.id,action:row.action,username:names.get(row.subject_user_id)||null,
   actor_label:row.actor_id===userId?'You':'Court staff',created_at:row.created_at})),
   nextCursor:(data?.length||0)>50&&last?{time:last.created_at,id:last.id}:null},{headers});
 }catch(error){return NextResponse.json({error:error instanceof CourtAccessError?error.message:'Court activity is temporarily unavailable'},
  {status:error instanceof CourtAccessError?error.status:503,headers});}
}
