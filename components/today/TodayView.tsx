'use client';

import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Pill,
  Wallet,
  Calendar,
  CheckSquare,
  ChevronRight,
  ShieldAlert,
  Flame,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { calculateSafeToSpend, formatCents } from '../../lib/budget';
import { getMedicationSlotsForDay, MEDICAL_DISCLAIMER } from '../../lib/medication';
import { expandEventOccurrences, detectEventConflicts } from '../../lib/recurrence';
import { formatTime, formatDate, getRelativeDayLabel, getTodayGreeting } from '../../lib/date-time';

interface TodayViewProps {
  onNavigate: (tab: string) => void;
  onOpenQuickAdd: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ onNavigate, onOpenQuickAdd }) => {
  const {
    profile,
    events,
    eventOccurrences,
    tasks,
    toggleTask,
    medications,
    medicationSchedules,
    medicationLogs,
    logDose,
    recordAttendance,
    accounts,
    bills,
    reserves,
    paycheckPlan,
  } = useDayBridge();

  const [snoozeSlotId, setSnoozeSlotId] = useState<string | null>(null);

  // 1. Calculate Safe-to-Spend
  const safeToSpend = calculateSafeToSpend({
    accounts,
    bills,
    reserves,
    nextPayday: paycheckPlan?.nextPayday,
    emergencyBufferCents: profile.emergencyBufferCents,
  });

  // 2. Expand Events for Today & Tomorrow
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59);

  const upcomingOccurrences = expandEventOccurrences(
    events[0] || ({} as any),
    startOfToday,
    endOfTomorrow,
    eventOccurrences
  );

  // Gather all events for today and tomorrow
  const allExpandedOccurrences = events.flatMap((evt) =>
    expandEventOccurrences(evt, startOfToday, endOfTomorrow, eventOccurrences)
  );

  // Sort chronologically
  allExpandedOccurrences.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Check conflicts
  const conflicts = detectEventConflicts(allExpandedOccurrences);

  // Next upcoming event (today or upcoming)
  const nextEvent = allExpandedOccurrences.find((occ) => occ.endTime.getTime() > now.getTime());

  // Tomorrow preview events
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  const tomorrowEvents = allExpandedOccurrences.filter(
    (occ) => occ.startTime >= tomorrowStart && occ.startTime <= tomorrowEnd
  );

  // 3. Medication slots due for Today
  const medicationSlots = getMedicationSlotsForDay(
    medications,
    medicationSchedules,
    medicationLogs,
    now
  );

  // 4. Top 3 incomplete tasks
  const urgentTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 3);

  // Gas & food reserves
  const gasReserve = reserves.find((r) => r.category === 'fuel');
  const foodReserve = reserves.find((r) => r.category === 'food');

  return (
    <div className="space-y-6 pb-20">
      {/* 5-Second Greeting & Overview */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {getTodayGreeting(profile.fullName)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Here is your priority outlook for today.
            </p>
          </div>
          <button
            onClick={() => onNavigate('review')}
            className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-teal-800 bg-teal-950/60 border border-teal-800/60 hover:bg-teal-900/50 px-3 py-1.5 rounded-xl transition"
          >
            <span>Weekly Summary</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Potential Conflict Warning Alert (Only if conflicts exist) */}
        {conflicts.length > 0 && (
          <div className="mb-4 p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-2xl flex items-start gap-3 text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold block text-amber-800">Schedule Notice:</span>
              <p>{conflicts[0].explanation}</p>
            </div>
          </div>
        )}

        {/* 1. NEXT OBLIGATION CARD */}
        {nextEvent ? (
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Next Obligation ({getRelativeDayLabel(nextEvent.startTime)})</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700 border border-slate-700/60">
                {nextEvent.category.replace('_', ' ')}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
              {nextEvent.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700 mb-3">
              <span className="font-medium text-teal-800">
                {formatTime(nextEvent.startTime)} – {formatTime(nextEvent.endTime)}
              </span>
              {nextEvent.travelBufferMinutes > 0 && (
                <span className="text-slate-600">
                  Buffer: {nextEvent.travelBufferMinutes}m travel prep
                </span>
              )}
            </div>

            {nextEvent.location && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="truncate">{nextEvent.location}</span>
              </div>
            )}

            {nextEvent.meetingUrl && (
              <div className="mb-3">
                <a
                  href={nextEvent.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-teal-800 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Join Video Meeting</span>
                </a>
              </div>
            )}

            {/* Preparation Checklist */}
            {nextEvent.prepChecklist && nextEvent.prepChecklist.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Preparation Checklist
                </div>
                <div className="space-y-1.5">
                  {nextEvent.prepChecklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          item.completed ? 'text-teal-700' : 'text-slate-600'
                        }`}
                      />
                      <span className={item.completed ? 'line-through text-slate-600' : ''}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Self-reported attendance action */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-600">
                Attendance:{' '}
                <span className="font-medium text-slate-800">
                  {nextEvent.attendanceStatus === 'attended_self_reported'
                    ? 'Logged Attended'
                    : nextEvent.attendanceStatus === 'not_attended_self_reported'
                    ? 'Logged Not Attended'
                    : 'Unconfirmed'}
                </span>
              </span>
              <button
                onClick={() =>
                  recordAttendance(
                    nextEvent.id,
                    nextEvent.eventId,
                    nextEvent.attendanceStatus === 'attended_self_reported'
                      ? 'unconfirmed'
                      : 'attended_self_reported'
                  )
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-750 transition"
              >
                {nextEvent.attendanceStatus === 'attended_self_reported'
                  ? 'Undo Attendance'
                  : 'Log Attended (Self-reported)'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-200 rounded-2xl p-4 text-center text-slate-600 text-xs">
            Nothing else scheduled right now.
          </div>
        )}
      </section>

      {/* 2. MEDICATIONS DUE TODAY */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-700">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scheduled Medications</h3>
              <p className="text-[11px] text-slate-600">Log taken, snooze, or skip</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('health')}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium"
          >
            All Meds
          </button>
        </div>

        {medicationSlots.length > 0 ? (
          <div className="space-y-2.5">
            {medicationSlots.map((slot) => {
              const isTaken = slot.actionStatus === 'taken';
              const isSkipped = slot.actionStatus === 'skipped';
              const isSnoozed = slot.actionStatus === 'snoozed';

              return (
                <div
                  key={slot.slotId}
                  className={`p-3.5 rounded-2xl border transition ${
                    isTaken
                      ? 'bg-teal-950/20 border-teal-800/40'
                      : isSkipped
                      ? 'bg-slate-950/40 border-slate-200 opacity-60'
                      : 'bg-slate-50/90 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {slot.medication.name}
                        </span>
                        {slot.medication.strengthText && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {slot.medication.strengthText}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-teal-700 font-medium">{slot.displayTime}</span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isTaken && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-800/60">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Taken</span>
                        </span>
                      )}
                      {isSkipped && (
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          Skipped
                        </span>
                      )}
                      {isSnoozed && (
                        <span className="text-[11px] font-medium text-amber-800 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                          Snoozed 30m
                        </span>
                      )}
                    </div>
                  </div>

                  {slot.medication.instructions && (
                    <p className="text-xs text-slate-600 mb-3">{slot.medication.instructions}</p>
                  )}

                  {/* Actions (44px min tap targets) */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-850/60">
                    <button
                      onClick={() =>
                        logDose(
                          slot.medication.id,
                          slot.scheduledTime,
                          isTaken ? 'skipped' : 'taken'
                        )
                      }
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold min-h-[44px] transition ${
                        isTaken
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-teal-500 hover:bg-teal-400 active:scale-98 text-slate-950 shadow-md shadow-teal-100/70'
                      }`}
                    >
                      {isTaken ? 'Undo (Mark Not Taken)' : 'Take Dose'}
                    </button>

                    {!isTaken && (
                      <>
                        <button
                          onClick={() =>
                            logDose(slot.medication.id, slot.scheduledTime, 'snoozed')
                          }
                          className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 min-h-[44px] border border-slate-700/60 transition"
                        >
                          Snooze
                        </button>
                        <button
                          onClick={() =>
                            logDose(slot.medication.id, slot.scheduledTime, 'skipped')
                          }
                          className="px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 min-h-[44px] transition"
                        >
                          Skip
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-600 text-center py-3">
            No scheduled medication doses for today.
          </p>
        )}
      </section>

      {/* 3. CONSERVATIVE SAFE-TO-SPEND */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-700">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Safe-to-Spend</h3>
              <p className="text-[11px] text-slate-600">
                Until payday ({safeToSpend.daysUntilPayday} days left)
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('money')}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium"
          >
            Money Plan
          </button>
        </div>

        <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5 mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-teal-700 tracking-tight">
              {formatCents(safeToSpend.netSpendableCents)}
            </span>
            {safeToSpend.shortfallCents > 0 && (
              <span className="text-xs font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                Shortfall: -{formatCents(safeToSpend.shortfallCents)}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Confirmed balance ({formatCents(safeToSpend.totalConfirmedCents)}) minus{' '}
            {formatCents(safeToSpend.unpaidPrePaydayBillsCents)} upcoming bills, essential
            reserves, and emergency buffer.
          </p>

          {/* Reserves Quick View */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">
                Gas / Transit Reserve
              </span>
              <span className="text-sm font-bold text-slate-800">
                {gasReserve ? formatCents(gasReserve.allocatedCents) : '$0.00'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">
                Food / Grocery Reserve
              </span>
              <span className="text-sm font-bold text-slate-800">
                {foodReserve ? formatCents(foodReserve.allocatedCents) : '$0.00'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TOP 3 INCOMPLETE TASKS */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-700">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Priority Tasks</h3>
              <p className="text-[11px] text-slate-600">Top tasks for today</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('tasks')}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium"
          >
            All Tasks
          </button>
        </div>

        {urgentTasks.length > 0 ? (
          <div className="space-y-2">
            {urgentTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-200 hover:border-slate-750 transition cursor-pointer min-h-[48px]"
              >
                <div
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                    task.completed
                      ? 'bg-teal-500 border-teal-400 text-slate-950'
                      : 'border-slate-600 bg-white'
                  }`}
                >
                  {task.completed && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium truncate ${
                        task.completed ? 'line-through text-slate-600' : 'text-slate-800'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.priority === 'urgent' && (
                      <span className="text-[10px] uppercase font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">
                        Urgent
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 text-center py-3">
            No pending priority tasks.
          </p>
        )}
      </section>

      {/* 5. TOMORROW PREVIEW */}
      <section className="bg-slate-900/60 border border-slate-200 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">
              Tomorrow Preview
            </h3>
          </div>
          <button
            onClick={() => onNavigate('schedule')}
            className="text-xs text-teal-700 hover:underline"
          >
            View Calendar
          </button>
        </div>

        {tomorrowEvents.length > 0 ? (
          <div className="space-y-2">
            {tomorrowEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-xl bg-slate-950/40 border border-slate-850/80 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-xs text-slate-800">{evt.title}</div>
                  <div className="text-[11px] text-teal-700">
                    {formatTime(evt.startTime)} – {formatTime(evt.endTime)}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {evt.category.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-1">Nothing scheduled for tomorrow yet.</p>
        )}
      </section>
    </div>
  );
};
