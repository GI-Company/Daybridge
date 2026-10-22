'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ExternalLink,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  Scale,
  Briefcase,
  HeartHandshake,
  Trash2,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { expandEventOccurrences, detectEventConflicts } from '../../lib/recurrence';
import { formatTime, formatDate, getRelativeDayLabel } from '../../lib/date-time';
import { EventCategory, AttendanceStatus } from '../../lib/types';

interface ScheduleViewProps {
  onOpenQuickAdd: () => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onOpenQuickAdd }) => {
  const { events, eventOccurrences, recordAttendance, deleteEvent } = useDayBridge();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOccurrence, setSelectedOccurrence] = useState<any | null>(null);

  // Time window: today through next 14 days
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 23, 59, 59);

  // Expand all events
  const allOccurrences = events.flatMap((evt) =>
    expandEventOccurrences(evt, rangeStart, rangeEnd, eventOccurrences)
  );

  allOccurrences.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Detect conflicts
  const conflicts = detectEventConflicts(allOccurrences);

  // Filter by category
  const filteredOccurrences = allOccurrences.filter((occ) => {
    if (selectedCategory === 'all') return true;
    return occ.category === selectedCategory;
  });

  const categories = [
    { id: 'all', label: 'All Events' },
    { id: 'court', label: 'Court & Classes' },
    { id: 'work', label: 'Work Shifts' },
    { id: 'therapy', label: 'Therapy' },
    { id: 'case_management', label: 'Case Mgmt' },
    { id: 'personal', label: 'Personal' },
  ];

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Add Event */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Schedule & Calendar</h2>
          <p className="text-xs text-slate-600">
            Appointments, court obligations, work shifts, and travel prep
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Event</span>
        </button>
      </div>

      {/* Category Filter Pills (44px min tap targets) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap min-h-[44px] transition border ${
                isSelected
                  ? 'bg-teal-500 text-slate-950 font-bold border-teal-400 shadow-md shadow-teal-950/40'
                  : 'bg-white text-slate-600 hover:text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Conflict Warnings */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Scheduling & Buffer Notices ({conflicts.length})</span>
          </div>
          {conflicts.map((c, idx) => (
            <p key={idx} className="text-xs text-amber-200/90 pl-6">
              • {c.explanation}
            </p>
          ))}
        </div>
      )}

      {/* Agenda Occurrence Cards */}
      {filteredOccurrences.length > 0 ? (
        <div className="space-y-3">
          {filteredOccurrences.map((occ) => {
            const isToday = occ.startTime.toDateString() === now.toDateString();
            const isCourt = occ.category === 'court';
            const isAttended = occ.attendanceStatus === 'attended_self_reported';
            const isNotAttended = occ.attendanceStatus === 'not_attended_self_reported';

            return (
              <div
                key={occ.id}
                onClick={() => setSelectedOccurrence(occ)}
                className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer hover:border-slate-300 ${
                  isToday
                    ? 'bg-white border-teal-500/30 shadow-md shadow-teal-950/30'
                    : 'bg-white/95 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-teal-700">
                        {getRelativeDayLabel(occ.startTime)} • {formatDate(occ.startTime)}
                      </span>
                      {isCourt && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/60">
                          <Scale className="w-3 h-3" />
                          <span>Court Requirement</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-slate-900">{occ.title}</h3>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize bg-slate-100 text-slate-700 border border-slate-700/60">
                    {occ.category.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700 mb-3">
                  <span className="font-medium text-teal-800">
                    {formatTime(occ.startTime)} – {formatTime(occ.endTime)}
                  </span>
                  {occ.travelBufferMinutes > 0 && (
                    <span className="text-slate-600">
                      Buffer: {occ.travelBufferMinutes}m travel
                    </span>
                  )}
                  {occ.venueType === 'virtual' ? (
                    <span className="text-sky-700 font-medium">Virtual / Telehealth</span>
                  ) : (
                    occ.location && <span className="text-slate-600">{occ.location}</span>
                  )}
                </div>

                {/* Self-reported attendance status bar */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                  <div className="flex items-center gap-1.5">
                    {isAttended ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Self-reported Attended</span>
                      </span>
                    ) : isNotAttended ? (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Self-reported Not Attended</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Attendance Unconfirmed</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-teal-700 hover:underline">
                    View Details & Attendance →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-3xl p-6">
          <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-sm mb-1">No events in this category</h3>
          <p className="text-xs text-slate-600 mb-4">
            Add your court classes, work shifts, and appointments to stay organized.
          </p>
          <button
            onClick={onOpenQuickAdd}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
          >
            Add an Event
          </button>
        </div>
      )}

      {/* Detail & Self-Report Attendance Modal */}
      {selectedOccurrence && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  {selectedOccurrence.category.replace('_', ' ')}
                </span>
                <h3 className="font-bold text-lg text-slate-900">{selectedOccurrence.title}</h3>
              </div>
              <button
                onClick={() => setSelectedOccurrence(null)}
                className="p-1.5 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <div className="text-slate-600">Date & Time:</div>
                <div className="text-sm font-semibold text-slate-800">
                  {formatDate(selectedOccurrence.startTime)} from{' '}
                  {formatTime(selectedOccurrence.startTime)} – {formatTime(selectedOccurrence.endTime)}
                </div>
                {selectedOccurrence.travelBufferMinutes > 0 && (
                  <div className="text-teal-800 text-[11px]">
                    Includes {selectedOccurrence.travelBufferMinutes} minutes travel buffer
                  </div>
                )}
              </div>

              {selectedOccurrence.location && (
                <div>
                  <div className="text-slate-600 mb-1">Location:</div>
                  <div className="text-slate-800 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {selectedOccurrence.location}
                  </div>
                </div>
              )}

              {selectedOccurrence.meetingUrl && (
                <div>
                  <div className="text-slate-600 mb-1">Virtual Meeting Link:</div>
                  <a
                    href={selectedOccurrence.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-teal-700 p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{selectedOccurrence.meetingUrl}</span>
                  </a>
                </div>
              )}

              {/* Attendance Recording */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Self-Report Attendance
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      recordAttendance(
                        selectedOccurrence.id,
                        selectedOccurrence.eventId,
                        'attended_self_reported',
                        'Attended as scheduled'
                      );
                      setSelectedOccurrence((prev: any) => ({
                        ...prev,
                        attendanceStatus: 'attended_self_reported',
                      }));
                    }}
                    className={`p-3 rounded-xl font-bold min-h-[44px] transition flex items-center justify-center gap-2 border ${
                      selectedOccurrence.attendanceStatus === 'attended_self_reported'
                        ? 'bg-emerald-500/20 text-emerald-800 border-emerald-500/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attended</span>
                  </button>

                  <button
                    onClick={() => {
                      recordAttendance(
                        selectedOccurrence.id,
                        selectedOccurrence.eventId,
                        'not_attended_self_reported',
                        'Self-reported absence'
                      );
                      setSelectedOccurrence((prev: any) => ({
                        ...prev,
                        attendanceStatus: 'not_attended_self_reported',
                      }));
                    }}
                    className={`p-3 rounded-xl font-bold min-h-[44px] transition flex items-center justify-center gap-2 border ${
                      selectedOccurrence.attendanceStatus === 'not_attended_self_reported'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Not Attended</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 italic">
                  * Reminder: Attendance is personal self-reported documentation and does not constitute official court verification.
                </p>
              </div>

              {/* Delete Event Series */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <button
                  onClick={() => {
                    if (confirm('Delete this event?')) {
                      deleteEvent(selectedOccurrence.eventId);
                      setSelectedOccurrence(null);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-950/40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Event</span>
                </button>

                <button
                  onClick={() => setSelectedOccurrence(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
