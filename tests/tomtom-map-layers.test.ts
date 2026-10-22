import test from 'node:test';
import assert from 'node:assert/strict';
import {orbisRasterTileUrl} from '../lib/travel/map-layers.ts';

test('uses v2 Orbis endpoints without leaking API keys',()=>{
 const streets=orbisRasterTileUrl('streets',12,1000,2000);
 assert.equal(streets.pathname,'/maps/orbis/display/raster/tile/12/1000/2000');
 assert.equal(streets.searchParams.get('style'),'street-light');
 assert.equal(streets.searchParams.get('apiVersion'),'2');
 assert.equal(streets.searchParams.get('key'),null);
 const flow=orbisRasterTileUrl('flow',12,1000,2000);
 assert.equal(flow.pathname,'/maps/orbis/traffic/flow/raster/tile/12/1000/2000');
 const incidents=orbisRasterTileUrl('incidents',12,1000,2000);
 assert.equal(incidents.pathname,'/maps/orbis/traffic/incidents/raster/tile/12/1000/2000');
});
test('supports dark styles as an optional alternative',()=>{
 const a=orbisRasterTileUrl('streets',8,80,120,'dark');
 const b=orbisRasterTileUrl('incidents',8,80,120,'dark');
 assert.equal(a.searchParams.get('style'),'street-dark');
 assert.equal(b.searchParams.get('style'),'dark');
});
test('rejects out-of-grid and noninteger coordinates',()=>{
 assert.throws(()=>orbisRasterTileUrl('flow',2,4,2),/Invalid/);
 assert.throws(()=>orbisRasterTileUrl('streets',-1,0,0),/Invalid/);
 assert.throws(()=>orbisRasterTileUrl('incidents',7,20.4,1),/Invalid/);
 assert.throws(()=>orbisRasterTileUrl('flow',10,0,-1),/Invalid/);
});
