import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTravelImpact,summarizeTrafficUpdate} from '../lib/travel/traffic-impact.ts';

const now=Date.UTC(2026,9,22,14,0);
const start=now+3600000;
const input={travelSeconds:1800,delaySeconds:300,priorTravelSeconds:1500,priorDelaySeconds:120,
 nowMs:now,startMs:start,arrivalBufferMinutes:15,routeOptions:3};

test('traffic updates detect a meaningful total travel ETA shift',()=>{
 const risk=assessTravelImpact(input);
 assert.equal(risk.etaShiftSeconds,300);
 assert.equal(risk.trafficShiftSeconds,180);
 assert.equal(risk.meaningfulChange,true);
 assert.equal(risk.leaveByMs,start-45*60000);
 assert.equal(risk.appointmentAtRisk,false);
 assert.match(summarizeTrafficUpdate(risk,1800,300,3,'America/New_York'),/Travel time increased about 5 min/);
});

test('a small drift does not trigger an ETA-change notification',()=>{
 const risk=assessTravelImpact({...input,travelSeconds:1590,delaySeconds:270});
 assert.equal(risk.meaningfulChange,false);
});

test('late risk is based on leaving now from saved origin, not an assumed live GPS fix',()=>{
 const risk=assessTravelImpact({...input,nowMs:start-10*60000,travelSeconds:1500});
 assert.equal(risk.appointmentAtRisk,true);
 assert.equal(risk.lateForAppointmentMinutes,15);
 assert.match(summarizeTrafficUpdate(risk,1500,300,1,'America/New_York'),/could mean arriving 15 min late/);
});

test('traffic-delay changes do not falsely claim an ETA change',()=>{
 const risk=assessTravelImpact({...input,travelSeconds:1500,priorTravelSeconds:1500,delaySeconds:650,priorDelaySeconds:100});
 assert.equal(risk.etaShiftSeconds,0);
 assert.equal(risk.meaningfulChange,true);
 assert.doesNotMatch(summarizeTrafficUpdate(risk,1500,650,1,'America/New_York'),/Travel time decreased/);
});

test('early-arrival buffer risk is separate from an actual late appointment',()=>{
 const risk=assessTravelImpact({...input,nowMs:start-30*60000,travelSeconds:1200,priorTravelSeconds:null,priorDelaySeconds:null});
 assert.equal(risk.appointmentAtRisk,false);
 assert.equal(risk.earlyArrivalAtRisk,true);
 assert.equal(risk.meaningfulChange,false);
});
