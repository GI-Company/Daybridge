// DayBridge Type Definitions

export type VenueType = 'in_person' | 'virtual' | 'phone';
export type EventCategory = 'court' | 'class' | 'drug_testing' | 'therapy' | 'case_management' | 'work' | 'personal' | 'other';
export type AttendanceStatus = 'unconfirmed' | 'attended_self_reported' | 'not_attended_self_reported' | 'cancelled';

export interface UserProfile {
  id: string;
  fullName: string;
  timezone: string;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  privacyMode: boolean;
  emergencyBufferCents: number;
  gasTargetCents: number;
  foodTargetCents: number;
  reminderLeadMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrepChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  category: EventCategory;
  description: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  timezone: string;
  venueType: VenueType;
  location?: string;
  meetingUrl?: string;
  contactInfo?: string;
  rrule?: string; // e.g., "FREQ=WEEKLY;BYDAY=WE"
  travelBufferMinutes: number;
  destinationLat?:number;
  destinationLon?:number;
  travelMode?:'car'|'pedestrian'|'bicycle';
  prepChecklist: PrepChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EventOccurrence {
  id: string;
  eventId: string;
  userId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  attendanceStatus: AttendanceStatus;
  attendanceRecordedAt?: string;
  attendanceNote?: string;
  isException: boolean;
  overrideTitle?: string;
  overrideStartTime?: string;
  overrideEndTime?: string;
}

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  priority: PriorityLevel;
  dueDate?: string; // ISO string
  completed: boolean;
  completedAt?: string;
  linkedEventId?: string;
  isRecurring: boolean;
  rrule?: string;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  strengthText: string;
  instructions: string;
  prescribingClinician?: string;
  pharmacyInfo?: string;
  isPrn: boolean;
  inventoryCount?: number;
  refillThreshold?: number;
  refillDueDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  userId: string;
  timeOfDay: string; // "08:00"
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dosageLabel: string;
}

export type DoseAction = 'taken' | 'skipped' | 'snoozed';

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  scheduleId?: string;
  scheduledSlotUtc: string;
  action: DoseAction;
  recordedAtUtc: string;
  skipReason?: string;
  requestId?: string;
}

export type AccountType = 'checking' | 'cash' | 'savings' | 'prepaid';

export interface BudgetAccount {
  id: string;
  userId: string;
  name: string;
  accountType: AccountType;
  balanceCents: number;
  lastConfirmedAt: string;
  isActive: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface MoneyTransaction {
  id: string;
  userId: string;
  accountId: string;
  amountCents: number; // positive for income, negative for expense
  transactionType: TransactionType;
  category: string;
  transactionDate: string; // YYYY-MM-DD
  notes?: string;
  isPending: boolean;
  linkedTransferId?: string;
  createdAt: string;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface PaycheckPlan {
  id: string;
  userId: string;
  expectedNetCents: number;
  nextPayday: string; // YYYY-MM-DD
  recurringFrequency: PayFrequency;
  confidence: 'high' | 'medium' | 'low';
  actualNetCents?: number;
  reconciledAt?: string;
  notes?: string;
}

export interface WageAdvance {
  id: string;
  userId: string;
  paycheckPlanId?: string;
  advanceAmountCents: number;
  feeCents: number;
  receivedDate: string; // YYYY-MM-DD
  isReconciled: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Bill {
  id: string;
  userId: string;
  title: string;
  category: string;
  amountCents: number;
  dueDayOfMonth?: number;
  nextDueDate: string; // YYYY-MM-DD
  isAutopay: boolean;
  isPaid: boolean;
  lastPaidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ReserveCategory = 'fuel' | 'food' | 'court' | 'prescriptions' | 'emergency' | 'other';

export interface BudgetReserve {
  id: string;
  userId: string;
  name: string;
  category: ReserveCategory;
  targetCents: number;
  allocatedCents: number;
  isEssential: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeToSpendResult {
  totalConfirmedCents: number;
  unpaidPrePaydayBillsCents: number;
  earmarkedReservesCents: number;
  emergencyBufferCents: number;
  netSpendableCents: number; // Clipped to 0 for safe spend
  shortfallCents: number;    // If negative balance, amount needed
  isEstimated: boolean;
  staleAccountWarning: boolean;
  daysUntilPayday: number;
}

export interface RemainingPaycheckResult {
  expectedNetCents: number;
  totalAdvancesCents: number;
  totalFeesCents: number;
  netRemainingCents: number; // Clipped at 0
  overadvancedCents: number;
}

export type ReminderSourceType = 'event' | 'medication' | 'bill' | 'task' | 'refill';

export interface ReminderOccurrence {
  id: string;
  userId: string;
  sourceType: ReminderSourceType;
  sourceId: string;
  dueAtUtc: string;
  dedupeKey: string;
  status: 'pending' | 'sent' | 'dismissed' | 'snoozed' | 'cancelled';
  genericTitle: string;
  genericBody: string;
}

export interface ResourceContact {
  id: string;
  userId: string;
  name: string;
  category: 'court' | 'therapist' | 'doctor' | 'pharmacy' | 'case_manager' | 'transport' | 'emergency' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isEmergency: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyReviewSummary {
  startDate: string;
  endDate: string;
  scheduledCourtClasses: number;
  attendedCourtClasses: number;
  otherEventsCount: number;
  scheduledDoses: number;
  loggedDoses: number;
  completedTasks: number;
  totalIncomeCents: number;
  totalSpentCents: number;
  unpaidBillsCount: number;
}

export type SavedPlaceCategory = 'home'|'work'|'therapy'|'class'|'drug_testing'|'court'|'other';
/** User-approved coordinates; accessible only in this account's RLS-scoped private snapshot. */
export interface SavedPlace {
  id:string;userId:string;label:string;category:SavedPlaceCategory;
  address:string;lat:number;lon:number;createdAt:string;updatedAt:string;
}
