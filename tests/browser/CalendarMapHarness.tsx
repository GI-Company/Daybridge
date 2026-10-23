'use client';
import {useState} from 'react';
import {LocationsContent} from '../../components/travel/LocationsView';
import type {CalendarEvent, EventOccurrence, SavedPlace} from '../../lib/types';
import {defaults} from '../../lib/travel/types';

const saved: SavedPlace[] = [
  {id: 'work', userId: 'test', label: 'Work', category: 'work', address: '123 Test St', lat: 34.6, lon: -83.7, createdAt: '', updatedAt: ''},
  {id: 'therapy', userId: 'test', label: 'Therapy', category: 'therapy', address: '456 Test St', lat: 34.61, lon: -83.71, createdAt: '', updatedAt: ''}
];
function fixtureEvents(): CalendarEvent[] {
  return saved.map((place, index) => ({id: place.id, userId: 'test', title: place.label + ' appointment', category: 'work', description: '',
    startTime: new Date(Date.now() + (index + 1) * 3600000).toISOString(), endTime: new Date(Date.now() + (index + 1.5) * 3600000).toISOString(),
    timezone: 'America/New_York', venueType: 'in_person', location: place.address, travelBufferMinutes: 15,
    travelMode: index === 1 ? 'bicycle' : 'car', prepChecklist: [], createdAt: '', updatedAt: ''}));
}

export function CalendarMapHarness() {
  const [events, setEvents] = useState(fixtureEvents);
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([]);
  const [places, setPlaces] = useState(saved);
  const [originEnabled, setOriginEnabled] = useState(true);
  const [opened, setOpened] = useState('');
  return <>
    <div className="flex flex-wrap gap-3 p-3">
      <button onClick={() => setEvents(value => value.map(event => event.id === 'work' ? {...event,
        startTime: new Date(Date.now() + 4 * 3600000).toISOString(), endTime: new Date(Date.now() + 5 * 3600000).toISOString()} : event))}>Reschedule work</button>
      <button onClick={() => setOccurrences([{id: 'cancelled', eventId: 'work', userId: 'test', startTimeUtc: events[0].startTime,
        endTimeUtc: events[0].endTime, attendanceStatus: 'cancelled', isException: true}])}>Cancel work</button>
      <button onClick={() => setEvents([])}>Clear schedule</button>
      <button onClick={() => setEvents(value => value.map(event => event.id === 'work' ? {...event, location: 'Unknown address'} : event))}>Unverify work</button>
      <button onClick={() => setOriginEnabled(false)}>Current location only</button>
      <p data-testid="opened-schedule">{opened}</p>
    </div>
    <LocationsContent events={events} eventOccurrences={occurrences} savedPlaces={places} syncStatus="synced"
      addSavedPlace={input => setPlaces(value => [...value, {...input, id: 'new', userId: 'test', createdAt: '', updatedAt: ''}])}
      updateSavedPlace={(id, updates) => setPlaces(value => value.map(place => place.id === id ? {...place, ...updates} : place))}
      deleteSavedPlace={id => setPlaces(value => value.filter(place => place.id !== id))}
      preferences={{...defaults, saved_origin_label: 'Approved test home', saved_origin_lat: originEnabled ? 34.59 : null, saved_origin_lon: originEnabled ? -83.72 : null}}
      onOpenSchedule={date => setOpened(date ?? 'today')}/>
  </>;
}
