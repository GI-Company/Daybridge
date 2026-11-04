'use client';
import {changeDose} from './dose-change';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  UserProfile,
  SavedPlace,
  CalendarEvent,
  EventOccurrence,
  TaskItem,
  NoteBooklet,
  NoteColor,
  Medication,
  MedicationSchedule,
  MedicationLog,
  BudgetAccount,
  MoneyTransaction,
  PaycheckPlan,
  WageAdvance,
  Bill,
  BudgetReserve,
  ResourceContact,
  DoseAction,
  AttendanceStatus,
} from '../types';
import { isSupabaseConfigured, createClient } from '../supabase/client';
import {useSnapshotSync} from './use-snapshot-sync';
import type {Snapshot,MergeChoice} from './merge-snapshots';
import {newRecordId} from './record-id';
import type {SupabaseClient} from '@supabase/supabase-js';
import {applyAccountMovement} from '../budget-ledger';

// Initial realistic baseline data
const DEFAULT_PROFILE: UserProfile = {
  id: '',
  fullName: '',
  timezone: 'America/New_York',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  privacyMode: false,
  emergencyBufferCents: 1500, // $15.00 safety buffer
  gasTargetCents: 3500,
  foodTargetCents: 4000,
  reminderLeadMinutes: 30,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface DayBridgeContextType {
  profile: UserProfile;
  savedPlaces: SavedPlace[];
  addSavedPlace:(place:Omit<SavedPlace,'id'|'userId'|'createdAt'|'updatedAt'>)=>void;
  updateSavedPlace:(id:string,place:Partial<Pick<SavedPlace,'label'|'category'|'address'|'lat'|'lon'>>)=>void;
  deleteSavedPlace:(id:string)=>void;
  events: CalendarEvent[];
  eventOccurrences: EventOccurrence[];
  tasks: TaskItem[];
  noteBooklets: NoteBooklet[];
  addNoteBooklet: () => string;
  updateNoteBooklet: (id:string, updates:Partial<Pick<NoteBooklet,'title'|'category'|'color'>>) => void;
  deleteNoteBooklet: (id:string) => void;
  addNotePage: (id:string) => string;
  updateNotePage: (bookletId:string,pageId:string,content:string) => void;
  deleteNotePage: (bookletId:string,pageId:string) => void;
  medications: Medication[];
  medicationSchedules: MedicationSchedule[];
  medicationLogs: MedicationLog[];
  accounts: BudgetAccount[];
  transactions: MoneyTransaction[];
  paycheckPlan: PaycheckPlan | null;
  advances: WageAdvance[];
  bills: Bill[];
  reserves: BudgetReserve[];
  contacts: ResourceContact[];
  canUndo:boolean;
  canRedo:boolean;
  undoChange:()=>void;
  redoChange:()=>void;
  syncStatus: 'synced' | 'device_saved' | 'local_only' | 'syncing' | 'offline';
  syncIssue: string | null;
  retrySync: () => void;
  prepareSignOut?:()=>Promise<void>;
  syncConflict?:boolean;
  resolveSyncConflict?:(choice:MergeChoice)=>Promise<void>;
  isLiveSupabase: boolean;

  // Actions
  updateProfile: (profile: Partial<UserProfile>) => void;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => CalendarEvent;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setCheckInDone: (eventId:string, originalStartTimeUtc:string, endTimeUtc:string, done:boolean) => void;
  recordAttendance: (
    occurrenceId: string,
    eventId: string,
    status: AttendanceStatus,
    note?: string, startTimeUtc?:string, endTimeUtc?:string
  ) => void;

  addTask: (task: Omit<TaskItem, 'id' | 'userId' | 'completed' | 'createdAt' | 'updatedAt'>) => TaskItem;
  updateTask:(id:string,updates:Partial<Pick<TaskItem,'dueDate'|'notes'|'reminderLeadMinutes'>>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addMedication: (
    med: Omit<Medication, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>,
    schedules: { timeOfDay: string; daysOfWeek: number[]; dosageLabel: string }[]
  ) => void;
  updateMedication: (id: string, updates: Partial<Medication>) => void;
  replaceMedicationSchedules: (medicationId:string,times:string[],days:number[]) => void;
  deleteMedication: (id: string) => void;
  logDose: (medicationId: string, scheduledSlotUtc: string, action: DoseAction, reason?: string) => void;
  undoDose:(medicationId:string,scheduledSlotUtc:string)=>void;

  addAccount: (account: Pick<BudgetAccount,'name'|'accountType'|'balanceCents'>) => string;
  updateAccountBalance: (accountId: string, newBalanceCents: number) => void;
  addTransaction: (tx: Omit<MoneyTransaction, 'id' | 'userId' | 'createdAt'>) => void;
  deleteTransaction: (id: string) => void;
  updatePaycheckPlan: (plan: Partial<PaycheckPlan>) => void;
  setPaycheckForecast: (plan:Pick<PaycheckPlan,'expectedNetCents'|'nextPayday'|'recurringFrequency'|'confidence'>)=>void;
  recordPaycheckDeposit: (accountId:string,amountCents:number)=>boolean;
  addAdvance: (advance: Omit<WageAdvance, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, depositAccountId:string) => void;
  markBillPaid: (billId: string, createTransaction?: boolean, accountId?:string) => void;
  addBill: (bill: Omit<Bill, 'id' | 'userId' | 'isPaid' | 'lastPaidAt' | 'createdAt' | 'updatedAt'>) => void;
  addReserve: (reserve: Pick<BudgetReserve,'name'|'category'|'targetCents'|'allocatedCents'|'isEssential'>)=>void;
  deleteReserve: (reserveId:string)=>void;
  updateReserve: (reserveId: string, allocatedCents: number) => void;

  addContact: (contact: Omit<ResourceContact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  deleteContact: (id: string) => void;

  resetToDefaults: () => void;
  clearAllUserData: () => void;
}

export const DayBridgeContext = createContext<DayBridgeContextType | null>(null);

export const DayBridgeProvider: React.FC<{ children: React.ReactNode; userId: string; backend?:SupabaseClient|null }> = ({ children, userId, backend=createClient() }) => {
  const [profile, setProfile] = useState<UserProfile>({...DEFAULT_PROFILE,id:userId});
  const [savedPlaces,setSavedPlaces]=useState<SavedPlace[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventOccurrences, setEventOccurrences] = useState<EventOccurrence[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [noteBooklets,setNoteBooklets]=useState<NoteBooklet[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const medicationsRef=useRef<Medication[]>([]);
  useEffect(()=>{medicationsRef.current=medications;},[medications]);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationSchedule[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const medicationLogsRef=useRef<MedicationLog[]>([]);
  useEffect(()=>{medicationLogsRef.current=medicationLogs;},[medicationLogs]);
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [paycheckPlan, setPaycheckPlan] = useState<PaycheckPlan | null>(null);
  const [advances, setAdvances] = useState<WageAdvance[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [reserves, setReserves] = useState<BudgetReserve[]>([]);
  const [contacts, setContacts] = useState<ResourceContact[]>([]);

  // Recent undo snapshots stay in memory, never in unencrypted browser storage.
  // The existing encrypted local queue automatically saves every reversal.
  const historyCurrentRef=useRef('');
  const undoStackRef=useRef<string[]>([]);
  const redoStackRef=useRef<string[]>([]);
  const historyRestoringRef=useRef<string|null>(null);
  const [,refreshHistory]=useState(0);
  const applyHistory=(serialized:string)=>{
    const previous=JSON.parse(serialized) as Record<string,unknown>;
    setProfile(previous.profile as UserProfile);
    setSavedPlaces(previous.savedPlaces as SavedPlace[]);
    setEvents(previous.events as CalendarEvent[]);
    setEventOccurrences(previous.eventOccurrences as EventOccurrence[]);
    setTasks(previous.tasks as TaskItem[]);
    setNoteBooklets(previous.noteBooklets as NoteBooklet[]);
    setMedications(previous.medications as Medication[]);
    setMedicationSchedules(previous.medicationSchedules as MedicationSchedule[]);
    setMedicationLogs(previous.medicationLogs as MedicationLog[]);
    setAccounts(previous.accounts as BudgetAccount[]);
    setTransactions(previous.transactions as MoneyTransaction[]);
    setPaycheckPlan(previous.paycheckPlan as PaycheckPlan|null);
    setAdvances(previous.advances as WageAdvance[]);
    setBills(previous.bills as Bill[]);
    setReserves(previous.reserves as BudgetReserve[]);
    setContacts(previous.contacts as ResourceContact[]);
  };
  const undoChange=()=>{
    if(!undoStackRef.current.length||!window.confirm('Undo your last change? This updates saved records.'))return;
    const previous=undoStackRef.current.pop()!;
    redoStackRef.current.push(historyCurrentRef.current);
    historyRestoringRef.current=previous;
    applyHistory(previous);
    refreshHistory(v=>v+1);
  };
  const redoChange=()=>{
    if(!redoStackRef.current.length||!window.confirm('Redo your last undone change? This updates saved records.'))return;
    const next=redoStackRef.current.pop()!;
    undoStackRef.current.push(historyCurrentRef.current);
    historyRestoringRef.current=next;
    applyHistory(next);
    refreshHistory(v=>v+1);
  };

  const unknownFieldsRef=useRef<Record<string,unknown>>({});
  const remoteFingerprintRef=useRef<string|null>(null);
  const paidBillIdsRef=useRef(new Set<string>());
  const depositedPlanIdsRef=useRef(new Set<string>());
  const collectionKeys=['savedPlaces','events','eventOccurrences','tasks','noteBooklets','medications','medicationSchedules','medicationLogs','accounts','transactions','advances','bills','reserves','contacts'];
  const normalize=(saved:Snapshot):Snapshot=>{
    const next:Snapshot={...saved,profile:{...DEFAULT_PROFILE,...(saved.profile&&typeof saved.profile==='object'?saved.profile:{}),id:userId},paycheckPlan:saved.paycheckPlan||null};
    for(const key of collectionKeys)next[key]=Array.isArray(saved[key])?saved[key]:[];
    return next;
  };
  const payload:Snapshot={...unknownFieldsRef.current,profile,savedPlaces,events,eventOccurrences,tasks,noteBooklets,medications,medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,advances,bills,reserves,contacts};
  const applyRemote=(saved:Snapshot)=>{
    unknownFieldsRef.current=Object.fromEntries(Object.entries(saved).filter(([key])=>!['profile','paycheckPlan',...collectionKeys].includes(key)));
    remoteFingerprintRef.current=JSON.stringify({...unknownFieldsRef.current,profile:saved.profile,savedPlaces:saved.savedPlaces,events:saved.events,eventOccurrences:saved.eventOccurrences,tasks:saved.tasks,noteBooklets:saved.noteBooklets,medications:saved.medications,medicationSchedules:saved.medicationSchedules,medicationLogs:saved.medicationLogs,accounts:saved.accounts,transactions:saved.transactions,paycheckPlan:saved.paycheckPlan,advances:saved.advances,bills:saved.bills,reserves:saved.reserves,contacts:saved.contacts});
    applyHistory(JSON.stringify(saved));
  };
  const {isLoaded,syncStatus,syncIssue,syncConflict,retrySync,prepareSignOut,resolveSyncConflict}=useSnapshotSync({userId,backend,payload,normalize,apply:applyRemote});
  const isLive=isSupabaseConfigured();
  useEffect(()=>{
    if(!isLoaded)return;
    const fingerprint=JSON.stringify(payload);
    if(remoteFingerprintRef.current===fingerprint){
      remoteFingerprintRef.current=null;historyCurrentRef.current=fingerprint;
      // An old whole-workspace undo must not roll back another device's records.
      undoStackRef.current=[];redoStackRef.current=[];historyRestoringRef.current=null;refreshHistory(v=>v+1);return;
    }
    if(historyRestoringRef.current===fingerprint){historyCurrentRef.current=fingerprint;historyRestoringRef.current=null;}
    else if(historyCurrentRef.current&&historyCurrentRef.current!==fingerprint){
      undoStackRef.current.push(historyCurrentRef.current);if(undoStackRef.current.length>30)undoStackRef.current.shift();redoStackRef.current=[];historyCurrentRef.current=fingerprint;refreshHistory(v=>v+1);
    }else if(!historyCurrentRef.current)historyCurrentRef.current=fingerprint;
  },[isLoaded,payload]);

  // Saved places stay private to this user, persist alongside the other cloud records,
  // and are never queried by name from a public directory.
  const addSavedPlace=(input:Omit<SavedPlace,'id'|'userId'|'createdAt'|'updatedAt'>)=>{
    const now=new Date().toISOString();
    setSavedPlaces(prev=>[...prev,{...input,id:crypto.randomUUID(),userId,createdAt:now,updatedAt:now}]);
  };
  const updateSavedPlace=(id:string,updates:Partial<Pick<SavedPlace,'label'|'category'|'address'|'lat'|'lon'>>)=>{
    setSavedPlaces(prev=>prev.map(p=>p.id===id?{...p,...updates,updatedAt:new Date().toISOString()}:p));
  };
  const deleteSavedPlace=(id:string)=>setSavedPlaces(prev=>prev.filter(p=>p.id!==id));
  // Actions
  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
  };

  const addEvent = (newEventData: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const id = newRecordId('evt');
    const newEvent: CalendarEvent = {
      ...newEventData,
      id,
      userId: profile.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);
    return newEvent;
  };

  const updateEvent = (id: string, updates: Partial<CalendarEvent>) => {
    if(updates.startTime!==undefined||updates.endTime!==undefined||updates.venueType!==undefined){
      const travelBackend=backend;
      void travelBackend?.from('travel_appointments').update({enabled:false,cancelled:true}).eq('source_event_id',id);
    }
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
    );
  };

  const deleteEvent = (id: string) => {
    const travelBackend=backend;
    void travelBackend?.from('travel_appointments').update({enabled:false,cancelled:true}).eq('source_event_id',id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEventOccurrences((prev) => prev.filter((o) => o.eventId !== id));
  };

  const setCheckInDone = (eventId:string,originalStartTimeUtc:string,endTimeUtc:string,done:boolean) => {
    const source=events.find(event=>event.id===eventId);
    if(source?.category!=='drug_testing'||source.checkInReminderMinutes!==15)return;
    const start=Date.parse(originalStartTimeUtc),end=Date.parse(endTimeUtc);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return;
    const completedAt=done?new Date().toISOString():undefined;
    setEventOccurrences(prev=>{
      const existing=prev.find(o=>o.eventId===eventId&&Date.parse(o.startTimeUtc)===start);
      if(existing)return prev.map(o=>o===existing?{...o,checkInCompletedAt:completedAt}:o);
      if(!done)return prev;
      return [...prev,{id:`occ-${eventId}-${start}`,eventId,userId:profile.id,
        startTimeUtc:new Date(start).toISOString(),endTimeUtc:new Date(end).toISOString(),
        attendanceStatus:'unconfirmed',checkInCompletedAt:completedAt,isException:false}];
    });
  };

  const recordAttendance = (
    occurrenceId: string,
    eventId: string,
    status: AttendanceStatus,
    note: string = '', startTimeUtc?:string, endTimeUtc?:string
  ) => {
    const source=events.find(event=>event.id===eventId);if(!source)return;
    const generated=occurrenceId.startsWith(eventId+'-')?occurrenceId.slice(eventId.length+1).match(/^\d{10,}$/)?.[0]:undefined;
    const start=new Date(startTimeUtc||(generated?Number(generated):source.startTime));
    if(!Number.isFinite(start.getTime()))return;
    const end=new Date(endTimeUtc||start.getTime()+Date.parse(source.endTime)-Date.parse(source.startTime));
    if(!Number.isFinite(end.getTime()))return;
    setEventOccurrences((prev) => {
      const existing = prev.find((o) => o.id === occurrenceId);
      if (existing) {
        return prev.map((o) =>
          o.id === existing.id
            ? {
                ...o,
                attendanceStatus: status,
                attendanceRecordedAt: new Date().toISOString(),
                attendanceNote: note,
              }
            : o
        );
      } else {
        const newOcc: EventOccurrence = {
          id: occurrenceId || newRecordId('occ'),
          eventId,
          userId: profile.id,
          startTimeUtc: start.toISOString(),
          endTimeUtc: end.toISOString(),
          attendanceStatus: status,
          attendanceRecordedAt: new Date().toISOString(),
          attendanceNote: note,
          isException: false,
        };
        return [...prev, newOcc];
      }
    });
  };

  const addTask = (taskData: Omit<TaskItem, 'id' | 'userId' | 'completed' | 'createdAt' | 'updatedAt'>) => {
    const newTask: TaskItem = {
      ...taskData,
      id: newRecordId('tsk'),
      userId: profile.id,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  };

  const updateTask=(id:string,updates:Partial<Pick<TaskItem,'dueDate'|'notes'|'reminderLeadMinutes'>>)=>{
    setTasks(prev=>prev.map(task=>task.id===id?{...task,...updates,
      notes:updates.notes===undefined?task.notes:updates.notes.slice(0,4000),
      reminderLeadMinutes:updates.reminderLeadMinutes===undefined?task.reminderLeadMinutes:Math.max(0,Math.min(300,updates.reminderLeadMinutes)),
      updatedAt:new Date().toISOString()}:task));
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addNoteBooklet=()=>{
    const now=new Date().toISOString(),id=newRecordId('book');
    const page:NoteBooklet['pages'][number]={id:newRecordId('page'),content:'',createdAt:now,updatedAt:now};
    setNoteBooklets(prev=>[{id,userId,title:'New booklet',category:'Personal',color:'yellow',pages:[page],createdAt:now,updatedAt:now},...prev]);
    return id;
  };
  const updateNoteBooklet=(id:string,updates:Partial<Pick<NoteBooklet,'title'|'category'|'color'>>)=>{
    const permittedColors:NoteColor[]=['yellow','pink','mint','blue','lavender'];
    setNoteBooklets(prev=>prev.map(book=>book.id===id?{
      ...book,...(updates.title!==undefined?{title:updates.title.slice(0,100)}:{}),
      ...(updates.category!==undefined?{category:updates.category.slice(0,60)}:{}),
      ...(updates.color&&permittedColors.includes(updates.color)?{color:updates.color}:{}),
      updatedAt:new Date().toISOString()
    }:book));
  };
  const deleteNoteBooklet=(id:string)=>setNoteBooklets(prev=>prev.filter(book=>book.id!==id));
  const addNotePage=(id:string)=>{
    const now=new Date().toISOString(),pageId=newRecordId('page');
    setNoteBooklets(prev=>prev.map(book=>book.id===id?{
      ...book,pages:[...book.pages,{id:pageId,content:'',createdAt:now,updatedAt:now}],updatedAt:now
    }:book));
    return pageId;
  };
  const updateNotePage=(bookletId:string,pageId:string,content:string)=>{
    const now=new Date().toISOString();
    setNoteBooklets(prev=>prev.map(book=>book.id===bookletId?{
      ...book,pages:book.pages.map(page=>page.id===pageId?{...page,content:content.slice(0,30000),updatedAt:now}:page),updatedAt:now
    }:book));
  };
  const deleteNotePage=(bookletId:string,pageId:string)=>{
    setNoteBooklets(prev=>prev.map(book=>{
      if(book.id!==bookletId||book.pages.length<=1)return book;
      return {...book,pages:book.pages.filter(page=>page.id!==pageId),updatedAt:new Date().toISOString()};
    }));
  };

  const addMedication = (
    medData: Omit<Medication, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>,
    schedulesData: { timeOfDay: string; daysOfWeek: number[]; dosageLabel: string }[]
  ) => {
    const medId = newRecordId('med');
    const newMed: Medication = {
      ...medData,
      id: medId,
      userId: profile.id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newSchedules: MedicationSchedule[] = schedulesData.map((s, idx) => ({
      id: `sch-${medId}-${idx}`,
      medicationId: medId,
      userId: profile.id,
      timeOfDay: s.timeOfDay,
      daysOfWeek: s.daysOfWeek,
      dosageLabel: s.dosageLabel,
    }));

    setMedications((prev) => [...prev, newMed]);
    setMedicationSchedules((prev) => [...prev, ...newSchedules]);
  };

  const replaceMedicationSchedules = (medicationId:string,times:string[],days:number[]) => {
    const unique=[...new Set(times)].sort();
    if(!medications.some(m=>m.id===medicationId&&!m.isPrn))return;
    if(!unique.length||unique.length>8||unique.length!==times.length||!unique.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||
       !days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))return;
    setMedicationSchedules(prev=>{
      const existing=prev.filter(s=>s.medicationId===medicationId);
      const kept=prev.filter(s=>s.medicationId!==medicationId);
      const labels=existing[0]?.dosageLabel||'1 dose';
      const next=unique.map(timeOfDay=>{
        const old=existing.find(s=>s.timeOfDay===timeOfDay);
        return {id:old?.id||`sch-${medicationId}-${crypto.randomUUID()}`,
          medicationId,userId:profile.id,timeOfDay,daysOfWeek:[...days].sort(),
          dosageLabel:old?.dosageLabel||labels};
      });
      return [...kept,...next];
    });
  };

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m))
    );
  };

  const deleteMedication = (id: string) => {
    // Permanent deletion is only exposed for an already-removed medication.
    // Delete all dependent private dose schedules and history so no orphaned
    // medication log entries remain in the synchronized snapshot.
    if(!medications.some(m=>m.id===id&&!m.isActive))return;
    setMedications((prev) => prev.filter((m) => m.id !== id));
    setMedicationSchedules((prev) => prev.filter((s) => s.medicationId !== id));
    setMedicationLogs((prev) => prev.filter((log) => log.medicationId !== id));
  };

  const logDose = (
    medicationId: string,
    scheduledSlotUtc: string,
    action: DoseAction,
    reason: string = ''
  ) => {
    const changed=changeDose(medicationsRef.current,medicationLogsRef.current,medicationId,scheduledSlotUtc,action,reason,profile.id);
    if(!changed)return;
    medicationsRef.current=changed.medications;medicationLogsRef.current=changed.logs;
    setMedications(changed.medications);setMedicationLogs(changed.logs);
  };

  const undoDose=(medicationId:string,scheduledSlotUtc:string)=>{
    const changed=changeDose(medicationsRef.current,medicationLogsRef.current,medicationId,scheduledSlotUtc,null,'',profile.id);
    if(!changed)return;
    medicationsRef.current=changed.medications;medicationLogsRef.current=changed.logs;
    setMedications(changed.medications);setMedicationLogs(changed.logs);
  };

  const addAccount = (input: Pick<BudgetAccount,'name'|'accountType'|'balanceCents'>) => {
    const id=crypto.randomUUID();
    const now=new Date().toISOString();
    const account:BudgetAccount={id,userId,name:input.name.trim().slice(0,80),
      accountType:input.accountType,balanceCents:input.balanceCents,
      lastConfirmedAt:now,isActive:true};
    setAccounts(prev=>[...prev,account]);
    return id;
  };

  const updateAccountBalance = (accountId: string, newBalanceCents: number) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? { ...a, balanceCents: newBalanceCents, lastConfirmedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const addTransaction = (txData: Omit<MoneyTransaction, 'id' | 'userId' | 'createdAt'>) => {
    if(!accounts.some(account=>account.id===txData.accountId&&account.isActive)||
       !Number.isSafeInteger(txData.amountCents)||txData.amountCents===0)return;
    const now=new Date().toISOString();
    const newTx: MoneyTransaction = {
      ...txData,
      id: crypto.randomUUID(),
      userId: profile.id,
      createdAt: now,
    };
    setTransactions((prev) => [newTx, ...prev]);
    setAccounts(prev=>applyAccountMovement(prev,txData.accountId,txData.amountCents,now));
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if(tx){
      setAccounts(prev=>applyAccountMovement(prev,tx.accountId,-tx.amountCents,new Date().toISOString()));
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const updatePaycheckPlan = (planUpdates: Partial<PaycheckPlan>) => {
    setPaycheckPlan((prev) => (prev ? { ...prev, ...planUpdates } : null));
  };

  const setPaycheckForecast=(details:Pick<PaycheckPlan,'expectedNetCents'|'nextPayday'|'recurringFrequency'|'confidence'>)=>{
    // A revised payday is a new cycle, which can receive its own deposit.
    if(paycheckPlan)depositedPlanIdsRef.current.delete(paycheckPlan.id);
    setPaycheckPlan(prev=>({
      id:prev?.id||crypto.randomUUID(),userId,
      expectedNetCents:details.expectedNetCents,
      nextPayday:details.nextPayday,
      recurringFrequency:details.recurringFrequency,
      confidence:details.confidence,
      // Every newly saved payday is a new forecast, not a prior deposit.
      actualNetCents:undefined,reconciledAt:undefined
    }));
  };

  const recordPaycheckDeposit=(accountId:string,amountCents:number)=>{
    if(!paycheckPlan||paycheckPlan.reconciledAt||depositedPlanIdsRef.current.has(paycheckPlan.id)||
       !Number.isSafeInteger(amountCents)||amountCents<=0||
       !accounts.some(a=>a.id===accountId&&a.isActive))return false;
    depositedPlanIdsRef.current.add(paycheckPlan.id);
    addTransaction({
      accountId,amountCents,transactionType:'income',category:'wages',
      transactionDate:[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'),notes:'Paycheck deposit',
      isPending:false
    });
    setPaycheckPlan(prev=>prev?{...prev,actualNetCents:amountCents,reconciledAt:new Date().toISOString()}:null);
    setAdvances(prev=>prev.map(a=>!a.isReconciled&&(!a.paycheckPlanId||a.paycheckPlanId===paycheckPlan.id)
      ?{...a,isReconciled:true,updatedAt:new Date().toISOString()}:a));
    return true;
  };

  const addAdvance = (advData: Omit<WageAdvance, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,depositAccountId:string) => {
    if(!accounts.some(a=>a.id===depositAccountId&&a.isActive))return;
    const newAdv: WageAdvance = {
      ...advData,
      id: newRecordId('adv'),
      userId: profile.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAdvances((prev) => [newAdv, ...prev]);

    // Record the actual advance receipt in the explicitly chosen account.
    // This is cash received now, not a second paycheck.
    addTransaction({
        accountId: depositAccountId,
        amountCents: advData.advanceAmountCents,
        transactionType: 'income',
        category: 'wage_advance',
        transactionDate: advData.receivedDate,
        notes: `Wage advance received (${advData.notes || 'early payout'})`,
        isPending: false,
      });
  };

  const markBillPaid = (billId: string, createTransaction: boolean = true, accountId?: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill || bill.isPaid || paidBillIdsRef.current.has(billId)) return;
    if(createTransaction && !accounts.some(a=>a.id===accountId && a.isActive))return;
    paidBillIdsRef.current.add(billId);
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? {
              ...b,
              isPaid: true,
              lastPaidAt: new Date().toISOString(),
            }
          : b
      )
    );

    if (createTransaction && accountId) {
      addTransaction({
        accountId,
        amountCents: -bill.amountCents,
        transactionType: 'expense',
        category: bill.category,
        transactionDate: new Date().toISOString().split('T')[0],
        notes: `Paid: ${bill.title}`,
        isPending: false,
      });
    }
  };

  const addBill = (billData: Omit<Bill, 'id' | 'userId' | 'isPaid' | 'lastPaidAt' | 'createdAt' | 'updatedAt'>) => {
    const newBill: Bill = {
      ...billData,
      id: newRecordId('bill'),
      userId: profile.id,
      isPaid: false,
    };
    setBills((prev) => [...prev, newBill]);
  };

  const addReserve=(input:Pick<BudgetReserve,'name'|'category'|'targetCents'|'allocatedCents'|'isEssential'>)=>{
    const now=new Date().toISOString();
    setReserves(prev=>[...prev,{...input,name:input.name.trim().slice(0,80),id:crypto.randomUUID(),userId,
      createdAt:now,updatedAt:now}]);
  };
  const deleteReserve=(reserveId:string)=>setReserves(prev=>prev.filter(r=>r.id!==reserveId));

  const updateReserve = (reserveId: string, allocatedCents: number) => {
    setReserves((prev) =>
      prev.map((r) => (r.id === reserveId ? { ...r, allocatedCents } : r))
    );
  };

  const addContact = (contactData: Omit<ResourceContact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const newContact: ResourceContact = {
      ...contactData,
      id: newRecordId('con'),
      userId: profile.id,
      isEmergency: contactData.isEmergency || false,
    };
    setContacts((prev) => [...prev, newContact]);
  };

  const deleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const resetToDefaults=()=>{
    paidBillIdsRef.current.clear();
    depositedPlanIdsRef.current.clear();
    setSavedPlaces([]);
    setProfile({...DEFAULT_PROFILE,id:userId});setEvents([]);setEventOccurrences([]);setTasks([]);setNoteBooklets([]);
    setMedications([]);setMedicationSchedules([]);setMedicationLogs([]);setAccounts([]);
    setTransactions([]);setPaycheckPlan(null);setAdvances([]);setBills([]);setReserves([]);setContacts([]);
  };
  const clearAllUserData=()=>resetToDefaults();
  if(!isLoaded)return <main role="status" className="min-h-screen flex items-center justify-center bg-slate-50 p-5 text-slate-800">{syncStatus==='offline'?'Cannot securely load cloud records. Check your connection and reload.':'Loading your private records…'}</main>;

  return (
    <DayBridgeContext.Provider
      value={{
        profile,
        savedPlaces,
        addSavedPlace,
        updateSavedPlace,
        deleteSavedPlace,
        events,
        eventOccurrences,
        tasks,
        noteBooklets,
        addNoteBooklet,
        updateNoteBooklet,
        deleteNoteBooklet,
        addNotePage,
        updateNotePage,
        deleteNotePage,
        medications,
        medicationSchedules,
        medicationLogs,
        accounts,
        transactions,
        paycheckPlan,
        advances,
        bills,
        reserves,
        contacts,
        canUndo:undoStackRef.current.length>0,
        canRedo:redoStackRef.current.length>0,
        undoChange,
        redoChange,
        syncStatus,
        syncIssue,
        retrySync,
        prepareSignOut,
        syncConflict,
        resolveSyncConflict,
        isLiveSupabase: isLive,

        updateProfile,
        addEvent,
        updateEvent,
        deleteEvent,
        setCheckInDone,
        recordAttendance,

        addTask,
        updateTask,
        toggleTask,
        deleteTask,

        addMedication,
        updateMedication,
        replaceMedicationSchedules,
        deleteMedication,
        logDose,
        undoDose,

        addAccount,
        updateAccountBalance,
        addTransaction,
        deleteTransaction,
        updatePaycheckPlan,
        setPaycheckForecast,
        recordPaycheckDeposit,
        addAdvance,
        markBillPaid,
        addBill,
        addReserve,
        deleteReserve,
        updateReserve,

        addContact,
        deleteContact,

        resetToDefaults,
        clearAllUserData,
      }}
    >
      {children}
    </DayBridgeContext.Provider>
  );
};

export function useDayBridge() {
  const context = useContext(DayBridgeContext);
  if (!context) {
    throw new Error('useDayBridge must be used within a DayBridgeProvider');
  }
  return context;
}
