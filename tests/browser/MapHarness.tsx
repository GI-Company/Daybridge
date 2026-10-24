'use client';
import {useEffect,useState} from 'react';
import {ExploreMap, type MapPlace} from '../../components/travel/ExploreMap';
import {RouteMap} from '../../components/travel/RouteMap';
import type {Route} from '../../lib/travel/types';
import {useTravelRequest} from '../../lib/travel/use-travel-request';
import {NotificationsHarness} from './NotificationsHarness';
import {StorageHarness,LockHarness,AuthHarness,UpdateHarness} from './SecurityHarness';
import {CheckInHarness} from './CheckInHarness';
import {CalendarMapHarness} from './CalendarMapHarness';

const places: MapPlace[] = [
  {id: 'clinic', label: 'Test clinic', lat: 34.598, lon: -83.763},
  {id: 'class', label: 'Test class', lat: 34.603, lon: -83.758}
];
const origin = {lat: 34.592, lon: -83.772};
const routes: Route[] = [
  {durationSeconds: 300, delaySeconds: 30, distanceMeters: 1200, historicSeconds: null,
    points: [origin, {lat: 34.592, lon: -83.763}, places[0]]},
  {durationSeconds: 350, delaySeconds: 10, distanceMeters: 1400, historicSeconds: null,
    points: [origin, {lat: 34.598, lon: -83.772}, places[0]]}
];

export default function MapHarness() {
  const [selected, setSelected] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [appointment, setAppointment] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [position, setPosition] = useState('No position');
  const [requestResult, setRequestResult] = useState('No result');
  const beginRequest = useTravelRequest(selected ?? '');
  const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
  if(!ready)return <main>Loading test harness…</main>;
  if (typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('notifications')==='test')return <NotificationsHarness/>;
  if(typeof window!=='undefined'){const security=new URLSearchParams(window.location.search).get('security');if(security==='storage')return <StorageHarness/>;if(security==='lock')return <LockHarness/>;if(security==='auth')return <AuthHarness/>;if(security==='update')return <UpdateHarness/>;}
  if(new URLSearchParams(window.location.search).get('checkin')==='test')return <CheckInHarness/>;
  if (calendar) return <main className="mx-auto max-w-4xl p-3"><CalendarMapHarness/></main>;
  return <main className="mx-auto max-w-4xl space-y-3 p-3">
    <button onClick={() => setSelected('clinic')}>Select clinic</button>{' '}
    <button onClick={() => {setSelected('clinic'); setRoute(routes[0]);}}>Show route</button>{' '}
    <button onClick={() => setRoute(routes[1])}>Alternative route</button>{' '}
    <button onClick={() => {setSelected('class'); setRoute(null);}}>Change destination</button>{' '}
    <button onClick={() => setAppointment(value => !value)}>Toggle appointment map</button>
    <button onClick={() => setCalendar(true)}>Show calendar map</button>
    <button onClick={() => {
      const request = beginRequest();
      setRequestResult('Pending');
      void fetch('/test-delayed-route', {signal: request.signal}).then(response => response.text()).then(result => {
        if (request.current()) setRequestResult(result);
      }).catch(() => undefined);
    }}>Start delayed route</button>
    <p data-testid="request-result">{requestResult}</p>
    <p data-testid="position">{position}</p>
    <p data-testid="selection">{selected ?? 'No selection'}</p>
    {appointment ? <RouteMap origin={origin} destination={places[0]} route={route ?? routes[0]}/> :
      <ExploreMap initialCenter={places[0]} initialZoom={14} areaLabel="Browser test area"
        places={places} selectedId={selected} origin={route ? origin : null} route={route}
        onSelectPlace={place => setSelected(place.id)} onLocate={point => setPosition(point.lat + ',' + point.lon)}/>}
  </main>;
}
