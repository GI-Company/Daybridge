import type {Point, Route} from './types';
import {validMapPoint} from './geometry.ts';

export type MapPlace = Point & {id: string; label: string; address?: string};
export const mapCoordinate = (point: Point): [number, number] => [point.lon, point.lat];

export function placesData(places: MapPlace[], selectedId: string | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {type: 'FeatureCollection', features: places.filter(validMapPoint).map(place => ({
    type: 'Feature', properties: {id: place.id, label: place.label, selected: place.id === selectedId},
    geometry: {type: 'Point', coordinates: mapCoordinate(place)}
  }))};
}

export function routeData(route: Route | null): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const coordinates = (route?.points ?? []).filter(validMapPoint).map(mapCoordinate);
  // Never substitute a straight line for missing road geometry.
  return {type: 'FeatureCollection', features: coordinates.length < 2 ? [] : [{
    type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates}
  }]};
}

export function originData(origin: Point | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {type: 'FeatureCollection', features: origin && validMapPoint(origin) ? [{
    type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: mapCoordinate(origin)}
  }] : []};
}
