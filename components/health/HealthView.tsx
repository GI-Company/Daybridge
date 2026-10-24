'use client';

import React, { useState } from 'react';
import {
  Pill,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  PackageCheck,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Calendar,
  Trash2,
} from 'lucide-react';
import {useRecordFocus} from '../../lib/notifications/use-record-focus';
import { useDayBridge } from '../../lib/storage/store';
import {
  getMedicationSlotsForDay,
  calculateRefillForecast,
  MEDICAL_DISCLAIMER,
} from '../../lib/medication';
import { formatDate } from '../../lib/date-time';
import {MedicationScheduleManager} from './MedicationScheduleManager';
import {MedicationListManager} from './MedicationListManager';

interface HealthViewProps {
  onOpenQuickAdd: () => void;
  focusMedicationId?:string;focusSlot?:string;focusDate?:string;focusRevision?:number;
}

export const HealthView: React.FC<HealthViewProps> = ({ onOpenQuickAdd,focusMedicationId,focusSlot,focusDate,focusRevision }) => {
  const {
    profile,
    medications,
    medicationSchedules,
    medicationLogs,
    logDose,
    undoDose,
    deleteMedication,
    updateMedication,
  } = useDayBridge();

  const [filterType, setFilterType] = useState<'scheduled' | 'prn' | 'history'>('scheduled');

  const todaySlots = getMedicationSlotsForDay(
    medications,
    medicationSchedules,
    medicationLogs,
    focusDate?new Date(focusDate+'T12:00:00'):new Date(),
    profile.timezone
  );

  const focusTarget=focusMedicationId?(focusSlot?focusMedicationId+'-'+focusSlot:focusMedicationId):undefined;
  useRecordFocus(focusTarget,focusRevision,medications.length+':'+todaySlots.length);
  const scheduledMeds = medications.filter((m) => !m.isPrn && m.isActive);
  const prnMeds = medications.filter((m) => m.isPrn && m.isActive);

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Add Med */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Health & Medications</h2>
          <p className="text-xs text-slate-600">
            Personal schedule tracking, dose confirmation, and refill outlook
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Medication</span>
        </button>
      </div>

      {/* Mandatory Clinical Disclaimer Banner */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-start gap-3 text-slate-700">
        <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">{MEDICAL_DISCLAIMER}</p>
      </div>

      {/* 1. TODAY'S DOSE SCHEDULE CARDS */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{focusDate?'Scheduled Slots · '+formatDate(focusDate+'T12:00:00'):"Today's Scheduled Slots"}</h3>
            <p className="text-xs text-slate-600">Tap to log when taken or snoozed</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-teal-800 border border-slate-300">
            {todaySlots.filter((s) => s.actionStatus === 'taken').length} of {todaySlots.length} logged
          </span>
        </div>

        {todaySlots.length > 0 ? (
          <div className="space-y-3">
            {todaySlots.map((slot) => {
              const isTaken = slot.actionStatus === 'taken';
              const isSkipped = slot.actionStatus === 'skipped';
              const isSnoozed = slot.actionStatus === 'snoozed';

              return (
                <div
                  key={slot.slotId}
                  data-notification-target={focusTarget===slot.slotId?slot.slotId:undefined}
                  tabIndex={focusTarget===slot.slotId?-1:undefined}
                  className={`${focusTarget===slot.slotId?'ring-2 ring-teal-700 ring-offset-2 ':''}p-4 rounded-2xl border transition ${
                    isTaken
                      ? 'bg-teal-50 border-teal-800/40 shadow-sm'
                      : isSkipped
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-slate-50/90 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base text-slate-900">
                          {slot.medication.name}
                        </span>
                        {slot.medication.strengthText && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {slot.medication.strengthText}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Scheduled: {slot.displayTime}</span>
                      </div>
                    </div>

                    <div>
                      {isTaken && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-800/60">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Logged Taken</span>
                        </span>
                      )}
                      {isSkipped && (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          Skipped
                        </span>
                      )}
                      {isSnoozed && (
                        <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-800/60">
                          Snoozed
                        </span>
                      )}
                      {!isTaken && !isSkipped && !isSnoozed && (
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          No entry yet
                        </span>
                      )}
                    </div>
                  </div>

                  {slot.medication.instructions && (
                    <p className="text-xs text-slate-600 mb-3">{slot.medication.instructions}</p>
                  )}

                  {/* Actions (44px min tap targets) */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => isTaken
                        ? (window.confirm('Undo this recorded dose?')&&undoDose(slot.medication.id, slot.scheduledTime))
                        : logDose(slot.medication.id, slot.scheduledTime, 'taken')}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold min-h-[44px] transition ${
                        isTaken
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-teal-500 hover:bg-teal-400 active:scale-98 text-slate-950 shadow-md shadow-teal-100/70'
                      }`}
                    >
                      {isTaken ? 'Undo dose entry' : 'Mark Taken'}
                    </button>

                    {!isTaken && (
                      <>
                        <button
                          onClick={() =>
                            logDose(slot.medication.id, slot.scheduledTime, 'snoozed')
                          }
                          className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 min-h-[44px] border border-slate-700/60 transition"
                        >
                          Snooze 15m
                        </button>
                        <button
                          onClick={() =>
                            logDose(slot.medication.id, slot.scheduledTime, 'skipped')
                          }
                          className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 min-h-[44px] transition"
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
          <p className="text-xs text-slate-600 text-center py-4">
            No scheduled doses today. Manage medications below to remove, restore, or update an entry.
          </p>
        )}
      </section>

      <details className="rounded-3xl border border-slate-200 bg-white p-3">
        <summary className="min-h-11 cursor-pointer p-3 text-sm font-semibold text-slate-900">Manage medications & dose times <span className="font-normal text-slate-600">· {medications.filter(m=>m.isActive).length} active</span></summary>
        <div className="space-y-3"><MedicationListManager/><MedicationScheduleManager/></div>
      </details>
      {/* 2. REFILL OUTLOOK & INVENTORY */}
      <details className="rounded-3xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer p-3 text-sm font-semibold text-slate-900">Refills & inventory <span className="text-xs font-normal text-slate-600">· Expand</span></summary>
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="mb-3">
          <h3 className="font-bold text-slate-900 text-base">Refill Outlook & Inventory</h3>
          <p className="text-xs text-slate-600">
            Estimates when current supply will run low based on daily dose count
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {medications.filter(med=>med.isActive).map((med) => {
            const forecast = calculateRefillForecast(med, medicationSchedules);
            return (
              <div
                key={med.id}
                data-notification-target={!focusSlot&&focusMedicationId===med.id?med.id:undefined}
                tabIndex={!focusSlot&&focusMedicationId===med.id?-1:undefined}
                className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-900">{med.name}</span>
                    {forecast.needsRefillSoon && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-800">
                        Refill Soon
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mb-2">
                    {med.inventoryCount !== undefined
                      ? `${med.inventoryCount} doses left`
                      : 'Inventory not tracked'}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    {forecast.daysRemaining !== null
                      ? `~${forecast.daysRemaining} days left (${forecast.estimatedRunoutDate})`
                      : 'No forecast'}
                  </span>
                  {med.pharmacyInfo && <span className="truncate max-w-[120px]">{med.pharmacyInfo}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      </details>
      {/* 3. AS-NEEDED (PRN) MEDICATIONS */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="mb-3">
          <h3 className="font-bold text-slate-900 text-base">As-Needed (PRN) Entries</h3>
          <p className="text-xs text-slate-600">Non-scheduled personal relief medications</p>
        </div>

        {prnMeds.length > 0 ? (
          <div className="space-y-2">
            {prnMeds.map((med) => (
              <div
                key={med.id}
                className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">
                    {med.name} {med.strengthText}
                  </span>
                  <span className="text-xs text-slate-600 block">{med.instructions}</span>
                </div>
                <button
                  onClick={() =>
                    logDose(med.id, new Date().toISOString(), 'taken', 'PRN as needed dose')
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-teal-800 text-xs font-semibold border border-slate-750 min-h-[44px]"
                >
                  Log PRN Dose
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-2">No PRN medications listed.</p>
        )}
      </section>

      {/* 4. DOSE LOG HISTORY AUDIT */}
      <details className="rounded-3xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer p-3 text-sm font-semibold text-slate-900">Recent dose history <span className="text-xs font-normal text-slate-600">· Expand</span></summary>
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="mb-3">
          <h3 className="font-bold text-slate-900 text-base">Recent Dose Log History</h3>
          <p className="text-xs text-slate-600">
            Recorded personal actions (Never infer adherence from absent logs)
          </p>
        </div>

        {medicationLogs.length > 0 ? (
          <div className="space-y-2">
            {medicationLogs.slice(0, 8).map((log) => {
              const med = medications.find((m) => m.id === log.medicationId);
              return (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800">
                      {med ? med.name : 'Medication'}
                    </span>
                    <span className="text-[11px] text-slate-600 block">
                      Logged at: {new Date(log.recordedAtUtc).toLocaleTimeString()} on{' '}
                      {formatDate(log.recordedAtUtc)}
                    </span>
                  </div>

                  <span
                    className={`font-semibold capitalize px-2 py-0.5 rounded ${
                      log.action === 'taken'
                        ? 'text-teal-800 bg-teal-50'
                        : log.action === 'skipped'
                        ? 'text-slate-600 bg-slate-100'
                        : 'text-amber-800 bg-amber-50'
                    }`}
                  >
                    {log.action}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-2">No medication logs recorded yet.</p>
        )}
      </section>
      </details>
    </div>
  );
};
