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
  syncStatus: 'synced' | 'local_only' | 'syncing' | 'offline';
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

  updateAccountBalance: (accountId: string, newBalanceCents: number) => void;
  addTransaction: (tx: Omit<MoneyTransaction, 'id' | 'userId' | 'createdAt'>) => void;
  deleteTransaction: (id: string) => void;
  updatePaycheckPlan: (plan: Partial<PaycheckPlan>) => void;
  addAdvance: (advance: Omit<WageAdvance, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  markBillPaid: (billId: string, createTransaction?: boolean) => void;
  addBill: (bill: Omit<Bill, 'id' | 'userId' | 'isPaid' | 'lastPaidAt' | 'createdAt' | 'updatedAt'>) => void;
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

  const [syncStatus, setSyncStatus] = useState<'synced' | 'local_only' | 'syncing' | 'offline'>('local_only');
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string|null>(null);
  const revisionRef = useRef(0);
  const hydratedRef = useRef(false);
  const savedFingerprintRef = useRef('');
  const pendingRef = useRef<{payload:Record<string,unknown>;fingerprint:string}|null>(null);
  const unknownFieldsRef = useRef<Record<string,unknown>>({});
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const aliveRef = useRef(true);

  // Only the latest snapshot can be written, and requests are serialized.
  // The Postgres RPC atomically rejects a save based on a stale revision.
  const flushSnapshot = useCallback(async () => {
    if(savingRef.current || conflictRef.current || !pendingRef.current)return;
    const client=createClient();
    if(!client){setSyncStatus('offline');setSyncIssue('Cloud storage is unavailable. Do not close this tab or update.');return;}
    savingRef.current=true;
    let failed=false;
    try{
      while(pendingRef.current && !conflictRef.current){
        const item=pendingRef.current;
        pendingRef.current=null;
        let result: {data:unknown;error:{message:string}|null};
        try{
          result=await client.rpc('save_private_snapshot',{
            p_payload:item.payload,p_expected_revision:revisionRef.current
          });
        }catch{
          result={data:null,error:{message:'Network connection failed'}};
        }
        if(result.error || !Number.isSafeInteger(Number(result.data))){
          // Keep the most recent unsaved data in memory. Never claim success
          // and never silently overwrite data saved by another device.
          if(!pendingRef.current)pendingRef.current=item;
          failed=true;
          const isConflict=String(result.error?.message??'').includes('snapshot_conflict');
          if(isConflict)conflictRef.current=true;
          if(aliveRef.current){
            setSyncIssue(isConflict
              ? 'Another device has saved a newer version. Your edits are still on this screen. Export them from Settings before refreshing; do not overwrite the other device.'
              : 'Unable to save to Supabase. Keep this app open; check your connection and use Retry save.');
            setSyncStatus('offline');
          }
          break;
        }
        revisionRef.current=Number(result.data);
        savedFingerprintRef.current=item.fingerprint;
      }
    }finally{
      savingRef.current=false;
      if(aliveRef.current && !failed && !pendingRef.current){
        setSyncIssue(null);
        setSyncStatus('synced');
      }
    }
  },[]);

  const retrySync = useCallback(() => {
    if(conflictRef.current)return;
    if(saveTimerRef.current){clearTimeout(saveTimerRef.current);saveTimerRef.current=null;}
    if(pendingRef.current){
      setSyncStatus('syncing');
      void flushSnapshot();
    }
  },[flushSnapshot]);

  useEffect(()=>{
    aliveRef.current=true;
    return()=>{
      aliveRef.current=false;
      if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    };
  },[]);
  useEffect(()=>{
    const onRetry=()=>retrySync();
    const onOnline=()=>retrySync();
    const onVisibility=()=>{if(document.visibilityState==='hidden')retrySync();};
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      if(pendingRef.current || savingRef.current || conflictRef.current){
        event.preventDefault();
        event.returnValue='';
      }
    };
    window.addEventListener('daybridge:save-now',onRetry);
    window.addEventListener('online',onOnline);
    window.addEventListener('beforeunload',onBeforeUnload);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{
      window.removeEventListener('daybridge:save-now',onRetry);
      window.removeEventListener('online',onOnline);
      window.removeEventListener('beforeunload',onBeforeUnload);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[retrySync]);


  const isLive = isSupabaseConfigured();

  // The PWA update banner listens for cloud sync state before offering a reload.
  // No private record content is exposed in this browser event.
  useEffect(()=>{
    window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:syncStatus}));
    return()=>{window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:null}));};
  },[syncStatus]);

  // RLS-protected cloud storage. No plaintext offline personal cache.
  useEffect(()=>{
    let active=true;const client=createClient();
    if(!client){setSyncStatus('offline');return;}
    client.from('private_snapshots').select('payload,revision').eq('user_id',userId).maybeSingle().then(({data,error}: {data:{payload:unknown;revision:number}|null;error:unknown})=>{
      if(!active)return;
      if(error){setSyncStatus('offline');return;}
      revisionRef.current=data?.revision??0;
      const saved=data?.payload as Record<string,unknown>|undefined;
      if(saved){const known=new Set(['profile','savedPlaces','events','eventOccurrences','tasks','medications','medicationSchedules','medicationLogs','accounts','transactions','paycheckPlan','advances','bills','reserves','contacts']);unknownFieldsRef.current=Object.fromEntries(Object.entries(saved).filter(([key])=>!known.has(key)));}
      if(saved){
        if(saved.profile&&typeof saved.profile==='object')setProfile({...DEFAULT_PROFILE,...(saved.profile as Partial<UserProfile>),id:userId});
        if(Array.isArray(saved.savedPlaces))setSavedPlaces(saved.savedPlaces as SavedPlace[]);
        if(Array.isArray(saved.events))setEvents(saved.events);
        if(Array.isArray(saved.eventOccurrences))setEventOccurrences(saved.eventOccurrences);
        if(Array.isArray(saved.tasks))setTasks(saved.tasks);
        if(Array.isArray(saved.medications))setMedications(saved.medications);
        if(Array.isArray(saved.medicationSchedules))setMedicationSchedules(saved.medicationSchedules);
        if(Array.isArray(saved.medicationLogs))setMedicationLogs(saved.medicationLogs);
        if(Array.isArray(saved.accounts))setAccounts(saved.accounts);
        if(Array.isArray(saved.transactions))setTransactions(saved.transactions);
        if(saved.paycheckPlan)setPaycheckPlan(saved.paycheckPlan as PaycheckPlan);
        if(Array.isArray(saved.advances))setAdvances(saved.advances);
        if(Array.isArray(saved.bills))setBills(saved.bills);
        if(Array.isArray(saved.reserves))setReserves(saved.reserves);
        if(Array.isArray(saved.contacts))setContacts(saved.contacts);
      }
      setSyncStatus('synced');setIsLoaded(true);
    });
    return()=>{active=false};
  },[userId]);
  useEffect(()=>{
    if(!isLoaded)return;
    // Retain unrecognized fields from newer releases instead of dropping them
    // when an older tab saves a known property.
    const payload:Record<string,unknown>={...unknownFieldsRef.current,
      profile,savedPlaces,events,eventOccurrences,tasks,medications,
      medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,
      advances,bills,reserves,contacts};
    const fingerprint=JSON.stringify(payload);
    if(!hydratedRef.current){
      // Reading records is not a change. An update must never overwrite the
      // loaded snapshot just because the application mounted.
      hydratedRef.current=true;
      savedFingerprintRef.current=fingerprint;
      return;
    }
    if(fingerprint===savedFingerprintRef.current && !pendingRef.current)return;
    pendingRef.current={payload,fingerprint};
    setSyncStatus('syncing'); // Debounce is UNSAVED time, not 'synced' time.
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=window.setTimeout(()=>{
      saveTimerRef.current=null;
      void flushSnapshot();
    },850);
    return()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[isLoaded,profile,savedPlaces,events,eventOccurrences,tasks,medications,
    medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,
    advances,bills,reserves,contacts,flushSnapshot]);
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
    setMedications((prev) => prev.filter((m) => m.id !== id));
    setMedicationSchedules((prev) => prev.filter((s) => s.medicationId !== id));
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
    const newTx: MoneyTransaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      userId: profile.id,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Automatically update the account balance
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === txData.accountId) {
          return {
            ...a,
            balanceCents: a.balanceCents + txData.amountCents,
            lastConfirmedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      // Reverse balance effect
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === tx.accountId) {
            return {
              ...a,
              balanceCents: a.balanceCents - tx.amountCents,
              lastConfirmedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const updatePaycheckPlan = (planUpdates: Partial<PaycheckPlan>) => {
    setPaycheckPlan((prev) => (prev ? { ...prev, ...planUpdates } : null));
  };

  const addAdvance = (advData: Omit<WageAdvance, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const newAdv: WageAdvance = {
      ...advData,
      id: `adv-${Date.now()}`,
      userId: profile.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAdvances((prev) => [newAdv, ...prev]);

    // An advance gives immediate cash, so add to checking account if an account exists
    if (accounts.length > 0) {
      const primaryAcc = accounts[0];
      addTransaction({
        accountId: primaryAcc.id,
        amountCents: advData.advanceAmountCents,
        transactionType: 'income',
        category: 'wage_advance',
        transactionDate: advData.receivedDate,
        notes: `Wage advance received (${advData.notes || 'early payout'})`,
        isPending: false,
      });
    }
  };

  const markBillPaid = (billId: string, createTransaction: boolean = true) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

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

    if (createTransaction && accounts.length > 0) {
      addTransaction({
        accountId: accounts[0].id,
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

        updateAccountBalance,
        addTransaction,
        deleteTransaction,
        updatePaycheckPlan,
        addAdvance,
        markBillPaid,
        addBill,
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
