'use client';

import {useEffect, useRef, useState} from 'react';
import {useTravelRequest} from './use-travel-request';
import type {Mode, Point, RouteResult} from './types';

type Target = {id: string; point: Point | null; mode: Mode; arriveAt?: string};
type State = {context: string; status: 'loading' | 'ready' | 'error'; result?: RouteResult; from?: Point};

/** Calendar and place selection initiate routing; no separate trip form. */
export function useAutomaticRoute(target: Target | null, origin: Point | null) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const latest = useRef({target, origin});
  latest.current = {target, origin};
  const context = JSON.stringify([target?.id, target?.point?.lat, target?.point?.lon,
    target?.mode, target?.arriveAt, origin?.lat, origin?.lon]);
  const begin = useTravelRequest(context);
  useEffect(() => {
    const refresh = () => {if (document.visibilityState === 'visible') setRevision(value => value + 1);};
    const timer = setInterval(refresh, 120000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh);};
  }, []);
  useEffect(() => {
    const {target, origin} = latest.current;
    if (!target?.point || !origin) {setState(null); return;}
    const request = begin();
    let cancelled = false;
    setState(previous => previous?.context === context ? {...previous, status: 'loading'} : {context, status: 'loading'});
    void (async () => {
      try {
        const response = await fetch('/api/travel/route', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({origin, destination: target.point, travelMode: target.mode, arriveAt: target.arriveAt}), signal: request.signal});
        if (!response.ok) throw new Error('Route unavailable');
        const result = await response.json() as RouteResult;
        if (!result.routes?.length) throw new Error('No routes');
        if (!cancelled && request.current()) setState({context, status: 'ready', from: origin,
          result: {...result, routes: [...result.routes].sort((a, b) => a.durationSeconds - b.durationSeconds)}});
      } catch {
        if (!cancelled && request.current()) setState({context, status: 'error'});
      }
    })();
    return () => {cancelled = true;};
  }, [context, begin, revision]);
  return {state: state?.context === context ? state : null, refresh: () => setRevision(value => value + 1)};
}
