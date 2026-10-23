'use client';
import {useDayBridge} from '../../lib/storage/store';
import type {NotificationDestination} from '../../lib/notifications/destination';
export function NotificationRecordStatus({target}:{target:NotificationDestination|null}){
 const {events,tasks,medications,bills,syncStatus}=useDayBridge();
 if(!target||syncStatus!=='synced')return null;
 const missing=target.event&&!events.some(x=>x.id===target.event)?'appointment':
  target.task&&!tasks.some(x=>x.id===target.task)?'task':
  target.medication&&!medications.some(x=>x.id===target.medication&&x.isActive)?'medication':
  target.bill&&!bills.some(x=>x.id===target.bill)?'bill':null;
 return missing?<p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This {missing} is no longer available. Your current records are shown below.</p>:null;
}
