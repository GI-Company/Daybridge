'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  UserProfile,
  SavedPlace,
  CalendarEvent,
  EventOccurrence,
  TaskItem,
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
import {readDeviceSnapshot,writeDeviceSnapshot,requestDurableStorage,type DeviceSnapshot} from './device-cache';
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
  syncStatus: 'synced' | 'device_saved' | 'local_only' | 'syncing' | 'offline';
  syncIssue: string | null;
  retrySync: () => void;
  isLiveSupabase: boolean;

  // Actions
  updateProfile: (profile: Partial<UserProfile>) => void;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => CalendarEvent;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  recordAttendance: (
    occurrenceId: string,
    eventId: string,
    status: AttendanceStatus,
    note?: string
  ) => void;

  addTask: (task: Omit<TaskItem, 'id' | 'userId' | 'completed' | 'createdAt' | 'updatedAt'>) => TaskItem;
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

const DayBridgeContext = createContext<DayBridgeContextType | null>(null);

export const DayBridgeProvider: React.FC<{ children: React.ReactNode; userId: string }> = ({ children, userId }) => {
  const [profile, setProfile] = useState<UserProfile>({...DEFAULT_PROFILE,id:userId});
  const [savedPlaces,setSavedPlaces]=useState<SavedPlace[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventOccurrences, setEventOccurrences] = useState<EventOccurrence[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationSchedule[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [paycheckPlan, setPaycheckPlan] = useState<PaycheckPlan | null>(null);
  const [advances, setAdvances] = useState<WageAdvance[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [reserves, setReserves] = useState<BudgetReserve[]>([]);
  const [contacts, setContacts] = useState<ResourceContact[]>([]);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'device_saved' | 'local_only' | 'syncing' | 'offline'>('local_only');
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncIssue,setSyncIssue]=useState<string|null>(null);
  const revisionRef=useRef(0);
  const hydratedRef=useRef(false);
  const savedFingerprintRef=useRef('');
  const pendingRef=useRef<{payload:Record<string,unknown>;fingerprint:string}|null>(null);
  const unknownFieldsRef=useRef<Record<string,unknown>>({});
  const savingRef=useRef(false);
  const conflictRef=useRef(false);
  const localFailedRef=useRef(false);
  const deviceWritingRef=useRef(false);
  const volatileEditRef=useRef(false);
  const latestStagedFingerprintRef=useRef('');
  const paidBillIdsRef=useRef(new Set<string>());
  const depositedPlanIdsRef=useRef(new Set<string>());
  const deviceWriteChain=useRef<Promise<void>>(Promise.resolve());
  const saveTimerRef=useRef<number|null>(null);
  const aliveRef=useRef(true);

  // A per-user, encrypted IndexedDB write-ahead copy. Serialize device writes,
  // so a slow previous encryption cannot overwrite a newer local edit.
  const saveOnDevice=useCallback((data:DeviceSnapshot)=>{
    deviceWritingRef.current=true;
    const next=deviceWriteChain.current.catch(()=>undefined).then(()=>writeDeviceSnapshot(userId,data));
    deviceWriteChain.current=next;
    void next.then(()=>{
      localFailedRef.current=false;
      if(latestStagedFingerprintRef.current===JSON.stringify(data.payload))volatileEditRef.current=false;
      if(aliveRef.current&&pendingRef.current&&pendingRef.current.fingerprint===JSON.stringify(data.payload)){
        setSyncStatus(navigator.onLine?'syncing':'device_saved');
      }
    }).catch(()=>{
      localFailedRef.current=true;
      if(aliveRef.current){
        setSyncStatus('offline');
        setSyncIssue('Device storage failed (possibly full or blocked). Keep the app open, free storage, and retry saving. Cloud sync is paused until device storage succeeds.');
      }
    }).finally(()=>{if(deviceWriteChain.current===next)deviceWritingRef.current=false;});
    return next;
  },[userId]);

  // Never write to Supabase until the local encrypted copy is safely committed.
  // The revision-checked RPC prevents overwriting newer edits from other devices.
  const flushSnapshot=useCallback(async()=>{
    if(savingRef.current||conflictRef.current||!pendingRef.current)return;
    const client=createClient();
    if(!client||!navigator.onLine){
      if(aliveRef.current&&!localFailedRef.current)setSyncStatus('device_saved');
      return;
    }
    savingRef.current=true;
    let failed=false;
    try{
      while(pendingRef.current&&!conflictRef.current){
        try{await deviceWriteChain.current;}catch{
          failed=true;break;
        }
        if(localFailedRef.current){failed=true;break}
        const item=pendingRef.current;
        pendingRef.current=null;
        let result:{data:unknown;error:{message:string}|null};
        try{
          result=await client.rpc('save_private_snapshot',{
            p_payload:item.payload,p_expected_revision:revisionRef.current
          });
        }catch{result={data:null,error:{message:'Network error'}};}
        const nextRev=Number(result.data);
        if(result.error||!Number.isSafeInteger(nextRev)||nextRev<0){
          failed=true;
          if(!pendingRef.current)pendingRef.current=item;
          const conflict=String(result.error?.message??'').includes('snapshot_conflict');
          if(conflict)conflictRef.current=true;
          if(aliveRef.current){
            setSyncIssue(conflict
             ? 'Another device has newer cloud changes. This device has preserved your unsynced records. Export them from Settings before resolving the conflict.'
             : 'Your changes are saved on this device; Supabase is unavailable. Sync will retry when the connection returns.');
            setSyncStatus('device_saved');
          }
          break;
        }
        revisionRef.current=nextRev;
        savedFingerprintRef.current=item.fingerprint;
        // Keep a clean local copy, unless a newer local edit is already staged.
        // Re-read after the network await: an edit may have been staged in the meantime.
        // A getter avoids TypeScript treating the earlier ref reset as permanently null.
        // Durable writes are ordered after all previous writes.
        const latestPending=()=>pendingRef.current;
        const staged=latestPending();
        try{
          await saveOnDevice({
            payload:staged?.payload??item.payload,
            dirty:Boolean(staged),
            revision:nextRev,updatedAt:Date.now()
          });
        }catch{failed=true;break}
      }
    }finally{
      savingRef.current=false;
      if(aliveRef.current&&!failed&&!pendingRef.current&&!localFailedRef.current){
        setSyncIssue(null);
        setSyncStatus('synced');
      }
    }
  },[saveOnDevice]);

  const retrySync=useCallback(()=>{
    if(conflictRef.current)return;
    if(saveTimerRef.current){clearTimeout(saveTimerRef.current);saveTimerRef.current=null;}
    if(pendingRef.current){
      if(localFailedRef.current){
        const item=pendingRef.current;
        void saveOnDevice({payload:item.payload,dirty:true,revision:revisionRef.current,updatedAt:Date.now()})
          .then(()=>void flushSnapshot()).catch(()=>undefined);
      }else void flushSnapshot();
    }
  },[flushSnapshot,saveOnDevice]);

  useEffect(()=>{
    aliveRef.current=true;
    return()=>{
      aliveRef.current=false;
      if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    };
  },[]);
  useEffect(()=>{
    const onRetry=()=>retrySync();
    const onVisibility=()=>{if(document.visibilityState==='visible')retrySync();};
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      if(volatileEditRef.current||deviceWritingRef.current||localFailedRef.current||conflictRef.current){
        event.preventDefault();event.returnValue='';
      }
    };
    const interval=window.setInterval(()=>retrySync(),30000);
    window.addEventListener('daybridge:save-now',onRetry);
    window.addEventListener('online',onRetry);
    window.addEventListener('focus',onRetry);
    window.addEventListener('beforeunload',onBeforeUnload);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener('daybridge:save-now',onRetry);
      window.removeEventListener('online',onRetry);
      window.removeEventListener('focus',onRetry);
      window.removeEventListener('beforeunload',onBeforeUnload);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[retrySync]);

  const isLive=isSupabaseConfigured();
  useEffect(()=>{
    window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:syncStatus}));
    return()=>{window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:null}));};
  },[syncStatus]);

  // Restore durable local edits BEFORE accepting server data. Never load an
  // empty default account when both cloud and cache are unavailable.
  useEffect(()=>{
    let active=true;
    const keys=['profile','savedPlaces','events','eventOccurrences','tasks',
      'medications','medicationSchedules','medicationLogs','accounts',
      'transactions','paycheckPlan','advances','bills','reserves','contacts'];
    const hydrate=(saved:Record<string,unknown>)=>{
      unknownFieldsRef.current=Object.fromEntries(Object.entries(saved).filter(([k])=>!keys.includes(k)));
      if(saved.profile&&typeof saved.profile==='object')setProfile({...DEFAULT_PROFILE,...(saved.profile as Partial<UserProfile>),id:userId});
      if(Array.isArray(saved.savedPlaces))setSavedPlaces(saved.savedPlaces as SavedPlace[]);
      if(Array.isArray(saved.events))setEvents(saved.events as CalendarEvent[]);
      if(Array.isArray(saved.eventOccurrences))setEventOccurrences(saved.eventOccurrences as EventOccurrence[]);
      if(Array.isArray(saved.tasks))setTasks(saved.tasks as TaskItem[]);
      if(Array.isArray(saved.medications))setMedications(saved.medications as Medication[]);
      if(Array.isArray(saved.medicationSchedules))setMedicationSchedules(saved.medicationSchedules as MedicationSchedule[]);
      if(Array.isArray(saved.medicationLogs))setMedicationLogs(saved.medicationLogs as MedicationLog[]);
      if(Array.isArray(saved.accounts))setAccounts(saved.accounts as BudgetAccount[]);
      if(Array.isArray(saved.transactions))setTransactions(saved.transactions as MoneyTransaction[]);
      if(saved.paycheckPlan)setPaycheckPlan(saved.paycheckPlan as PaycheckPlan);
      if(Array.isArray(saved.advances))setAdvances(saved.advances as WageAdvance[]);
      if(Array.isArray(saved.bills))setBills(saved.bills as Bill[]);
      if(Array.isArray(saved.reserves))setReserves(saved.reserves as BudgetReserve[]);
      if(Array.isArray(saved.contacts))setContacts(saved.contacts as ResourceContact[]);
    };
    const load=async()=>{
      let device:DeviceSnapshot|null=null;
      let deviceError=false;
      try{device=await readDeviceSnapshot(userId);}
      catch{deviceError=true;localFailedRef.current=true;}
      if(!active)return;
      const client=createClient();
      let remote:{payload:Record<string,unknown>;revision:number}|null=null;
      let online=false;
      if(client&&navigator.onLine){
        try{
          const query=client.from('private_snapshots').select('payload,revision')
            .eq('user_id',userId).maybeSingle();
          const response=await Promise.race([
            query,
            new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Cloud read timed out')),9000))
          ]);
          if(!response.error){
            const row=response.data as {payload:Record<string,unknown>;revision:number}|null;
            remote=row?{payload:row.payload,revision:row.revision}:null;
            online=true;
          }
        }catch{/* Local copy can still be opened without network. */}
      }
      if(!active)return;
      if(deviceError){
        setSyncStatus('offline');
        setSyncIssue('The encrypted device cache cannot be opened. It was not cleared. Recover storage access before editing; use cloud recovery backups if necessary.');
        return;
      }
      if(device?.dirty){
        // Local unsynced changes take precedence; never wipe them with a cloud read.
        revisionRef.current=device.revision;
        hydrate(device.payload);
        pendingRef.current={payload:device.payload,fingerprint:JSON.stringify(device.payload)};
        if(online&&remote&&remote.revision!==device.revision){
          conflictRef.current=true;
          setSyncIssue('Another device changed these records. Local changes are safe on this device but were not merged. Export before resolving the conflict.');
        }else if(!online){
          setSyncIssue('Your changes were restored from this device. Cloud synchronization will resume when available.');
        }
        setSyncStatus('device_saved');
        setIsLoaded(true);
        if(online&&!conflictRef.current)window.setTimeout(()=>void flushSnapshot(),0);
        return;
      }
      if(online){
        const payload=remote?.payload??(device?.payload??{});
        const revision=remote?.revision??(device?.revision??0);
        revisionRef.current=revision;
        hydrate(payload);
        try{
          await saveOnDevice({payload,revision,dirty:false,updatedAt:Date.now()});
        }catch{
          setSyncIssue('Cloud records loaded, but encrypted device storage is unavailable. Offline edits are not protected.');
        }
        if(!active)return;
        setSyncStatus(localFailedRef.current?'offline':'synced');
        setIsLoaded(true);
        void requestDurableStorage();
        return;
      }
      if(device){
        revisionRef.current=device.revision;
        hydrate(device.payload);
        setSyncStatus('device_saved');
        setSyncIssue('Showing encrypted records saved on this device. Cloud synchronization is offline.');
        setIsLoaded(true);
        return;
      }
      setSyncIssue('No cloud connection or encrypted device backup is available. Reconnect to load records safely.');
      setSyncStatus('offline');
    };
    void load();
    return()=>{active=false};
  },[userId,flushSnapshot,saveOnDevice]);

  useEffect(()=>{
    if(!isLoaded)return;
    const payload:Record<string,unknown>={...unknownFieldsRef.current,
      profile,savedPlaces,events,eventOccurrences,tasks,medications,
      medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,
      advances,bills,reserves,contacts};
    const fingerprint=JSON.stringify(payload);
    if(!hydratedRef.current){
      hydratedRef.current=true;
      // Initial load is never a user edit. Only restored dirty state is synced.
      savedFingerprintRef.current=fingerprint;
      return;
    }
    if(fingerprint===savedFingerprintRef.current&&!pendingRef.current)return;
    pendingRef.current={payload,fingerprint};
    latestStagedFingerprintRef.current=fingerprint;
    volatileEditRef.current=true;
    setSyncStatus('syncing');
    // Encrypt and durably stage before attempting any network update.
    void saveOnDevice({payload,revision:revisionRef.current,dirty:true,updatedAt:Date.now()})
      .then(()=>{
        if(aliveRef.current&&!navigator.onLine)setSyncStatus('device_saved');
      }).catch(()=>undefined);
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=window.setTimeout(()=>{
      saveTimerRef.current=null;
      void flushSnapshot();
    },900);
    return()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[isLoaded,profile,savedPlaces,events,eventOccurrences,tasks,medications,
    medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,
    advances,bills,reserves,contacts,flushSnapshot,saveOnDevice]);

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
    const id = `evt-${Date.now()}`;
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
      const backend=createClient();
      void backend?.from('travel_appointments').update({enabled:false,cancelled:true}).eq('source_event_id',id);
    }
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
    );
  };

  const deleteEvent = (id: string) => {
    const backend=createClient();
    void backend?.from('travel_appointments').update({enabled:false,cancelled:true}).eq('source_event_id',id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEventOccurrences((prev) => prev.filter((o) => o.eventId !== id));
  };

  const recordAttendance = (
    occurrenceId: string,
    eventId: string,
    status: AttendanceStatus,
    note: string = ''
  ) => {
    setEventOccurrences((prev) => {
      const existing = prev.find((o) => o.id === occurrenceId || o.eventId === eventId);
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
          id: occurrenceId || `occ-${Date.now()}`,
          eventId,
          userId: profile.id,
          startTimeUtc: new Date().toISOString(),
          endTimeUtc: new Date().toISOString(),
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
      id: `tsk-${Date.now()}`,
      userId: profile.id,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
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

  const addMedication = (
    medData: Omit<Medication, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>,
    schedulesData: { timeOfDay: string; daysOfWeek: number[]; dosageLabel: string }[]
  ) => {
    const medId = `med-${Date.now()}`;
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
    // Update inventory only when the slot changes between taken/not taken.
    // Keeping the inventory adjustment outside a state updater avoids duplicated
    // side effects when React replays state updates during development.
    const previous=medicationLogs.find(l=>l.medicationId===medicationId&&l.scheduledSlotUtc===scheduledSlotUtc);
    const wasTaken=previous?.action==='taken';
    const willBeTaken=action==='taken';
    if(wasTaken!==willBeTaken){
      const delta=willBeTaken?-1:1;
      setMedications(prev=>prev.map(m=>m.id===medicationId&&typeof m.inventoryCount==='number'
        ? {...m,inventoryCount:Math.max(0,m.inventoryCount+delta)}
        :m));
    }
    const newLog:MedicationLog={
      id:crypto.randomUUID(),userId:profile.id,medicationId,scheduledSlotUtc,action,
      recordedAtUtc:new Date().toISOString(),skipReason:reason,
    };
    setMedicationLogs(prev=>[...prev.filter(l=>!(l.medicationId===medicationId&&l.scheduledSlotUtc===scheduledSlotUtc)),newLog]);
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
      id: `adv-${Date.now()}`,
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
      id: `bill-${Date.now()}`,
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
      id: `con-${Date.now()}`,
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
    setProfile({...DEFAULT_PROFILE,id:userId});setEvents([]);setEventOccurrences([]);setTasks([]);
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
        syncStatus,
        syncIssue,
        retrySync,
        isLiveSupabase: isLive,

        updateProfile,
        addEvent,
        updateEvent,
        deleteEvent,
        recordAttendance,

        addTask,
        toggleTask,
        deleteTask,

        addMedication,
        updateMedication,
        replaceMedicationSchedules,
        deleteMedication,
        logDose,

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
