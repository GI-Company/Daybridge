import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTomTomRoutePoints,validMapPoint} from '../lib/travel/geometry.ts';
import {projectRoute} from '../lib/travel/projection.ts';

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
 const projected=projectRoute(points,origin,destination);
 assert.ok(Number.isFinite(projected.center.lat));
 assert.ok(Number.isFinite(projected.center.lon));
 assert.ok(Number.isInteger(projected.zoom));
 assert.ok(projected.zoom>=3&&projected.zoom<=17);
 assert.ok(!projected.line.includes('NaN'));
});

test('ignores missing or invalid routing points before projecting map',()=>{
 const points=normalizeTomTomRoutePoints([
  {latitude:34.59,longitude:-83.76},
  {latitude:null,longitude:-83.7},
  {latitude:NaN,longitude:Infinity},
  {latitude:91,longitude:0},
  {lat:34.56,lon:-83.75}
 ]);
 assert.equal(points.length,2);
 assert.equal(projectRoute(points,origin,destination).line.includes('NaN'),false);
});

test('route falls back to origin/destination when no point geometry exists',()=>{
 const result=projectRoute([],origin,destination);
 assert.ok(result.line.length>0);
 assert.equal(Number.isFinite(result.center.lat),true);
 assert.ok(result.start.x!==result.finish.x||result.start.y!==result.finish.y);
});
