'use client';

import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Pill,
  Wallet,
  ShieldAlert,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { formatCents } from '../../lib/budget';
import { formatDate } from '../../lib/date-time';

export const ReviewView: React.FC = () => {
  const {
    profile,
    events,
    eventOccurrences,
    medications,
    medicationLogs,
    tasks,
    transactions,
    accounts,
  } = useDayBridge();

  const [omitMedNames, setOmitMedNames] = useState(false);
  const [personalNotes, setPersonalNotes] = useState(
    'Maintained all self-reported accountability classes and work shifts this week.'
  );

  // Time window: Past 7 days
  const now = new Date();
  const past7Days = new Date(now.getTime() - 7 * 86400000);

  // Filter court events
  const courtEvents = events.filter(
    (e) => e.category === 'court' || e.category === 'case_management'
  );
  const attendedOccurrences = eventOccurrences.filter(
    (o) => o.attendanceStatus === 'attended_self_reported'
  );

  // Completed tasks
  const completedTasks = tasks.filter((t) => t.completed);

  // Total income / spent in past 7 days
  const recentTransactions = transactions.filter(
    (tx) => new Date(tx.transactionDate).getTime() >= past7Days.getTime()
  );
  const totalSpentCents = Math.abs(
    recentTransactions
      .filter((t) => t.amountCents < 0)
      .reduce((sum, t) => sum + t.amountCents, 0)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Title / Description', 'Status / Notes'],
      ...attendedOccurrences.map((o) => [
        o.attendanceRecordedAt ? o.attendanceRecordedAt.split('T')[0] : '',
        'Court / Event',
        o.overrideTitle || 'Scheduled Class',
        'Attended (Self-reported)',
      ]),
      ...medicationLogs.map((l) => {
        const med = medications.find((m) => m.id === l.medicationId);
        const name = omitMedNames ? 'Scheduled Prescription' : med ? med.name : 'Medication';
        return [l.recordedAtUtc.split('T')[0], 'Medication Action', name, l.action];
      }),
      ...completedTasks.map((t) => [
        t.completedAt ? t.completedAt.split('T')[0] : '',
        'Completed Task',
        t.title,
        'Done',
      ]),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DayBridge_Self_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Action Header (Hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-700" />
            <span>Weekly Self-Review & Report</span>
          </h2>
          <p className="text-xs text-slate-600">
            Printable, privacy-preserving personal summary for meetings or records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOmitMedNames((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 min-h-[44px]"
            title="Redact prescription names in export for medical privacy"
          >
            {omitMedNames ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-700" />
                <span>Med Names Hidden</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-slate-600" />
                <span>Hide Med Names</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-750 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] shadow-md shadow-teal-100/70"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE REPORT CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* MANDATORY DISCLAIMER HEADER */}
        <div className="border-b-2 border-teal-500 pb-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 print:text-black">
                DayBridge Weekly Activity Summary
              </h1>
              <p className="text-xs text-slate-600 print:text-gray-600">
                Participant: <strong className="text-slate-800 print:text-black">{profile.fullName || 'Authorized Owner'}</strong> • Date Range: {formatDate(past7Days)} – {formatDate(now)}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-600 print:text-gray-600">
              Generated: {formatDate(now)}
            </div>
          </div>

          <div className="p-3 bg-amber-50 print:bg-amber-50 border border-amber-800/60 print:border-amber-300 rounded-xl text-amber-900 print:text-amber-900 text-xs">
            <strong>Notice:</strong> Personal self-reported weekly organization summary — not an official court attendance record or clinical compliance certificate.
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 bg-slate-50 print:bg-gray-100 rounded-xl border border-slate-200 print:border-gray-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 print:text-gray-600 block mb-1">
              Court Classes Attended
            </span>
            <span className="text-2xl font-bold text-teal-700 print:text-teal-700">
              {attendedOccurrences.length}
            </span>
            <span className="text-[10px] text-slate-600 print:text-gray-500 block">
              Self-reported entries
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 print:bg-gray-100 rounded-xl border border-slate-200 print:border-gray-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 print:text-gray-600 block mb-1">
              Doses Logged
            </span>
            <span className="text-2xl font-bold text-teal-700 print:text-teal-700">
              {medicationLogs.filter((l) => l.action === 'taken').length}
            </span>
            <span className="text-[10px] text-slate-600 print:text-gray-500 block">
              Recorded personal actions
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 print:bg-gray-100 rounded-xl border border-slate-200 print:border-gray-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 print:text-gray-600 block mb-1">
              Tasks Completed
            </span>
            <span className="text-2xl font-bold text-teal-700 print:text-teal-700">
              {completedTasks.length}
            </span>
            <span className="text-[10px] text-slate-600 print:text-gray-500 block">
              Prep & obligations
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 print:bg-gray-100 rounded-xl border border-slate-200 print:border-gray-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 print:text-gray-600 block mb-1">
              Weekly Outflows
            </span>
            <span className="text-2xl font-bold text-slate-800 print:text-black">
              {formatCents(totalSpentCents)}
            </span>
            <span className="text-[10px] text-slate-600 print:text-gray-500 block">
              Manual entries
            </span>
          </div>
        </div>

        {/* 1. COURT & ACCOUNTABILITY SESSIONS */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 print:text-gray-800 border-b border-slate-200 print:border-gray-300 pb-1.5 mb-2.5">
            1. Accountability Classes & Scheduled Obligations
          </h3>
          {events.length > 0 ? (
            <div className="space-y-1.5 text-xs">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 bg-slate-50 print:bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-slate-800 print:text-black">{evt.title}</span>
                    <span className="text-slate-600 print:text-gray-600 ml-2">
                      ({evt.category.replace('_', ' ')})
                    </span>
                    {evt.location && <span className="text-slate-600 print:text-gray-500 ml-2">• {evt.location}</span>}
                  </div>
                  <span className="text-teal-700 print:text-teal-700 font-medium">
                    Self-reported active
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 print:text-gray-500">None scheduled this period.</p>
          )}
        </div>

        {/* 2. MEDICATIONS RECORDED */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 print:text-gray-800 border-b border-slate-200 print:border-gray-300 pb-1.5 mb-2.5">
            2. Personal Medication Log Records
          </h3>
          <div className="space-y-1.5 text-xs">
            {medications.map((med) => (
              <div
                key={med.id}
                className="p-2.5 bg-slate-50 print:bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-800 print:text-black">
                    {omitMedNames ? 'Scheduled Prescription' : `${med.name} ${med.strengthText}`}
                  </span>
                  <span className="text-slate-600 print:text-gray-600 ml-2">
                    {med.instructions}
                  </span>
                </div>
                <span className="text-slate-600 print:text-gray-600">
                  {medicationLogs.filter((l) => l.medicationId === med.id && l.action === 'taken')
                    .length}{' '}
                  dose(s) logged
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PARTICIPANT NOTES / COMMENTS */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 print:text-gray-800 border-b border-slate-200 print:border-gray-300 pb-1.5 mb-2.5">
            3. Participant Reflection & Notes
          </h3>
          <textarea
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
            rows={3}
            className="w-full bg-slate-50 print:bg-transparent border border-slate-200 print:border-gray-300 rounded-xl p-3 text-xs text-slate-800 print:text-black focus:outline-none"
            placeholder="Type your personal reflections or comments for this week's review..."
          />
        </div>

        {/* SIGNATURE / VERIFICATION LINE */}
        <div className="pt-6 border-t border-slate-200 print:border-gray-300 flex items-center justify-between text-xs text-slate-600 print:text-gray-600">
          <div>
            <span>Participant Signature: ____________________________________</span>
          </div>
          <div>
            <span>Date: ________________________</span>
          </div>
        </div>
      </div>
    </div>
  );
};
