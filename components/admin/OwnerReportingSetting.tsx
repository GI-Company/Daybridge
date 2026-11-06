'use client';
import {useEffect,useRef,useState} from 'react';
import {panel,secondary} from './PortalPanels';
export function OwnerReportingSetting({courtId}:{courtId:string}){
 const [enabled,setEnabled]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{const epoch=++generation.current;setEnabled(null);setError('');void fetch('/api/owner/reporting?court_id='+encodeURIComponent(courtId),{cache:'no-store'}).then(async r=>{const d=await r.json();if(generation.current!==epoch)return;if(!r.ok)throw Error(d.error||'Reporting availability unavailable');setEnabled(d.enabled===true);}).catch(()=>{if(generation.current===epoch)setError('Reporting availability unavailable. Leave this feature disabled until its migration and tests are approved.');});return()=>{generation.current++;};},[courtId]);
 const change=async()=>{
  if(enabled===null||!window.confirm(enabled?'Disable reporting and withdraw current sharing? Participants must consent and choose items again if it is restored.':'Enable voluntary reporting for this court after testing? This does not enable any participant consent or expose private organizer records.'))return;
  const epoch=generation.current;setBusy(true);setError('');
  try{const r=await fetch('/api/owner/reporting',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({court_id:courtId,enabled:!enabled})});const d=await r.json();if(generation.current!==epoch)return;if(!r.ok)throw Error(d.error||'Availability change failed');setEnabled(d.enabled===true);}
  catch(e){if(generation.current===epoch)setError(e instanceof Error?e.message:'Availability change failed');}finally{if(generation.current===epoch)setBusy(false);}
 };
 return <section className={panel+' space-y-3 p-5'}><h3 className="font-bold">Voluntary participant reporting</h3><p className="text-sm text-slate-600">Additional capability, disabled by default. Keep it disabled during the initial pilot. Enabling availability still requires each participant’s voluntary category consent and specific item choices. The owner dashboard never receives progress data.</p><p className="text-sm font-semibold">Status: {enabled===null?'Not verified':enabled?'Enabled for participant choice':'Disabled'}</p>{error&&<p role="alert" className="text-sm text-rose-800">{error}</p>}<button className={secondary} disabled={busy||enabled===null} onClick={()=>void change()}>{busy?'Saving…':enabled?'Disable reporting':'Enable reporting after testing'}</button></section>;
}
