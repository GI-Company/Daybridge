import { Medication, MedicationSchedule, MedicationLog, DoseAction } from './types';

export interface DueMedicationSlot {
  slotId: string;
  medication: Medication;
  schedule?: MedicationSchedule;
  scheduledTime: string; // ISO string for the intended slot
  displayTime: string;   // e.g. "8:00 AM"
  actionStatus: 'pending' | 'taken' | 'skipped' | 'snoozed';
  loggedAt?: string;
  skipReason?: string;
}

export const MEDICAL_DISCLAIMER =
  'Personal organizer record only — not clinical advice. Always follow prescription label directions and healthcare provider guidance.';

/**
 * Builds the list of scheduled medication slots due for a target day (default today).
 */
export function getMedicationSlotsForDay(
  medications: Medication[],
  schedules: MedicationSchedule[],
  logs: MedicationLog[],
  targetDate: Date = new Date()
): DueMedicationSlot[] {
  const dayOfWeek = targetDate.getDay();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const date = targetDate.getDate();

  const slots: DueMedicationSlot[] = [];

  medications.forEach((med) => {
    if (!med.isActive || med.isPrn) return;

    // Find schedules for this medication
    const medSchedules = schedules.filter((s) => s.medicationId === med.id);

    medSchedules.forEach((sch) => {
      // Check if scheduled for this day of week
      if (!sch.daysOfWeek.includes(dayOfWeek)) return;

      const [hours, minutes] = sch.timeOfDay.split(':').map((v) => parseInt(v, 10));
      const slotDate = new Date(year, month, date, hours || 0, minutes || 0, 0, 0);
      const slotIso = slotDate.toISOString();

      // Check if logged
      const matchLog = logs.find((l) => {
        if (l.medicationId !== med.id) return false;
        const loggedSlot = new Date(l.scheduledSlotUtc);
        return Math.abs(loggedSlot.getTime() - slotDate.getTime()) < 3600000; // 1 hr window match
      });

      // Display format (e.g. 8:00 AM)
      const period = (hours || 0) >= 12 ? 'PM' : 'AM';
      const displayHour = (hours || 0) % 12 === 0 ? 12 : (hours || 0) % 12;
      const displayMinutes = (minutes || 0).toString().padStart(2, '0');
      const displayTime = `${displayHour}:${displayMinutes} ${period}`;

      slots.push({
        slotId: `${med.id}-${slotIso}`,
        medication: med,
        schedule: sch,
        scheduledTime: slotIso,
        displayTime,
        actionStatus: matchLog ? (matchLog.action as DueMedicationSlot['actionStatus']) : 'pending',
        loggedAt: matchLog?.recordedAtUtc,
        skipReason: matchLog?.skipReason,
      });
    });
  });

  // Sort by time of day
  return slots.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
}

/**
 * Predicts estimated refill runout date based on current pill count and daily dose count.
 */
export function calculateRefillForecast(
  medication: Medication,
  schedules: MedicationSchedule[]
): {
  estimatedRunoutDate: string | null;
  daysRemaining: number | null;
  needsRefillSoon: boolean;
} {
  if (medication.inventoryCount === undefined || medication.inventoryCount === null) {
    return { estimatedRunoutDate: null, daysRemaining: null, needsRefillSoon: false };
  }

  const medSchedules = schedules.filter((s) => s.medicationId === medication.id);
  // Calculate average daily doses
  const totalWeeklyDoses = medSchedules.reduce((sum, s) => sum + s.daysOfWeek.length, 0);
  const dailyRate = totalWeeklyDoses > 0 ? totalWeeklyDoses / 7 : 1;

  const daysRemaining = Math.max(0, Math.floor(medication.inventoryCount / dailyRate));
  const runout = new Date();
  runout.setDate(runout.getDate() + daysRemaining);

  const threshold = medication.refillThreshold || 7;
  const needsRefillSoon = daysRemaining <= threshold;

  return {
    estimatedRunoutDate: runout.toISOString().split('T')[0],
    daysRemaining,
    needsRefillSoon,
  };
}
