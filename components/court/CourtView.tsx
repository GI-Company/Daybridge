'use client';

import React, { useState } from 'react';
import {
  Scale,
  Plus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MapPin,
  Clock,
  ShieldAlert,
  FileText,
  PhoneCall,
  Calendar,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { expandEventOccurrences } from '../../lib/recurrence';
import { formatTime, formatDate, getRelativeDayLabel } from '../../lib/date-time';

interface CourtViewProps {
  onOpenQuickAdd: () => void;
  onNavigate: (tab: string) => void;
}

export const CourtView: React.FC<CourtViewProps> = ({ onOpenQuickAdd, onNavigate }) => {
  const { events, eventOccurrences, recordAttendance, contacts } = useDayBridge();

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 23, 59, 59);

  // Filter only court and case management events
  const courtEvents = events.filter(
    (e) => e.category === 'court' || e.category === 'case_management'
  );

  const courtOccurrences = courtEvents.flatMap((evt) =>
    expandEventOccurrences(evt, rangeStart, rangeEnd, eventOccurrences)
  );

  courtOccurrences.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const upcomingCourtOccurrences = courtOccurrences.filter((occ) => occ.endTime >= now);
  const pastCourtOccurrences = courtOccurrences.filter((occ) => occ.endTime < now).reverse();

  // Find court contacts
  const courtContacts = contacts.filter((c) => c.category === 'court' || c.category === 'case_manager');

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Add Event */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-6 h-6 text-amber-400" />
            <span>Court & Accountability Classes</span>
          </h2>
          <p className="text-xs text-slate-400">
            Self-reported class attendance, appearance preparation, and case contacts
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-950/50"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Obligation</span>
        </button>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl flex items-start gap-3 text-amber-200">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-amber-300 block">Personal Self-Report Notice:</span>
          <p className="text-amber-200/90 leading-relaxed">
            Attendance recorded here is personal self-reported documentation for your own
            organization. It does NOT constitute an official court attendance certificate, and
            compliance scores are never officially calculated by this app.
          </p>
        </div>
      </div>

      {/* Quick Action: Export Weekly Review for Court */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Need your weekly record?</h3>
            <p className="text-xs text-slate-400">
              Print or export your self-reported log to bring to your coordinator or hearing.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('review')}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 text-xs font-semibold border border-slate-700 min-h-[44px]"
        >
          Weekly Review →
        </button>
      </div>

      {/* 1. UPCOMING COURT CLASSES & APPEARANCES */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <div className="mb-4">
          <h3 className="font-bold text-slate-100 text-base">Upcoming Classes & Hearings</h3>
          <p className="text-xs text-slate-400">Next 3 weeks</p>
        </div>

        {upcomingCourtOccurrences.length > 0 ? (
          <div className="space-y-3">
            {upcomingCourtOccurrences.map((occ) => {
              const isAttended = occ.attendanceStatus === 'attended_self_reported';
              return (
                <div
                  key={occ.id}
                  className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-xs font-bold text-amber-400 block mb-0.5">
                        {getRelativeDayLabel(occ.startTime)} • {formatDate(occ.startTime)}
                      </span>
                      <h4 className="font-bold text-base text-slate-100">{occ.title}</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                      Court
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 mb-3">
                    <span className="text-teal-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {formatTime(occ.startTime)} – {formatTime(occ.endTime)}
                      </span>
                    </span>
                    {occ.travelBufferMinutes > 0 && (
                      <span className="text-slate-400">
                        {occ.travelBufferMinutes}m travel buffer
                      </span>
                    )}
                    {occ.location && (
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{occ.location}</span>
                      </span>
                    )}
                  </div>

                  {/* Attendance One-Tap Toggle */}
                  <div className="pt-3 border-t border-slate-850 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Attendance:{' '}
                      <span className="font-medium text-slate-200">
                        {isAttended ? 'Attended (Self-reported)' : 'Unconfirmed'}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        recordAttendance(
                          occ.id,
                          occ.eventId,
                          isAttended ? 'unconfirmed' : 'attended_self_reported',
                          'Attended court requirement'
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold min-h-[44px] transition ${
                        isAttended
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                          : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                      }`}
                    >
                      {isAttended ? 'Undo Attendance' : 'Mark Attended'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3 text-center">
            No upcoming court classes scheduled.
          </p>
        )}
      </section>

      {/* 2. RECENT COURT LOG HISTORY */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <div className="mb-3">
          <h3 className="font-bold text-slate-100 text-base">Past Sessions Log</h3>
          <p className="text-xs text-slate-400">Your self-reported history</p>
        </div>

        {pastCourtOccurrences.length > 0 ? (
          <div className="space-y-2">
            {pastCourtOccurrences.map((occ) => (
              <div
                key={occ.id}
                className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-200 block">{occ.title}</span>
                  <span className="text-[11px] text-slate-500">
                    {formatDate(occ.startTime)} at {formatTime(occ.startTime)}
                  </span>
                </div>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    occ.attendanceStatus === 'attended_self_reported'
                      ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-800/40'
                      : 'text-slate-400 bg-slate-800'
                  }`}
                >
                  {occ.attendanceStatus === 'attended_self_reported'
                    ? 'Attended'
                    : 'Unconfirmed'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">No past court sessions logged yet.</p>
        )}
      </section>

      {/* 3. CASE CONTACTS */}
      {courtContacts.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="mb-3">
            <h3 className="font-bold text-slate-100 text-base">Court & Case Contacts</h3>
            <p className="text-xs text-slate-400">Direct phone and notes</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {courtContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 bg-slate-950/80 border border-slate-850 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-sm text-slate-100 block">{contact.name}</span>
                  <span className="text-xs text-teal-400 font-medium">{contact.phone}</span>
                  {contact.notes && <span className="text-[11px] text-slate-400 block mt-0.5">{contact.notes}</span>}
                </div>
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-2.5 rounded-xl bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 min-h-[44px] flex items-center justify-center"
                    aria-label={`Call ${contact.name}`}
                  >
                    <PhoneCall className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
