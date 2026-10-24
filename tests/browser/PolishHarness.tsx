'use client';
import {useMemo,useState} from 'react';
import {DayBridgeProvider,useDayBridge} from '../../lib/storage/store';
import {simulatedBackend} from './SecurityHarness';
import {SettingsView} from '../../components/settings/SettingsView';
import {TodayView} from '../../components/today/TodayView';
import {MoneyView} from '../../components/money/MoneyView';
import {HealthView} from '../../components/health/HealthView';
import {ReviewView} from '../../components/review/ReviewView';
import {ScheduleView} from '../../components/schedule/ScheduleView';
import {AutomaticLiveTravel} from '../../components/travel/AutomaticLiveTravel';
import {Header} from '../../components/common/Header';
import {Navigation} from '../../components/common/Navigation';
const id='synthetic-polish',createdAt='2026-10-01T12:00:00Z';
const event={id:'synthetic-event',userId:id,title:'Community workshop',category:'class',description:'',startTime:'2026-10-23T14:00:00',endTime:'2026-10-23T15:00:00',timezone:'America/New_York',venueType:'virtual',rrule:'FREQ=WEEKLY',travelBufferMinutes:0,prepChecklist:[],createdAt,updatedAt:createdAt};
const seed={profile:{id,fullName:'Alex (Demo)',timezone:'America/New_York',emergencyBufferCents:0},events:[event,{...event,id:'synthetic-check',title:'Drug test check-in',category:'drug_testing',startTime:'2026-10-24T10:00:00',endTime:'2026-10-24T11:00:00',rrule:'FREQ=DAILY',checkInReminderMinutes:15,venueType:'phone'}],
 eventOccurrences:[{id:'synthetic-attended',eventId:event.id,userId:id,startTimeUtc:'2026-10-23T18:00:00Z',endTimeUtc:'2026-10-23T19:00:00Z',attendanceStatus:'attended_self_reported',attendanceRecordedAt:'2026-10-23T19:00:00Z',isException:false}],
 medications:[{id:'synthetic-med',userId:id,name:'Demo medication',strengthText:'Example entry',instructions:'Fictional organizer entry for demonstration only',isPrn:false,isActive:true,inventoryCount:15,refillThreshold:7,createdAt,updatedAt:createdAt}],
 medicationSchedules:[{id:'synthetic-dose',medicationId:'synthetic-med',userId:id,timeOfDay:'08:00',daysOfWeek:[0,1,2,3,4,5,6],dosageLabel:'Example dose'}],medicationLogs:[],
 accounts:[{id:'synthetic-cash',userId:id,name:'Demo checking',accountType:'checking',balanceCents:1017,isActive:true,lastConfirmedAt:'2026-10-24T12:00:00Z'}],
 bills:[{id:'synthetic-bill',userId:id,title:'Demo bill',category:'utilities',amountCents:5000,nextDueDate:'2026-11-01',isAutopay:false,isPaid:false}],
 paycheckPlan:{id:'synthetic-payday',userId:id,expectedNetCents:40000,nextPayday:'2026-11-05',recurringFrequency:'biweekly',confidence:'medium'},
 tasks:[{id:'synthetic-task',userId:id,title:'Prepare for tomorrow',priority:'medium',completed:false,isRecurring:false,subtasks:[],createdAt,updatedAt:createdAt}]};
function Workspace(){
 const data=useDayBridge();const [tab,setTab]=useState('today');
 const navigate=(next:string)=>{setTab(next);window.scrollTo({top:0});};
 return <><AutomaticLiveTravel/><div className="min-h-screen bg-slate-50 text-slate-900">
  <div className="bg-teal-950 px-4 py-2 text-center text-xs font-semibold text-white">Local demonstration · Fictional data</div>
  <Header currentTab={tab} onNavigate={navigate} onOpenQuickAdd={()=>{}}/>
  <div className="flex"><Navigation currentTab={tab} onTabChange={navigate}/>
   <main className="mx-auto w-full min-w-0 max-w-5xl p-4 pb-24">
    <p data-testid="polish-sync" className="sr-only">{data.syncStatus}</p>
    {tab==='today'&&<TodayView onNavigate={navigate} onOpenQuickAdd={()=>{}}/>}
    {tab==='money'&&<MoneyView onOpenQuickAdd={()=>{}}/>}
    {tab==='schedule'&&<ScheduleView onOpenQuickAdd={()=>{}}/>}
    {tab==='health'&&<HealthView onOpenQuickAdd={()=>{}}/>}
    {tab==='review'&&<ReviewView/>}
    {tab==='settings'&&<SettingsView/>}
    {!['today','money','schedule','health','review','settings'].includes(tab)&&<p>Demonstration covers Today, Schedule, Budget, Medications, and Weekly Review.</p>}
   </main>
  </div>
 </div></>;
}
export function PolishHarness(){const backend=useMemo(()=>simulatedBackend(id,seed),[]);return <DayBridgeProvider userId={id} backend={backend}><Workspace/></DayBridgeProvider>;}
