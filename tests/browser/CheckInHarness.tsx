'use client';
import {useEffect,useMemo,useState} from 'react';
import {DayBridgeProvider,useDayBridge} from '../../lib/storage/store';
import {QuickAddModal} from '../../components/common/QuickAddModal';
import {ScheduleView} from '../../components/schedule/ScheduleView';
import {CourtView} from '../../components/court/CourtView';
import {useNotificationNavigation} from '../../lib/notifications/use-navigation';
import {TodayView} from '../../components/today/TodayView';
import {dueReminders} from '../../lib/notifications/reminders';
import {wallTime} from '../../lib/notifications/time';
import {simulatedBackend} from './SecurityHarness';
const zone='America/New_York',id='synthetic-check-in';
const seed={profile:{id,fullName:'Synthetic check-in owner',timezone:zone},tasks:[{id:'legacy-task',userId:id,title:'Existing task to preserve',completed:false,priority:'medium',isRecurring:false,subtasks:[],createdAt:'',updatedAt:''}],
 events:[{id:'legacy-event',userId:id,title:'Existing weekly appointment',category:'personal',description:'',startTime:'2026-10-23T14:00:00',endTime:'2026-10-23T15:00:00',timezone:zone,venueType:'virtual',rrule:'FREQ=WEEKLY',travelBufferMinutes:0,prepChecklist:[],createdAt:'',updatedAt:''}],customPreservedField:{value:'preserve-me'}};
function Workspace(){
 const data=useDayBridge();const [add,setAdd]=useState(false),[view,setView]=useState('schedule');
 const [date,setDate]=useState('2026-10-24');
 const {target}=useNotificationNavigation(id);
 useEffect(()=>{if(target?.event){setView('schedule');if(target.date)setDate(target.date);}},[target]);
 const now=wallTime('2026-10-24T10:01:00',zone),tomorrow=wallTime('2026-10-25T10:01:00',zone);
 return <main className="mx-auto max-w-3xl p-3">
  <p data-testid="check-in-sync">{data.syncStatus}</p>
  <pre data-testid="check-in-records" className="break-all whitespace-pre-wrap">{JSON.stringify({events:data.events,occurrences:data.eventOccurrences,tasks:data.tasks,
    reminders:dueReminders(data,id,now).filter(x=>x.sourceId!=='legacy-event'),tomorrowReminders:dueReminders(data,id,tomorrow).filter(x=>x.sourceId!=='legacy-event')})}</pre>
  <button onClick={()=>{setDate('2026-10-24');setAdd(true);}}>Add synthetic appointment</button>
  <button onClick={()=>setView(view==='today'?'schedule':'today')}>Switch Today / Schedule</button>
  <button onClick={()=>setView('court')}>Open Court</button>
  <button onClick={data.retrySync}>Flush check-in edits</button>
  {view==='schedule'?<ScheduleView focusDate={date} focusEventId={target?.event} focusRevision={target?.revision} onOpenQuickAdd={day=>{setDate(day||'2026-10-24');setAdd(true);}}/>:view==='court'?<CourtView onOpenQuickAdd={()=>setAdd(true)} onNavigate={()=>{}}/>:<TodayView onNavigate={()=>{}} onOpenQuickAdd={()=>setAdd(true)}/>}
  {add&&<QuickAddModal isOpen initialType="event" initialDate={date} onClose={()=>setAdd(false)}/>}
 </main>;
}
export function CheckInHarness(){const backend=useMemo(()=>simulatedBackend(id,seed),[]);return <DayBridgeProvider userId={id} backend={backend}><Workspace/></DayBridgeProvider>;}
