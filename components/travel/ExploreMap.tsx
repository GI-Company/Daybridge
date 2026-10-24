'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import type {GeoJSONSource, GeolocateControl, Map as MapLibreMap, Popup, RasterTileSource} from 'maplibre-gl';
import type {Point, Route} from '../../lib/travel/types';
import {validMapPoint} from '../../lib/travel/geometry';
import {loadMapRuntime} from '../../lib/travel/map-runtime';
import {mapCoordinate, originData, placesData, routeData, type MapPlace} from '../../lib/travel/map-data';

export type {MapPlace} from '../../lib/travel/map-data';
type Props = {
  initialCenter: Point; initialZoom: number; areaLabel: string;
  places: MapPlace[]; selectedId: string | null; origin: Point | null; route: Route | null;
  onSelectPlace: (place: MapPlace) => void;
  onLocate?: (point: Point) => void;
  onViewChange?: (point: Point) => void;
  compact?: boolean;
};
const overview: Point = {lat: 39.8283, lon: -98.5795};
const button = 'min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold';

function fitRoad(map: MapLibreMap, data: GeoJSON.FeatureCollection<GeoJSON.LineString>) {
  const points = data.features[0]?.geometry.coordinates;
  if (!points?.length) return;
  const bounds = points.reduce<[number, number, number, number]>((b, [x, y]) =>
    [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  map.fitBounds(bounds, {padding: 45, maxZoom: 15, duration: 300, linear: true});
}

export function ExploreMap(props: Props) {
  const {initialCenter, initialZoom, areaLabel, places, selectedId, origin, route, compact = false} = props;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geolocate = useRef<GeolocateControl | null>(null);
  const popup = useRef<Popup | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const interacted = useRef(false);
  const reloadStreets=useRef<(()=>void)|null>(null);
  const lastCamera=useRef('');
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showIncidents, setShowIncidents] = useState(false);
  const [mapError, setMapError] = useState('');
  const [overlayError, setOverlayError] = useState('');
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'current' | 'unavailable'>('idle');
  const markers = useMemo(() => placesData(places, selectedId), [places, selectedId]);
  const road = useMemo(() => routeData(route), [route]);
  const start = useMemo(() => originData(origin), [origin]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let refreshTraffic: ReturnType<typeof setInterval> | undefined;
    let removeOnline: (() => void) | undefined;
    lastCamera.current='';
    setReady(false); setTilesLoaded(false); setMapError(''); setOverlayError('');
    void (async () => {
      try {
        const runtime = await loadMapRuntime();
        if (cancelled || !host.current) return;
        const current = latest.current;
        const center = validMapPoint(current.initialCenter) ? current.initialCenter : overview;
        const m = new runtime.Map({
          container: host.current, center: mapCoordinate(center), zoom: current.initialZoom,
          minZoom: 2, maxZoom: 18, attributionControl: {compact: true},
          // Keep lower-resolution streets rendering while sharper tiles arrive.
          cancelPendingTileRequestsWhileZooming: false,
          style: {version: 8, sources: {
            streets: {type: 'raster', tiles: ['/api/travel/map-tile/{z}/{x}/{y}'], tileSize: 256,
              minzoom: 0, maxzoom: 18, attribution: '© TomTom'},
            flow: {type: 'raster', tiles: ['/api/travel/map-overlay/flow/{z}/{x}/{y}'], tileSize: 256,
              minzoom: 0, maxzoom: 18, attribution: '© TomTom Traffic'},
            incidents: {type: 'raster', tiles: ['/api/travel/map-overlay/incidents/{z}/{x}/{y}'], tileSize: 256,
              minzoom: 0, maxzoom: 18, attribution: '© TomTom Traffic'},
            places: {type: 'geojson', data: placesData(current.places, current.selectedId)},
            route: {type: 'geojson', data: routeData(current.route)},
            origin: {type: 'geojson', data: originData(current.origin)}
          }, layers: [
            {id: 'streets-layer', type: 'raster', source: 'streets'},
            {id: 'flow-layer', type: 'raster', source: 'flow', layout: {visibility: 'none'}, paint: {'raster-opacity': 0.85}},
            {id: 'incidents-layer', type: 'raster', source: 'incidents', layout: {visibility: 'none'}, paint: {'raster-opacity': 0.95}},
            {id: 'route-halo', type: 'line', source: 'route', layout: {'line-cap': 'round', 'line-join': 'round'},
              paint: {'line-color': '#ffffff', 'line-width': 9}},
            {id: 'route-line', type: 'line', source: 'route', layout: {'line-cap': 'round', 'line-join': 'round'},
              paint: {'line-color': '#00645f', 'line-width': 5}},
            {id: 'places-dots', type: 'circle', source: 'places', paint: {
              'circle-radius': ['case', ['get', 'selected'], 10, 7],
              'circle-color': ['case', ['get', 'selected'], '#b45309', '#086a62'],
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3}},
            {id: 'origin-dot', type: 'circle', source: 'origin', paint: {
              'circle-radius': 7, 'circle-color': '#2563eb', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3}}
          ]}
        });
        map = m; mapRef.current = m;
        m.addControl(new runtime.NavigationControl({showCompass: true}), 'top-right');
        m.addControl(new runtime.FullscreenControl(), 'top-right');
        m.addControl(new runtime.ScaleControl({unit: 'imperial'}));
        const location = new runtime.GeolocateControl({
          positionOptions: {enableHighAccuracy: true, maximumAge: 30000, timeout: 12000},
          trackUserLocation: true, showUserLocation: true, showAccuracyCircle: true
        });
        geolocate.current = location;
        m.addControl(location, 'top-right');
        location.on('geolocate', event => {
          if (cancelled) return;
          const point = {lat: event.coords.latitude, lon: event.coords.longitude};
          if (!validMapPoint(point)) return;
          interacted.current = true;
          setGpsState('current');
          latest.current.onLocate?.(point);
        });
        location.on('error', () => {if (!cancelled) setGpsState('unavailable');});
        m.on('load', () => {
          if (cancelled) return;
          setReady(true);
          const center = m.getCenter();
          latest.current.onViewChange?.({lat: center.lat, lon: center.lng});
          if (!latest.current.route && navigator.permissions) {
            void navigator.permissions.query({name: 'geolocation'}).then(permission => {
              if (!cancelled && !interacted.current && !latest.current.route && permission.state === 'granted') location.trigger();
            }).catch(() => undefined);
          }
        });
        let haveStreetContent=false,streetFailed=false;
        const loading=()=>{
          if(cancelled)return;
          setTilesLoaded(false);
          if(!watchdog)watchdog=setTimeout(()=>{
            watchdog=undefined;
            if(!cancelled)setMapError('Street imagery is taking too long to load. Check your connection and retry.');
          },20000);
        };
        const settled=()=>{
          if(cancelled||!haveStreetContent||!m.isSourceLoaded('streets'))return;
          setTilesLoaded(true);
          if(watchdog){clearTimeout(watchdog);watchdog=undefined;}
          // Another tile succeeding must not hide a failed street tile.
          if(!streetFailed)setMapError('');
        };
        reloadStreets.current=()=>{
          streetFailed=false;setMapError('');loading();m.refreshTiles('streets');
        };
        m.on('sourcedataloading',event=>{if(event.sourceId==='streets')loading();});
        m.on('sourcedata',event=>{
          if(event.sourceId!=='streets')return;
          if(event.tile?.state==='loaded')haveStreetContent=true;
          settled();
        });
        m.on('idle',settled);
        loading();
        m.on('error', event => {
          if (cancelled) return;
          const sourceId = (event as {sourceId?: string}).sourceId;
          const message = String(event.error?.message ?? '');
          if (sourceId === 'flow' || sourceId === 'incidents' || message.includes('/map-overlay/')) {
            setOverlayError('Traffic tiles could not be loaded. Retry traffic to request the layers again.');
          } else {
            streetFailed=true;
            if(watchdog){clearTimeout(watchdog);watchdog=undefined;}
            const status = (event.error as Error & {status?: number})?.status;
            setMapError(status === 401 ? 'Your session expired. Sign in again to load the map.' :
              status === 429 ? 'Map request limit reached. Wait a moment, then retry.' :
              'Map content could not be loaded. Check your connection, then retry the interactive map.');
          }
        });
        m.on('webglcontextlost', () => {
          if (!cancelled) setMapError('Graphics were interrupted. Waiting for the interactive map to recover…');
        });
        m.on('webglcontextrestored', () => {if (!cancelled) {setMapError(''); m.triggerRepaint();}});
        m.on('dragstart', event => {if (event.originalEvent) interacted.current = true;});
        m.on('zoomstart', event => {if (event.originalEvent) interacted.current = true;});
        m.on('moveend', () => {
          const center = m.getCenter();
          latest.current.onViewChange?.({lat: center.lat, lon: center.lng});
        });
        m.on('click', 'places-dots', event => {
          const id = event.features?.[0]?.properties?.id;
          const place = latest.current.places.find(item => item.id === id);
          if (place) latest.current.onSelectPlace(place);
        });
        m.on('mouseenter', 'places-dots', () => {m.getCanvas().style.cursor = 'pointer';});
        m.on('mouseleave', 'places-dots', () => {m.getCanvas().style.cursor = '';});
        observer = new ResizeObserver(() => m.resize());
        observer.observe(host.current);
        const refresh = () => {
          if (cancelled || !m.isStyleLoaded()) return;
          reloadStreets.current?.();
          for (const id of ['flow', 'incidents']) {
            const source = m.getSource(id);
            if (source?.type === 'raster') (source as RasterTileSource).setTiles([
              id === 'streets' ? '/api/travel/map-tile/{z}/{x}/{y}' : `/api/travel/map-overlay/${id}/{z}/{x}/{y}`
            ]);
          }
        };
        window.addEventListener('online', refresh);
        removeOnline = () => window.removeEventListener('online', refresh);
        refreshTraffic = setInterval(() => {
          if (document.visibilityState !== 'visible' || !m.isStyleLoaded()) return;
          for (const id of ['flow', 'incidents']) {
            if (m.getLayoutProperty(`${id}-layer`, 'visibility') !== 'visible') continue;
            const source = m.getSource(id);
            if (source?.type === 'raster') (source as RasterTileSource).setTiles([`/api/travel/map-overlay/${id}/{z}/{x}/{y}?refresh=${Math.floor(Date.now()/60000)}`]);
          }
        }, 60000);
      } catch (error) {
        if (!cancelled) setMapError(error instanceof Error && error.name === 'GPUInitializationError'
          ? 'Interactive maps require WebGL 2. Enable hardware acceleration in your browser, then retry.'
          : 'The interactive map could not start. Reload the map to try again.');
      }
    })();
    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      if (refreshTraffic) clearInterval(refreshTraffic);
      removeOnline?.(); observer?.disconnect(); popup.current?.remove(); popup.current = null;
      geolocate.current = null; reloadStreets.current=null;
      if (mapRef.current === map) mapRef.current = null;
      map?.remove();
    };
  }, [retry]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    let cancelled = false;
    (m.getSource('places') as GeoJSONSource).setData(markers);
    popup.current?.remove(); popup.current = null;
    const place = places.find(item => item.id === selectedId && validMapPoint(item));
    if (place) {
      void loadMapRuntime().then(({Popup}) => {
        if (cancelled || mapRef.current !== m) return;
        popup.current = new Popup({closeButton: false, offset: 15}).setLngLat(mapCoordinate(place))
          .setText(place.label).addTo(m);
      });

    }
    return () => {cancelled = true; popup.current?.remove(); popup.current = null;};
  }, [markers, places, selectedId, ready, route]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    (m.getSource('route') as GeoJSONSource).setData(road);
    (m.getSource('origin') as GeoJSONSource).setData(start);

  }, [road, start, ready]);

  useEffect(()=>{
    const m=mapRef.current;if(!m||!ready)return;
    const place=places.find(item=>item.id===selectedId&&validMapPoint(item));
    const key=road.features.length?JSON.stringify([selectedId,road.features[0].geometry.coordinates]):place?JSON.stringify([place.id,place.lat,place.lon]):'';
    if(!key||lastCamera.current===key)return;
    lastCamera.current=key;
    // One bounded camera movement replaces any obsolete destination animation.
    m.stop();
    if(road.features.length)fitRoad(m,road);
    else if(place)m.easeTo({center:mapCoordinate(place),zoom:Math.min(14,Math.max(12,m.getZoom())),duration:300});
  },[road,places,selectedId,ready]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    m.setLayoutProperty('flow-layer', 'visibility', showFlow ? 'visible' : 'none');
    m.setLayoutProperty('incidents-layer', 'visibility', showIncidents ? 'visible' : 'none');
  }, [showFlow, showIncidents, ready]);

  useEffect(() => {
    if (!ready || interacted.current || latest.current.route || latest.current.selectedId) return;
    const point = validMapPoint(initialCenter) ? initialCenter : overview;
    mapRef.current?.easeTo({center: mapCoordinate(point), zoom: initialZoom, duration:300});
  }, [initialCenter.lat, initialCenter.lon, initialZoom, ready]);

  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-label={compact ? 'TomTom route map' : 'Explore map'}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold text-slate-950">{compact ? 'Your route' : 'Explore the map'}</h3>
        <p className="text-xs text-slate-600">{gpsState === 'current' ? 'Live device location enabled' : areaLabel}</p></div>
      <div className="flex flex-wrap gap-2">
        {road.features.length > 0 && <button type="button" onClick={() => {if (mapRef.current) fitRoad(mapRef.current, road);}} disabled={!ready}
          className={`${button} border-teal-300 text-teal-900`}>Fit route</button>}
        <button type="button" disabled={!ready || gpsState === 'locating'} onClick={() => {
          setGpsState('locating'); geolocate.current?.trigger();
        }} className={`${button} border-teal-300 text-teal-900 disabled:opacity-60`}>
          {gpsState === 'locating' ? 'Locating…' : 'Use my location'}</button>
      </div>
    </div>
    {gpsState === 'unavailable' && <p role="status" className="text-xs text-amber-900">Location could not be obtained. Check location permission and try again.</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Map layers">
      <button type="button" aria-pressed={showFlow} onClick={() => {setShowFlow(value => !value); setOverlayError('');}}
        className={`${button} ${showFlow ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-300 text-slate-800'}`}>Traffic flow</button>
      <button type="button" aria-pressed={showIncidents} onClick={() => {setShowIncidents(value => !value); setOverlayError('');}}
        className={`${button} ${showIncidents ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-300 text-slate-800'}`}>Road incidents</button>
    </div>
    {overlayError && <div role="status" className="text-xs text-amber-900">{overlayError}{' '}
      <button type="button" className="min-h-[44px] underline" onClick={() => {
        const m = mapRef.current;
        for (const id of ['flow', 'incidents']) {
          const source = m?.getSource(id);
          if (source?.type === 'raster') (source as RasterTileSource).setTiles([`/api/travel/map-overlay/${id}/{z}/{x}/{y}?retry=${Date.now()}`]);
        }
        setOverlayError('');
      }}>Retry traffic</button></div>}
    <div className={`relative w-full overflow-hidden rounded-xl bg-slate-100 ${compact ? 'h-[320px]' : 'h-[360px] sm:h-[480px]'}`}>
      <div ref={host} style={{position: 'absolute', inset: 0}} role="region" aria-label="Interactive TomTom street map" aria-busy={!tilesLoaded&&!mapError}/>
      {mapError && <div role="alert" className="absolute inset-x-3 bottom-3 rounded-xl border border-amber-300 bg-white/95 p-3 text-sm text-slate-900">
        <p>{mapError}</p><button type="button" onClick={() => {if(reloadStreets.current)reloadStreets.current();else setRetry(value=>value+1);}}
          className="mt-2 min-h-[44px] rounded-lg bg-teal-800 px-3 py-2 font-semibold text-white">Retry interactive map</button>
      </div>}
      {!tilesLoaded && !mapError && <p role="status" className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800">Loading interactive map…</p>}
    </div>
    <p className="text-xs text-slate-600">Drag to explore, pinch or use + / − to zoom, and tap a place to select it. Location is used with your permission.</p>
  </section>;
}
