import type { CalendarEvent, EventOccurrence } from './types';
import {calendarInstances} from './notifications/time.ts';

export interface EventConflict {
  eventId1: string;
  eventTitle1: string;
  eventId2: string;
  eventTitle2: string;
  conflictType: 'overlap' | 'travel_buffer';
  explanation: string;
}

/** Calendar and background reminders share occurrence identities and timezone rules. */
export function expandEventOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  existingOccurrences: EventOccurrence[] = []
) {
  return calendarInstances(event, existingOccurrences, rangeStart.getTime(), rangeEnd.getTime()).map(instance => ({
    id: instance.occurrence?.id || `occ-${event.id}-${instance.originalStart}`,
    eventId: event.id,
    userId: event.userId,
    title: instance.title,
    category: event.category,
    startTime: new Date(instance.start),
    originalStartTimeUtc: new Date(instance.originalStart).toISOString(),
    endTime: new Date(instance.end),
    venueType: event.venueType,
    location: event.location,
    meetingUrl: event.meetingUrl,
    travelBufferMinutes: event.travelBufferMinutes,
    prepChecklist: event.prepChecklist,
    checkInReminderMinutes: event.checkInReminderMinutes,
    checkInCompletedAt: instance.occurrence?.checkInCompletedAt,
    attendanceStatus: instance.status,
    attendanceNote: instance.occurrence?.attendanceNote,
  }));
}

/**
 * Detects scheduling and travel buffer overlaps between active events
 */
export function detectEventConflicts(
  occurrences: {
    id: string;
    eventId: string;
    title: string;
    startTime: Date;
    endTime: Date;
    travelBufferMinutes: number;
  }[]
): EventConflict[] {
  const conflicts: EventConflict[] = [];

  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      const a = occurrences[i];
      const b = occurrences[j];

      // Exact time overlap
      const aStart = a.startTime.getTime();
      const aEnd = a.endTime.getTime();
      const bStart = b.startTime.getTime();
      const bEnd = b.endTime.getTime();

      const overlapsDirectly = aStart < bEnd && bStart < aEnd;
      if (overlapsDirectly) {
        conflicts.push({
          eventId1: a.eventId,
          eventTitle1: a.title,
          eventId2: b.eventId,
          eventTitle2: b.title,
          conflictType: 'overlap',
          explanation: `"${a.title}" and "${b.title}" overlap in time.`,
        });
        continue;
      }

      // Travel buffer check
      // Check if A ends right before B starts, but travel buffer exceeds gap
      if (aEnd <= bStart) {
        const gapMinutes = (bStart - aEnd) / (1000 * 60);
        if (gapMinutes < a.travelBufferMinutes) {
          conflicts.push({
            eventId1: a.eventId,
            eventTitle1: a.title,
            eventId2: b.eventId,
            eventTitle2: b.title,
            conflictType: 'travel_buffer',
            explanation: `Only ${Math.round(gapMinutes)}m between "${a.title}" and "${b.title}", but travel buffer is ${a.travelBufferMinutes}m.`,
          });
        }
      } else if (bEnd <= aStart) {
        const gapMinutes = (aStart - bEnd) / (1000 * 60);
        if (gapMinutes < b.travelBufferMinutes) {
          conflicts.push({
            eventId1: b.eventId,
            eventTitle1: b.title,
            eventId2: a.eventId,
            eventTitle2: a.title,
            conflictType: 'travel_buffer',
            explanation: `Only ${Math.round(gapMinutes)}m between "${b.title}" and "${a.title}", but travel buffer is ${b.travelBufferMinutes}m.`,
          });
        }
      }
    }
  }

  return conflicts;
}
