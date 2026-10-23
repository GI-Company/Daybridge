'use client';
import React,{useState} from 'react';
import {DayBridgeContext} from '../../lib/storage/store';
import {useNotificationNavigation} from '../../lib/notifications/use-navigation';
import {ScheduleView} from '../../components/schedule/ScheduleView';
import {TasksView} from '../../components/tasks/TasksView';
import {HealthView} from '../../components/health/HealthView';
import {MoneyView} from '../../components/money/MoneyView';
import {SettingsView} from '../../components/settings/SettingsView';
import {NotificationRecordStatus} from '../../components/common/NotificationRecordStatus';
import type {UserProfile,CalendarEvent,TaskItem,Medication,MedicationSchedule,Bill} from '../../lib/types';
const day='2026-10-23';
export function NotificationsHarness(){
 const {currentTab,navigate,target,notice}=useNotificationNavigation('fixture-account');
 const [hydrated,setHydrated]=useState(false);
 const event={id:'fixture-event',userId:'fixture-account',description:'',travelBufferMinutes:0,createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:00Z',title:'Exact appointment from notification',category:'personal',startTime:day+'T10:00:00',endTime:day+'T11:00:00',timezone:'America/New_York',venueType:'virtual',prepChecklist:[]} as CalendarEvent;
 const task={id:'fixture-task',title:'Exact task from notification',priority:'high',completed:false,subtasks:[{id:'subtask',title:'Preparation detail',completed:false}]} as TaskItem;
 const medication={id:'fixture-medication',name:'Fixture medication',isActive:true,isPrn:false} as Medication;
 const bill={id:'fixture-bill',title:'Exact bill from notification',nextDueDate:day,amountCents:100,isPaid:false} as Bill;
 const profile={fullName:'Test account',timezone:'America/New_York',quietHoursStart:'22:00',quietHoursEnd:'07:00',reminderLeadMinutes:30} as UserProfile;
 const records={profile,events:hydrated?[event]:[],eventOccurrences:[],tasks:hydrated?[task]:[],medications:hydrated?[medication]:[],medicationSchedules:[{id:'s-1',medicationId:medication.id,timeOfDay:'08:00',daysOfWeek:[5]} as MedicationSchedule],medicationLogs:[],bills:hydrated?[bill]:[],savedPlaces:[],accounts:[],transactions:[],reserves:[],advances:[],paycheckPlan:null,contacts:[],syncStatus:hydrated?'synced':'syncing',isLiveSupabase:false,
  onOpenQuickAdd:()=>{},recordAttendance:()=>{},toggleTask:()=>{},deleteTask:()=>{},updateProfile:()=>{},retrySync:()=>{}} as unknown as NonNullable<React.ContextType<typeof DayBridgeContext>>;
 return <DayBridgeContext.Provider value={records}><main className="mx-auto max-w-5xl p-4">
  <button onClick={()=>setHydrated(true)}>Load synced fixture records</button><button onClick={()=>navigate('today')}>Navigate Today</button>
  <p data-testid="active-tab">{currentTab}</p>{notice&&<p role="status">{notice}</p>}<NotificationRecordStatus target={target}/>
  {currentTab==='schedule'&&<ScheduleView focusDate={target?.date} focusEventId={target?.event} focusRevision={target?.revision} onOpenQuickAdd={()=>{}}/>}
  {currentTab==='tasks'&&<TasksView focusTaskId={target?.task} focusRevision={target?.revision} onOpenQuickAdd={()=>{}}/>}
  {currentTab==='health'&&<HealthView focusMedicationId={target?.medication} focusSlot={target?.slot} focusDate={target?.date} focusRevision={target?.revision} onOpenQuickAdd={()=>{}}/>}
  {currentTab==='money'&&<MoneyView focusBillId={target?.bill} focusRevision={target?.revision} onOpenQuickAdd={()=>{}}/>}
  {currentTab==='settings'&&<SettingsView/>}
 </main></DayBridgeContext.Provider>;
}
