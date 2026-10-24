import type {CalendarEvent, EventOccurrence, SavedPlace} from '../types';
import {expandEventOccurrences} from '../recurrence.ts';
import {validMapPoint} from './geometry.ts';
import type {Mode, Point} from './types';

export type ScheduledTrip = {
  id: string; eventId: string; title: string; address: string;
  startTime: Date; endTime: Date; destination: Point | null;
  travelMode?: Mode; bufferMinutes: number; timezone?: string;
};
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function eventDestination(event: CalendarEvent, places: SavedPlace[]): Point | null {
  const point = {lat: event.destinationLat, lon: event.destinationLon};
  if (validMapPoint(point)) return point;
  if (!event.location?.trim()) return null;
  const address = normalize(event.location);
  const matches = places.filter(place => validMapPoint(place) &&
    (normalize(place.address) === address || normalize(place.label) === address));
  // Never guess among places sharing a name but having different addresses.
  if (!matches.length || matches.some(place => place.lat !== matches[0].lat || place.lon !== matches[0].lon)) return null;
  return {lat: matches[0].lat, lon: matches[0].lon};
}

/** Use the same occurrence expansion as Schedule, including its saved exceptions. */
export function scheduledTrips(events: CalendarEvent[], occurrences: EventOccurrence[], places: SavedPlace[], now: Date): ScheduledTrip[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return events.filter(event => event.venueType === 'in_person').flatMap(event =>
    expandEventOccurrences(event, start, end, occurrences).filter(occurrence =>
      Number.isFinite(occurrence.startTime.getTime()) && Number.isFinite(occurrence.endTime.getTime()) &&
      occurrence.endTime > now && occurrence.attendanceStatus === 'unconfirmed'
    ).map(occurrence => ({
      id: occurrence.id, eventId: event.id, title: occurrence.title,
      address: event.location?.trim() ?? '', startTime: occurrence.startTime, endTime: occurrence.endTime,
      destination: eventDestination(event, places), travelMode: event.travelMode,
      bufferMinutes: Math.max(0, event.travelBufferMinutes || 0), timezone:event.timezone
    }))
  ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
