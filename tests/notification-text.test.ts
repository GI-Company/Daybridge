import test from 'node:test';
import assert from 'node:assert/strict';
import {travelNotificationText,type TravelNotificationInput} from '../lib/travel/notification-text.ts';

const appt=Date.UTC(2026,9,22,18,30,0); // 2:30 PM Eastern
const leave=Date.UTC(2026,9,22,17,42,0); // 1:42 PM Eastern
const base:TravelNotificationInput={
 kind:'preparation',startMs:appt,leaveByMs:leave,
 nowMs:Date.UTC(2026,9,22,17,30,0),
 travelSeconds:1980,delaySeconds:0,priorTravelSeconds:1980,
 timezone:'America/New_York',arrivedLateMinutes:0,routeOptions:2,
 privacyMode:true,destinationName:'1988 Tom Bell Road, Cleveland, GA',departed:false
};
test('one-hour traffic push contains actionable departure, duration and delay',()=>{
 const {title,body}=travelNotificationText(base);
 assert.match(title,/leave by 1:42 PM/);
 assert.match(body,/33 min trip/);
 assert.match(body,/traffic \+0 min/);
 assert.match(body,/1:42 PM/);
 assert.doesNotMatch(title+body,/Cornerstone|therapy|street address/i);
});
test('leave-now alert includes ETA and can be acknowledged without opening app',()=>{
 const result=travelNotificationText({...base,kind:'leave_now',nowMs:Date.UTC(2026,9,22,17,42)});
 assert.match(result.title,/Leave now/);
 assert.match(result.body,/estimated arrival 2:15 PM/);
 assert.match(result.body,/On my way/);
});
test('risk alert says possibly late, never verified late or current GPS position',()=>{
 const result=travelNotificationText({...base,kind:'traffic_change',
   nowMs:Date.UTC(2026,9,22,18,1),arrivedLateMinutes:4});
 assert.match(result.title,/Possible late arrival/);
 assert.match(result.body,/if departing now from your approved start/);
 assert.doesNotMatch(result.body,/GPS confirmed|location verified/);
});
test('after acknowledging departure, traffic changes continue without stale-position ETA claims',()=>{
 const result=travelNotificationText({...base,kind:'traffic_change',departed:true,
  travelSeconds:2400,priorTravelSeconds:1980});
 assert.match(result.body,/\+7 min since last check/);
 assert.match(result.body,/Current-position ETA requires active guidance/);
 assert.doesNotMatch(result.body,/Tap On my way/);
});

test('opt-in detailed mode includes the destination, private mode does not',()=>{
 const privateText=travelNotificationText(base).body;
 const detailed=travelNotificationText({...base,privacyMode:false}).body;
 assert.doesNotMatch(privateText,/Tom Bell Road/);
 assert.match(detailed,/Tom Bell Road/);
});
