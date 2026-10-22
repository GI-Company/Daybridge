'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
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

  const isLive = isSupabaseConfigured();

  // RLS-protected cloud storage. No plaintext offline personal cache.
  useEffect(()=>{
    let active=true;const client=createClient();
    if(!client){setSyncStatus('offline');return;}
    client.from('private_snapshots').select('payload').eq('user_id',userId).maybeSingle().then(({data,error})=>{
      if(!active)return;
      if(error){setSyncStatus('offline');return;}
      const saved=data?.payload as Record<string,unknown>|undefined;
      if(saved){
        if(saved.profile&&typeof saved.profile==='object')setProfile({...DEFAULT_PROFILE,...(saved.profile as Partial<UserProfile>),id:userId});
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
    const client=createClient();if(!client)return;
    const payload={profile,events,eventOccurrences,tasks,medications,medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,advances,bills,reserves,contacts};
    const timer=window.setTimeout(async()=>{
      setSyncStatus('syncing');
      const {error}=await client.from('private_snapshots').upsert({user_id:userId,payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      setSyncStatus(error?'offline':'synced');
    },900);
    return()=>window.clearTimeout(timer);
  },[isLoaded,userId,profile,events,eventOccurrences,tasks,medications,medicationSchedules,medicationLogs,accounts,transactions,paycheckPlan,advances,bills,reserves,contacts]);
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
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
    );
  };

  const deleteEvent = (id: string) => {
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
    setMedicationLogs((prev) => {
      // Enforce slot uniqueness: remove any previous log for this exact slot
      const filtered = prev.filter(
        (l) => !(l.medicationId === medicationId && l.scheduledSlotUtc === scheduledSlotUtc)
      );
      const newLog: MedicationLog = {
        id: `log-${Date.now()}`,
        userId: profile.id,
        medicationId,
        scheduledSlotUtc,
        action,
        recordedAtUtc: new Date().toISOString(),
        skipReason: reason,
      };

      // If taken and medication has inventory count, decrement count
      if (action === 'taken') {
        setMedications((mList) =>
          mList.map((m) => {
            if (m.id === medicationId && typeof m.inventoryCount === 'number') {
              return { ...m, inventoryCount: Math.max(0, m.inventoryCount - 1) };
            }
            return m;
          })
        );
      }

      return [...filtered, newLog];
    });
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
