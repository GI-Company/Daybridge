import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDestination, scheduledTrips} from '../lib/travel/scheduled-trips.ts';
import type {CalendarEvent, EventOccurrence, SavedPlace} from '../lib/types';

const now = new Date('2026-10-22T09:00:00');
function event(id: string, at: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {id, userId: 'test', title: id, category: 'work', description: '', startTime: at,
    endTime: new Date(new Date(at).getTime() + 3600000).toISOString(), timezone: 'America/New_York',
    venueType: 'in_person', location: 'Work', travelBufferMinutes: 15, prepChecklist: [],
    createdAt: '', updatedAt: '', ...extra};
}
const saved: SavedPlace = {id: 'work', userId: 'test', label: 'Work', category: 'work',
  address: '123 Test Street', lat: 34.6, lon: -83.7, createdAt: '', updatedAt: ''};
const exception = (eventId: string, status: EventOccurrence['attendanceStatus'], extra: Partial<EventOccurrence> = {}): EventOccurrence => ({
  id: 'exception-' + eventId, eventId, userId: 'test', startTimeUtc: '2026-10-22T10:00:00',
  endTimeUtc: '2026-10-22T11:00:00', attendanceStatus: status, isException: true, ...extra
});

test('calendar trips are ordered automatically and omit finished or remote events', () => {
  const trips = scheduledTrips([
    event('later', '2026-10-22T12:00:00'), event('next', '2026-10-22T10:00:00'),
    event('past', '2026-10-22T07:00:00'), event('online', '2026-10-22T09:30:00', {venueType: 'virtual'})
  ], [], [saved], now);
  assert.deepEqual(trips.map(trip => trip.eventId), ['next', 'later']);
  assert.deepEqual(trips[0].destination, {lat: saved.lat, lon: saved.lon});
  assert.equal(trips[0].bufferMinutes, 15);
});
test('a verified event destination works without a saved place', () => {
  assert.deepEqual(eventDestination(event('clinic', '2026-10-22T10:00:00', {destinationLat: 35, destinationLon: -84}), []), {lat: 35, lon: -84});
});
test('place matching ignores case and whitespace but never guesses ambiguous names', () => {
  assert.deepEqual(eventDestination(event('shift', '2026-10-22T10:00:00', {location: ' WORK '}), [saved]), {lat: saved.lat, lon: saved.lon});
  assert.equal(eventDestination(event('shift', '2026-10-22T10:00:00'), [saved, {...saved, id: 'other', lat: 35}]), null);
});
test('unverified next appointment is surfaced for correction rather than silently skipped', () => {
  const trips = scheduledTrips([event('verify me', '2026-10-22T10:00:00', {location: 'Unknown address'}),
    event('later', '2026-10-22T12:00:00')], [], [saved], now);
  assert.equal(trips[0].title, 'verify me'); assert.equal(trips[0].destination, null);
});
test('cancelled, attended and explicitly missed occurrences do not create trips', () => {
  for (const status of ['cancelled', 'attended_self_reported', 'not_attended_self_reported'] as const) {
    assert.equal(scheduledTrips([event('work', '2026-10-22T10:00:00')], [exception('work', status)], [saved], now).length, 0);
  }
});
test('weekly appointments use the calendar occurrence time and its edits', () => {
  const recurring = event('weekly', '2026-10-15T10:00:00', {rrule: 'FREQ=WEEKLY;BYDAY=TH', travelMode: 'bicycle'});
  const trips = scheduledTrips([recurring], [exception('weekly', 'unconfirmed', {
    overrideStartTime: '2026-10-22T11:30:00', overrideEndTime: '2026-10-22T12:30:00'
  })], [saved], now);
  assert.equal(trips[0].startTime.getHours(), 11); assert.equal(trips[0].startTime.getMinutes(), 30);
  assert.equal(trips[0].travelMode, 'bicycle');
});
test('editing or deleting events changes the next automatic trip', () => {
  const early = event('early', '2026-10-22T10:00:00'); const later = event('later', '2026-10-22T12:00:00');
  assert.equal(scheduledTrips([early, later], [], [saved], now)[0].eventId, 'early');
  assert.equal(scheduledTrips([event('early', '2026-10-22T14:00:00'), later], [], [saved], now)[0].eventId, 'later');
  assert.deepEqual(scheduledTrips([], [], [saved], now), []);
});
