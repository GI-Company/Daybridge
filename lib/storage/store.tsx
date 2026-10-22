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
  id: 'usr-default-owner',
  fullName: 'Jordan Miller',
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

// Initial Events
const today = new Date();
const todayIso = today.toISOString().split('T')[0];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-court-1',
    userId: 'usr-default-owner',
    title: 'Accountability Court Class',
    category: 'court',
    description: 'Weekly accountability review and life skills group session.',
    startTime: `${todayIso}T10:00:00`,
    endTime: `${todayIso}T11:30:00`,
    timezone: 'America/New_York',
    venueType: 'in_person',
    location: 'Community Justice Center, Rm 204',
    contactInfo: 'Officer Martinez: (555) 234-5678',
    rrule: 'FREQ=WEEKLY;BYDAY=WE',
    travelBufferMinutes: 30,
    prepChecklist: [
      { id: 'chk-1', text: 'Bring identification and notebook', completed: true },
      { id: 'chk-2', text: 'Have weekly self-reported activity sheet ready', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'evt-work-1',
    userId: 'usr-default-owner',
    title: 'Warehouse Operations Shift',
    category: 'work',
    description: 'Afternoon fulfillment floor shift.',
    startTime: `${todayIso}T14:00:00`,
    endTime: `${todayIso}T20:00:00`,
    timezone: 'America/New_York',
    venueType: 'in_person',
    location: 'Metro Distribution Hub, Bay 4',
    travelBufferMinutes: 20,
    prepChecklist: [
      { id: 'chk-3', text: 'Work badge & steel-toe boots', completed: true },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'evt-therapy-1',
    userId: 'usr-default-owner',
    title: 'Individual Counseling Session',
    category: 'therapy',
    description: 'Bi-weekly cognitive behavioral session.',
    startTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T11:00:00',
    endTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T12:00:00',
    timezone: 'America/New_York',
    venueType: 'virtual',
    meetingUrl: 'https://telehealth.provider.org/room/jordan-m',
    travelBufferMinutes: 10,
    prepChecklist: [
      { id: 'chk-4', text: 'Quiet space & headphones checked', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'tsk-1',
    userId: 'usr-default-owner',
    title: 'Print weekly self-reported log for review',
    priority: 'urgent',
    dueDate: `${todayIso}T09:00:00`,
    completed: false,
    linkedEventId: 'evt-court-1',
    isRecurring: false,
    subtasks: [
      { id: 'st-1', title: 'Export from DayBridge Review tab', completed: false },
      { id: 'st-2', title: 'Put in presentation folder', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tsk-2',
    userId: 'usr-default-owner',
    title: 'Pick up medication refill at pharmacy',
    priority: 'high',
    dueDate: `${todayIso}T17:30:00`,
    completed: false,
    isRecurring: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tsk-3',
    userId: 'usr-default-owner',
    title: 'Recharge monthly bus transit card',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T12:00:00',
    completed: false,
    isRecurring: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    userId: 'usr-default-owner',
    name: 'Sertraline',
    strengthText: '50 mg',
    instructions: 'Take 1 tablet daily in the morning with water.',
    prescribingClinician: 'Dr. Evans (Northside Wellness)',
    pharmacyInfo: 'CVS Pharmacy #4120 - (555) 789-0123',
    isPrn: false,
    inventoryCount: 14,
    refillThreshold: 7,
    refillDueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    notes: 'Prescription #98234-A',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'med-2',
    userId: 'usr-default-owner',
    name: 'Lisinopril',
    strengthText: '10 mg',
    instructions: 'Take 1 tablet daily at bedtime for blood pressure.',
    prescribingClinician: 'Dr. Rivera (Community Clinic)',
    pharmacyInfo: 'CVS Pharmacy #4120',
    isPrn: false,
    inventoryCount: 22,
    refillThreshold: 7,
    notes: 'Blood pressure maintenance',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'med-3',
    userId: 'usr-default-owner',
    name: 'Ibuprofen',
    strengthText: '400 mg',
    instructions: 'Take 1 tablet as needed for tension headache or muscle ache. Do not exceed 3 daily.',
    isPrn: true,
    inventoryCount: 30,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_SCHEDULES: MedicationSchedule[] = [
  {
    id: 'sch-1',
    medicationId: 'med-1',
    userId: 'usr-default-owner',
    timeOfDay: '08:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    dosageLabel: '1 tablet (50 mg)',
  },
  {
    id: 'sch-2',
    medicationId: 'med-2',
    userId: 'usr-default-owner',
    timeOfDay: '20:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    dosageLabel: '1 tablet (10 mg)',
  },
];

const INITIAL_ACCOUNTS: BudgetAccount[] = [
  {
    id: 'acc-1',
    userId: 'usr-default-owner',
    name: 'Primary Checking',
    accountType: 'checking',
    balanceCents: 19500, // $195.00
    lastConfirmedAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'acc-2',
    userId: 'usr-default-owner',
    name: 'Cash in Wallet',
    accountType: 'cash',
    balanceCents: 3500, // $35.00
    lastConfirmedAt: new Date().toISOString(),
    isActive: true,
  },
];

const paydayTarget = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

const INITIAL_PAYCHECK_PLAN: PaycheckPlan = {
  id: 'pay-1',
  userId: 'usr-default-owner',
  expectedNetCents: 75000, // $750.00
  nextPayday: paydayTarget,
  recurringFrequency: 'biweekly',
  confidence: 'high',
  notes: 'Warehouse bi-weekly direct deposit',
};

const INITIAL_ADVANCES: WageAdvance[] = [
  {
    id: 'adv-1',
    userId: 'usr-default-owner',
    paycheckPlanId: 'pay-1',
    advanceAmountCents: 10000, // $100.00 advance already received
    feeCents: 399,             // $3.99 instant transfer fee
    receivedDate: todayIso,
    isReconciled: false,
    notes: 'Earned wage access advance for utilities',
  },
];

const INITIAL_BILLS: Bill[] = [
  {
    id: 'bill-1',
    userId: 'usr-default-owner',
    title: 'Electric & Gas (ConEd)',
    category: 'utilities',
    amountCents: 6250, // $62.50
    dueDayOfMonth: 24,
    nextDueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    isAutopay: false,
    isPaid: false,
  },
  {
    id: 'bill-2',
    userId: 'usr-default-owner',
    title: 'Mobile Phone Plan',
    category: 'phone',
    amountCents: 4500, // $45.00
    dueDayOfMonth: 28,
    nextDueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    isAutopay: true,
    isPaid: false,
  },
];

const INITIAL_RESERVES: BudgetReserve[] = [
  {
    id: 'res-1',
    userId: 'usr-default-owner',
    name: 'Gas & Bus Transit',
    category: 'fuel',
    targetCents: 3500,
    allocatedCents: 3500, // $35.00 reserved
    isEssential: true,
  },
  {
    id: 'res-2',
    userId: 'usr-default-owner',
    name: 'Groceries until Payday',
    category: 'food',
    targetCents: 4000,
    allocatedCents: 4000, // $40.00 reserved
    isEssential: true,
  },
];

const INITIAL_CONTACTS: ResourceContact[] = [
  {
    id: 'con-1',
    userId: 'usr-default-owner',
    name: 'Officer Martinez',
    category: 'court',
    phone: '(555) 234-5678',
    email: 'j.martinez@justice.local',
    address: 'Room 204, Community Justice Center',
    notes: 'Available Mon-Fri 8:30am - 4:30pm. Call if delayed for class.',
    isEmergency: false,
  },
  {
    id: 'con-2',
    userId: 'usr-default-owner',
    name: 'Dr. Evans',
    category: 'therapist',
    phone: '(555) 345-6789',
    email: 'dr.evans@northsidewellness.org',
    address: '450 West Ave, Suite 300',
    notes: '24-hour cancellation notice required.',
    isEmergency: false,
  },
  {
    id: 'con-3',
    userId: 'usr-default-owner',
    name: 'Northside Crisis Support Line',
    category: 'emergency',
    phone: '988',
    notes: '24/7 confidential crisis and peer support.',
    isEmergency: true,
  },
];

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

export const DayBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [eventOccurrences, setEventOccurrences] = useState<EventOccurrence[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [medications, setMedications] = useState<Medication[]>(INITIAL_MEDICATIONS);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationSchedule[]>(INITIAL_SCHEDULES);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [accounts, setAccounts] = useState<BudgetAccount[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [paycheckPlan, setPaycheckPlan] = useState<PaycheckPlan | null>(INITIAL_PAYCHECK_PLAN);
  const [advances, setAdvances] = useState<WageAdvance[]>(INITIAL_ADVANCES);
  const [bills, setBills] = useState<Bill[]>(INITIAL_BILLS);
  const [reserves, setReserves] = useState<BudgetReserve[]>(INITIAL_RESERVES);
  const [contacts, setContacts] = useState<ResourceContact[]>(INITIAL_CONTACTS);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'local_only' | 'syncing' | 'offline'>('local_only');
  const [isLoaded, setIsLoaded] = useState(false);

  const isLive = isSupabaseConfigured();

  // Load from LocalStorage on mount
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('daybridge_store_v1') : null;
        if (stored) {
          const data = JSON.parse(stored);
          if (data.profile) setProfile(data.profile);
          if (data.events) setEvents(data.events);
          if (data.eventOccurrences) setEventOccurrences(data.eventOccurrences);
          if (data.tasks) setTasks(data.tasks);
          if (data.medications) setMedications(data.medications);
          if (data.medicationSchedules) setMedicationSchedules(data.medicationSchedules);
          if (data.medicationLogs) setMedicationLogs(data.medicationLogs);
          if (data.accounts) setAccounts(data.accounts);
          if (data.transactions) setTransactions(data.transactions);
          if (data.paycheckPlan) setPaycheckPlan(data.paycheckPlan);
          if (data.advances) setAdvances(data.advances);
          if (data.bills) setBills(data.bills);
          if (data.reserves) setReserves(data.reserves);
          if (data.contacts) setContacts(data.contacts);
        }
        setSyncStatus(isLive ? 'synced' : 'local_only');
      } catch {
        // Ignore storage read error
      } finally {
        setIsLoaded(true);
      }
    });
  }, [isLive]);

  // Persist to LocalStorage on state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const payload = {
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
      };
      localStorage.setItem('daybridge_store_v1', JSON.stringify(payload));
    } catch {
      // LocalStorage quota or access error
    }
  }, [
    isLoaded,
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
  ]);

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

  const resetToDefaults = () => {
    setProfile(DEFAULT_PROFILE);
    setEvents(INITIAL_EVENTS);
    setEventOccurrences([]);
    setTasks(INITIAL_TASKS);
    setMedications(INITIAL_MEDICATIONS);
    setMedicationSchedules(INITIAL_SCHEDULES);
    setMedicationLogs([]);
    setAccounts(INITIAL_ACCOUNTS);
    setTransactions([]);
    setPaycheckPlan(INITIAL_PAYCHECK_PLAN);
    setAdvances(INITIAL_ADVANCES);
    setBills(INITIAL_BILLS);
    setReserves(INITIAL_RESERVES);
    setContacts(INITIAL_CONTACTS);
  };

  const clearAllUserData = () => {
    localStorage.removeItem('daybridge_store_v1');
    resetToDefaults();
  };

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
