import test from 'node:test';
import assert from 'node:assert/strict';
import {freshLocation,LOCATION_MAX_AGE} from '../lib/travel/location-fix.ts';
import {currentTravelNotice} from '../lib/travel/live-notice.ts';
import type {ScheduledTrip} from '../lib/travel/scheduled-trips.ts';
const now=Date.parse('2026-10-24T14:00:00Z');
const fix={point:{lat:34.6,lon:-83.7},recordedAt:now,accuracy:15};
const trip:ScheduledTrip={id:'occurrence',eventId:'event',title:'Synthetic appointment',address:'Synthetic destination',startTime:new Date(now+40*60000),endTime:new Date(now+60*60000),destination:{lat:34.7,lon:-83.8},bufferMinutes:15};
const route={durationSeconds:1800,delaySeconds:0,distanceMeters:1000,historicSeconds:null,points:[fix.point,trip.destination!]};
test('only fresh, accurate, finite device fixes are accepted',()=>{
 assert.equal(freshLocation(fix,now),fix);
 for(const invalid of [null,{...fix,recordedAt:now-LOCATION_MAX_AGE},{...fix,recordedAt:now+11000},{...fix,accuracy:1000},{...fix,accuracy:-1},{...fix,point:{lat:NaN,lon:0}},{...fix,point:{lat:91,lon:0}}])assert.equal(freshLocation(invalid,now),null);
});
test('live departure notices are scoped to the reporting device and expire with its GPS fix',()=>{
 const notice=currentTravelNotice(trip,route,fix,'owner','phone','America/New_York',now,false)!;
 assert.equal(notice.kind,'leave_now');assert.equal(notice.expires,now+LOCATION_MAX_AGE);
 assert.match(notice.message.body,/this device’s recent location/);assert.match(notice.message.url,/account=owner/);
 assert.notEqual(notice.key,currentTravelNotice(trip,route,fix,'owner','desktop','America/New_York',now,false)!.key);
 assert.equal(currentTravelNotice(trip,route,fix,'owner','phone','America/New_York',now+LOCATION_MAX_AGE),null);
 const privateNotice=currentTravelNotice(trip,route,fix,'owner','phone','America/New_York',now,true)!;
 assert.doesNotMatch(privateNotice.message.body,/Synthetic|34\.6|83\.7|30 min/);
});
test('there are no premature, expired, or malformed current-location notices',()=>{
 assert.equal(currentTravelNotice({...trip,startTime:new Date(now+3*3600000)},route,fix,'owner','phone','America/New_York',now),null);
 assert.equal(currentTravelNotice({...trip,startTime:new Date(now)},route,fix,'owner','phone','America/New_York',now),null);
 assert.equal(currentTravelNotice(trip,{...route,durationSeconds:NaN},fix,'owner','phone','America/New_York',now),null);
});
