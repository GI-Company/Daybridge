import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,leaveBy,mapsUrl} from '../lib/travel/types.ts';

test('private single-device travel defaults',()=>{
 assert.equal(defaults.navigation_enabled,true);
 assert.equal(defaults.traffic_notifications,true);
 assert.equal(defaults.origin_kind,'current');
 assert.equal(defaults.saved_origin_lat,null);
 assert.equal(defaults.saved_origin_lon,null);
 assert.equal(defaults.arrival_buffer_minutes,15);
 assert.equal(defaults.lockscreen_private,true);
});
test('15-minute buffer is subtracted exactly',()=>{
 assert.equal(leaveBy('2026-11-05T10:00:00Z',30*60,15).toISOString(),'2026-11-05T09:15:00.000Z');
});
test('zero-minute travel and buffer do not alter appointment time',()=>{
 assert.equal(leaveBy('2026-11-05T10:00:00Z',0,0).toISOString(),'2026-11-05T10:00:00.000Z');
});
test('navigation links do not auto-open until chosen',()=>{
 const from={lat:34.6,lon:-83.76},to={lat:34.57,lon:-83.75};
 const google=new URL(mapsUrl('google',from,to,'car'));
 assert.equal(google.hostname,'www.google.com');
 assert.equal(google.searchParams.get('travelmode'),'driving');
 assert.equal(google.searchParams.get('destination'),'34.57,-83.75');
 const apple=new URL(mapsUrl('apple',from,to,'pedestrian'));
 assert.equal(apple.hostname,'maps.apple.com');
 assert.equal(apple.searchParams.get('dirflg'),'w');
});
