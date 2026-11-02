'use client';

import {useMemo} from 'react';
import type {Point, Route} from '../../lib/travel/types';
import {ExploreMap} from './ExploreMap';

export function RouteMap({origin, destination, route}: {origin: Point; destination: Point; route: Route}) {
  const places = useMemo(() => [{...destination, id: 'destination', label: 'Destination'}], [destination.lat, destination.lon]);
  return <ExploreMap compact initialCenter={origin} initialZoom={12}
    areaLabel="Traffic-aware appointment route" places={places} selectedId="destination"
    origin={origin} route={route} onSelectPlace={() => undefined}/>;
}
