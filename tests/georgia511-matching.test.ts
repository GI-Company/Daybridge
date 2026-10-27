import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGeorgiaEvents,eventsNearRoute,distanceToRoute} from '../lib/travel/georgia511-matching.ts';
const now=Date.UTC(2026,9,27);
const input={ID:123,Latitude:34.6,Longitude:-83.75,RoadwayName:'US 129',DirectionOfTravel:'Northbound',
 Description:'One lane blocked.',EventType:'accidentsAndIncidents',IsFullClosure:true,StartDate:now/1000-100,
 PlannedEndDate:now/1000+3600,LastUpdated:now/1000};
const route=[{lat:34.59,lon:-83.75},{lat:34.61,lon:-83.75}];
test('parses live Georgia 511 events with documented casing',()=>{
 const events=parseGeorgiaEvents([input,{...input,ID:124,PlannedEndDate:now/1000-1},{...input,ID:125,StartDate:now/1000+3600}],now);
 assert.equal(events.length,1);
 assert.equal(events[0].id,'123');
 assert.equal(events[0].fullClosure,true);
 assert.equal(events[0].direction,'Northbound');
});
test('reports incidents near the actual route geometry, not just a destination',()=>{
 const events=parseGeorgiaEvents([input,{...input,ID:456,Latitude:34.8,Longitude:-83.6}],now);
 const found=eventsNearRoute(events,route);
 assert.deepEqual(found.map(x=>x.id),['123']);
 assert.ok(distanceToRoute({lat:34.6,lon:-83.75},route)<1);
});
test('bounds failures and inputs safely',()=>{
 assert.throws(()=>parseGeorgiaEvents({events:[]},now));
 assert.equal(parseGeorgiaEvents([{...input,Latitude:999,Longitude:0}],now).length,0);
 assert.deepEqual(eventsNearRoute([],route),[]);
 assert.deepEqual(eventsNearRoute(parseGeorgiaEvents([input],now),[]),[]);
});
