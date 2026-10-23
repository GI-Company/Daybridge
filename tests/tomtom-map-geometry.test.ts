import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTomTomRoutePoints,validMapPoint} from '../lib/travel/geometry.ts';

const origin={lat:34.5964,lon:-83.7624};
const destination={lat:34.5618,lon:-83.7500};

test('normalizes TomTom Routing v1 latitude/longitude response',()=>{
 const raw=[
  {latitude:34.5964,longitude:-83.7624},
  {latitude:34.5800,longitude:-83.7590},
  {latitude:34.5618,longitude:-83.7500}
 ];
 const points=normalizeTomTomRoutePoints(raw);
 assert.deepEqual(points[1],{lat:34.5800,lon:-83.7590});
 assert.equal(points.length,3);
 assert.ok(points.every(validMapPoint));
 assert.deepEqual(points[0],origin);
 assert.deepEqual(points.at(-1),destination);
});

test('ignores missing or invalid routing points before rendering map',()=>{
 const points=normalizeTomTomRoutePoints([
  {latitude:34.59,longitude:-83.76},
  {latitude:null,longitude:-83.7},
  {latitude:NaN,longitude:Infinity},
  {latitude:91,longitude:0},
  {lat:34.56,lon:-83.75}
 ]);
 assert.equal(points.length,2);
 assert.ok(points.every(validMapPoint));
});
