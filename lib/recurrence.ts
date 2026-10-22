import { CalendarEvent, EventOccurrence } from './types';

export interface EventConflict {
  eventId1: string;
  eventTitle1: string;
  eventId2: string;
  eventTitle2: string;
  conflictType: 'overlap' | 'travel_buffer';
  explanation: string;
}

/**
 * Expands an event over a given date range (start to end) according to simple or RFC 5545 RRULE.
 * Generates materialized occurrence instances.
 */
export function expandEventOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  existingOccurrences: EventOccurrence[] = []
): {
  id: string;
  eventId: string;
  userId: string;
  title: string;
  category: CalendarEvent['category'];
  startTime: Date;
  endTime: Date;
  venueType: CalendarEvent['venueType'];
  location?: string;
  meetingUrl?: string;
  travelBufferMinutes: number;
  prepChecklist: CalendarEvent['prepChecklist'];
  attendanceStatus: EventOccurrence['attendanceStatus'];
  attendanceNote?: string;
}[] {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  const durationMs = eventEnd.getTime() - eventStart.getTime();

  const occurrences = [];

  // Check if non-recurring
  if (!event.rrule) {
    if (eventStart >= rangeStart && eventStart <= rangeEnd) {
      const matchOcc = existingOccurrences.find((o) => o.eventId === event.id);
      occurrences.push({
        id: matchOcc ? matchOcc.id : `occ-${event.id}-${eventStart.getTime()}`,
        eventId: event.id,
        userId: event.userId,
        title: matchOcc?.overrideTitle || event.title,
        category: event.category,
        startTime: matchOcc?.overrideStartTime ? new Date(matchOcc.overrideStartTime) : eventStart,
        endTime: matchOcc?.overrideEndTime ? new Date(matchOcc.overrideEndTime) : eventEnd,
        venueType: event.venueType,
        location: event.location,
        meetingUrl: event.meetingUrl,
        travelBufferMinutes: event.travelBufferMinutes,
        prepChecklist: event.prepChecklist,
        attendanceStatus: matchOcc ? matchOcc.attendanceStatus : 'unconfirmed',
        attendanceNote: matchOcc?.attendanceNote,
      });
    }
    return occurrences;
  }

  // Parse recurrence rule, e.g. "FREQ=WEEKLY;BYDAY=WE" or "FREQ=WEEKLY;INTERVAL=1"
  const isWeekly = event.rrule.includes('FREQ=WEEKLY');
  const dayMatch = event.rrule.match(/BYDAY=([A-Z,]+)/);
  const targetDays: number[] = [];

  if (dayMatch && dayMatch[1]) {
    const dayMap: Record<string, number> = {
      SU: 0,
      MO: 1,
      TU: 2,
      WE: 3,
      TH: 4,
      FR: 5,
      SA: 6,
    };
    dayMatch[1].split(',').forEach((d) => {
      if (dayMap[d] !== undefined) targetDays.push(dayMap[d]);
    });
  } else {
    // Default to the day of the week of start_time
    targetDays.push(eventStart.getDay());
  }

  // Iterate day by day across the range
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  const endLimit = new Date(rangeEnd);
  endLimit.setHours(23, 59, 59, 999);

  while (cursor <= endLimit) {
    if (targetDays.includes(cursor.getDay())) {
      // Build occurrence preserving the local wall-clock hours and minutes
      const occStart = new Date(cursor);
      occStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0);

      // Only include occurrences after original start
      if (occStart.getTime() >= eventStart.getTime() - 60000) {
        const occEnd = new Date(occStart.getTime() + durationMs);

        // Find if user already customized this occurrence
        const matchOcc = existingOccurrences.find((o) => {
          if (o.eventId !== event.id) return false;
          const oStart = new Date(o.startTimeUtc);
          return Math.abs(oStart.getTime() - occStart.getTime()) < 3600000; // within 1 hour match
        });

        occurrences.push({
          id: matchOcc ? matchOcc.id : `occ-${event.id}-${occStart.getTime()}`,
          eventId: event.id,
          userId: event.userId,
          title: matchOcc?.overrideTitle || event.title,
          category: event.category,
          startTime: matchOcc?.overrideStartTime ? new Date(matchOcc.overrideStartTime) : occStart,
          endTime: matchOcc?.overrideEndTime ? new Date(matchOcc.overrideEndTime) : occEnd,
          venueType: event.venueType,
          location: event.location,
          meetingUrl: event.meetingUrl,
          travelBufferMinutes: event.travelBufferMinutes,
          prepChecklist: event.prepChecklist,
          attendanceStatus: matchOcc ? matchOcc.attendanceStatus : 'unconfirmed',
          attendanceNote: matchOcc?.attendanceNote,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
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
