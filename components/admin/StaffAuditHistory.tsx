'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {auditActionLabels} from '../../lib/admin/portal-types';
import {PortalFeedback,secondary} from './PortalPanels';
type Cursor={time:string;id:string};
type Entry={id:string;action:string;created_at:string;relation:string};
export function StaffAuditHistory({courtId,userId,username,onClose}:{courtId:string;userId:string;username:string;onClose:()=>void}){
 const [entries,setEntries]=useState<Entry[]>([]),[next,setNext]=useState<Cursor|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const sequence=useRef(0);
 const load=useCallback(async(cursor?:Cursor)=>{
  const request=++sequence.current;setLoading(true);setError('');
  const params=new URLSearchParams({court_id:courtId,user_id:userId});if(cursor){params.set('before',cursor.time);params.set('before_id',cursor.id);}
  try{
   const response=await fetch('/api/owner/staff/activity?'+params,{cache:'no-store'}),result=await response.json();
   if(request!==sequence.current)return;
   if(!response.ok)throw Error(result.error||'Could not load staff history');
   setEntries(previous=>cursor?Array.from(new Map([...previous,...result.entries].map(entry=>[entry.id,entry])).values()):result.entries);setNext(result.nextCursor);
  }catch(error){if(request===sequence.current){setEntries([]);setNext(null);setError(error instanceof Error?error.message:'Could not load staff history');}}
  finally{if(request===sequence.current)setLoading(false);}
 },[courtId,userId]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
 return <section aria-label={'Audit history for '+username} className="mt-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-all text-sm font-semibold">Audit history · {username}</h4><button className={secondary} onClick={onClose}>Close history</button></div><p className="mt-2 text-xs leading-5 text-slate-500">Court events performed by or affecting this staff identity, including before access was revoked. Passwords and participant content are excluded.</p>{error&&<div className="mt-3"><PortalFeedback tone="error" title={error}/></div>}<ol className="mt-3 divide-y divide-teal-100">{entries.map(entry=><li key={entry.id} className="py-3"><p className="text-sm font-semibold">{auditActionLabels[entry.action]||'Court administration event'}</p><p className="mt-1 text-xs text-slate-600">{entry.relation}</p><time dateTime={entry.created_at} className="mt-1 block text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</time></li>)}</ol>{!loading&&!error&&!entries.length&&<p className="mt-3 text-sm text-slate-600">No recorded court activity for this staff identity yet.</p>}{loading&&<p role="status" className="mt-3 text-sm text-slate-600">Loading staff history…</p>}<div className="mt-3 flex flex-wrap gap-2"><button className={secondary} disabled={loading} onClick={()=>void load()}>Refresh history</button>{next&&<button className={secondary} disabled={loading} onClick={()=>void load(next)}>Load older events</button>}</div></section>;
}
