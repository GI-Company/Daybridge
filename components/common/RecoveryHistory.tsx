'use client';
import React,{useState} from 'react';
import {Download,ShieldCheck} from 'lucide-react';
import {createClient} from '../../lib/supabase/client';

type Revision={revision:number;recorded_at:string};
export function RecoveryHistory(){
 const [records,setRecords]=useState<Revision[]>([]);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [loaded,setLoaded]=useState(false);

 async function loadHistory(){
  setLoading(true);setMessage('');
  const db=createClient();
  try{
   const user=await db?.auth.getUser();
   if(!db||!user?.data.user)throw Error();
   const {data,error}=await db.from('private_snapshot_history')
    .select('revision,recorded_at')
    .eq('user_id',user.data.user.id)
    .order('revision',{ascending:false}).limit(25);
   if(error)throw Error();
   setRecords((data??[]) as Revision[]);
   setLoaded(true);
  }catch{setMessage('Unable to retrieve recovery history. Check your connection.')}
  finally{setLoading(false)}
 }
 async function download(revision:number){
  const db=createClient();setLoading(true);setMessage('');
  try{
   const user=await db?.auth.getUser();
   if(!db||!user?.data.user)throw Error();
   const {data,error}=await db.from('private_snapshot_history')
    .select('revision,payload,recorded_at')
    .eq('user_id',user.data.user.id).eq('revision',revision).single();
   if(error||!data)throw Error();
   if(!window.confirm('This recovery download contains unencrypted private records, including potentially sensitive details. Save it only somewhere secure. Continue?'))return;
   const file=new Blob([JSON.stringify(data.payload,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(file);
   const a=document.createElement('a');a.href=url;a.download='daybridge-recovery-revision-'+revision+'.json';a.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),3000);
   setMessage('Recovery copy downloaded. This did not modify your live records.');
  }catch{setMessage('Recovery download failed. No live records were changed.')}
  finally{setLoading(false)}
 }
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3" aria-labelledby="daybridge-backups">
  <h3 id="daybridge-backups" className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-teal-800"/>Protected cloud recovery history</h3>
  <p className="text-xs leading-5 text-slate-700">DayBridge keeps earlier snapshots when cloud records change. A production update never intentionally clears your records. This list is private to your signed-in account and is stored in Supabase, not in the PWA cache.</p>
  <button type="button" disabled={loading} onClick={()=>void loadHistory()} className="rounded-xl border border-teal-400 px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50">View saved backups</button>
  {loaded&&<ul className="space-y-2">{records.length===0?<li className="text-xs text-slate-600">No earlier revisions yet. An earlier snapshot is recorded each time your saved data changes.</li>:records.map(record=><li key={record.revision} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-800">
    <span>Revision {record.revision} · {new Date(record.recorded_at).toLocaleString()}</span>
    <button disabled={loading} type="button" onClick={()=>void download(record.revision)} className="inline-flex items-center gap-1 rounded-lg bg-teal-800 px-3 py-2 font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4"/>Download</button>
  </li>)}</ul>}
  {message&&<p role="status" className="text-xs text-slate-800">{message}</p>}
 </section>;
}
