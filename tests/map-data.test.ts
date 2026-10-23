import test from 'node:test';
import assert from 'node:assert/strict';
import {placesData, routeData, originData} from '../lib/travel/map-data.ts';
import type {Route} from '../lib/travel/types';

const route = (points: Route['points']): Route => ({points, durationSeconds: 300, delaySeconds: 0, distanceMeters: 1200, historicSeconds: null});
test('map data contains only valid places and marks the selected destination', () => {
  const data = placesData([{id: 'ok', label: 'Clinic', lat: 34, lon: -83}, {id: 'bad', label: 'Bad', lat: NaN, lon: -83}], 'ok');
  assert.equal(data.features.length, 1);
  assert.equal(data.features[0].properties?.selected, true);
  assert.deepEqual(data.features[0].geometry.coordinates, [-83, 34]);
});
test('missing road geometry never fabricates a straight-line route', () => {
  assert.equal(routeData(null).features.length, 0);
  assert.equal(routeData(route([])).features.length, 0);
  assert.equal(routeData(route([{lat: 34, lon: -83}])).features.length, 0);
});
test('long road geometry is preserved through the destination', () => {
  const points = Array.from({length: 2500}, (_, i) => ({lat: 34 + i / 10000, lon: -83}));
  const line = routeData(route(points)).features[0].geometry.coordinates;
  assert.equal(line.length, 2500);
  assert.deepEqual(line.at(-1), [-83, points.at(-1)!.lat]);
});
test('clearing an origin removes its map marker', () => {
  assert.equal(originData(null).features.length, 0);
  assert.equal(originData({lat: NaN, lon: -83}).features.length, 0);
  assert.deepEqual(originData({lat: 34, lon: -83}).features[0].geometry.coordinates, [-83, 34]);
});
