'use client';

import {Navigation} from 'lucide-react';
import type {MapPlace} from '../../lib/travel/map-data';
import type {ScheduledTrip} from '../../lib/travel/scheduled-trips';
import {leaveBy, mapsUrl, type Mode, type Point, type RouteResult} from '../../lib/travel/types';

type Props = {
  trip: ScheduledTrip | null; destination: MapPlace | null; origin: Point | null; originLabel: string;
  result: RouteResult | null; status?: 'loading' | 'ready' | 'error'; mode: Mode; now: Date;
  index: number; onChoose: (index: number) => void; onRefresh: () => void;
  onOpenSchedule?: () => void; navigationEnabled: boolean;
};

export function TripDetails({trip, destination, origin, originLabel, result, status, mode, now,
  index, onChoose, onRefresh, onOpenSchedule, navigationEnabled}: Props) {
  const best = result?.routes[index] ?? result?.routes[0];
  const navigation = destination ? new URL('https://www.google.com/maps/dir/') : null;
  if (navigation && destination) {
    navigation.searchParams.set('api', '1'); navigation.searchParams.set('destination', destination.lat + ',' + destination.lon);
    navigation.searchParams.set('travelmode', mode === 'car' ? 'driving' : mode === 'bicycle' ? 'bicycling' : 'walking');
  }
  const time = (date: Date) => date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
  return <section className="space-y-3 rounded-2xl border border-teal-200 bg-white p-4" aria-label="Trip details">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{trip ? 'From your calendar' : destination ? 'Selected place' : 'Calendar travel'}</p>
      <h3 className="mt-1 font-bold text-slate-950">{trip?.title ?? destination?.label ?? 'No upcoming in-person trips'}</h3>
      {trip && <p className="mt-1 text-sm text-slate-700">{trip.startTime.toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}{trip.address ? ' · ' + trip.address : ''}</p>}
      {destination && <p className="mt-1 text-xs text-slate-600">From {originLabel} · {mode === 'car' ? 'Driving' : mode === 'bicycle' ? 'Cycling' : 'Walking'}</p>}
    </div>
    {!trip && !destination && <p className="text-sm text-slate-700">In-person appointments in the next 14 days appear here automatically. Add their destinations in Schedule.</p>}
    {trip && !destination && <p role="status" className="text-sm text-amber-900">Verify this appointment’s destination in Schedule to calculate its route automatically.</p>}
    {destination && !origin && <p role="status" className="text-sm text-slate-700">Use my location on the map, or approve a starting location in Travel settings. The route will load automatically.</p>}
    {status === 'loading' && <p role="status" className="text-sm text-teal-900">Checking your route and traffic…</p>}
    {status === 'error' && <p role="status" className="text-sm text-amber-900">The route could not be loaded. Check your connection and retry.</p>}
    {navigationEnabled && navigation && <a href={navigation.toString()} target="_blank" rel="noopener noreferrer"
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-teal-300 p-3 text-sm font-semibold text-teal-900">
      <Navigation aria-hidden="true" className="h-4 w-4"/>Open navigation to {destination!.label}
    </a>}
    {best && result && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Route alternatives">
        {result.routes.map((route, i) => <button type="button" key={i} aria-pressed={i === index} onClick={() => onChoose(i)}
          className={'min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold ' + (i === index ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-300 text-slate-800')}>
          {i === 0 ? 'Fastest' : 'Alternative ' + i} · {Math.ceil(route.durationSeconds / 60)} min
        </button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
        <p><strong>Travel</strong><br/>{Math.ceil(best.durationSeconds / 60)} minutes</p>
        <p><strong>Traffic delay</strong><br/>{Math.ceil(best.delaySeconds / 60)} minutes</p>
        <p><strong>Distance</strong><br/>{(best.distanceMeters / 1609.344).toFixed(1)} miles</p>
        <p><strong>{result.basis === 'historical' && trip ? 'Planned arrival' : 'Arrival if leaving now'}</strong><br/>
          {time(result.basis === 'historical' && trip ? new Date(trip.startTime.getTime() - trip.bufferMinutes * 60000) : new Date(now.getTime() + best.durationSeconds * 1000))}</p>
        {trip && <p className="col-span-2"><strong>Leave by</strong><br/>{leaveBy(trip.startTime.toISOString(), best.durationSeconds, trip.bufferMinutes).toLocaleString([], {weekday: 'short', hour: 'numeric', minute: '2-digit'})} · {trip.bufferMinutes} min early</p>}
      </div>
      <p className="text-xs text-slate-600">{result.basis === 'historical' ? 'Traffic forecast for this appointment' : 'Current traffic estimate'}. Updates automatically while this screen is open.</p>
      {navigationEnabled && origin && destination && <div className="flex flex-wrap gap-2">
        <a target="_blank" rel="noopener noreferrer" href={mapsUrl('google', origin, destination, mode)} className="min-h-[44px] rounded-xl bg-teal-800 px-3 py-3 text-sm font-semibold text-white">Google Maps</a>
        <a target="_blank" rel="noopener noreferrer" href={mapsUrl('apple', origin, destination, mode)} className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-800">Apple Maps</a>
      </div>}
      {!!best.instructions?.length && <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Turn-by-turn route instructions</summary>
        <ol className="mt-2 max-h-64 list-decimal space-y-2 overflow-auto pl-5 text-sm text-slate-700">{best.instructions.map((item, i) => <li key={i}>{item}</li>)}</ol>
      </details>}
    </>}
    <div className="flex flex-wrap gap-3">
      {destination && origin && <button type="button" onClick={onRefresh} disabled={status === 'loading'} className="min-h-[44px] text-sm font-semibold text-teal-900 underline disabled:opacity-50">{status === 'error' ? 'Retry route' : 'Refresh traffic'}</button>}
      {onOpenSchedule && <button type="button" onClick={onOpenSchedule} className="min-h-[44px] text-sm font-semibold text-teal-900 underline">Open Schedule</button>}
    </div>
  </section>;
}
