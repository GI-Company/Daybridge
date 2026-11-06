import test from 'node:test';
import assert from 'node:assert/strict';
import {courtReadiness,ownerSummary} from '../lib/admin/owner-summary.ts';
import type {OwnerCourt,OwnerDirectory} from '../lib/admin/owner-types';
const court:OwnerCourt={id:'one',circuit_id:'circuit',court_name:'Court',login_slug:'court',seat_limit:25,occupied_seats:2,subscription_status:'pilot',listed:true,enabled:true,is_demo:false};
test('readiness distinguishes configuration from test status, missing staff, paused access and privacy',()=>{
 assert.equal(courtReadiness(court,0).label,'Needs staff');
 assert.equal(courtReadiness({...court,enabled:false},1).label,'Portal disabled');
 assert.equal(courtReadiness({...court,subscription_status:'paused'},1).label,'Enrollment paused');
 assert.equal(courtReadiness({...court,listed:false},1).label,'Not published');
 assert.equal(courtReadiness({...court,is_demo:true},1).label,'Test workspace');
 assert.equal(courtReadiness(court,1).label,'Configured');
 assert.match(courtReadiness(court,1).detail,/device and participant acceptance/);
});
test('dashboard totals use occupied seats, active assignments and per-court availability',()=>{
 const data:OwnerDirectory={states:[],circuits:[],courts:[court,{...court,id:'two',seat_limit:5,occupied_seats:5,enabled:false}],staff:[{court_id:'one',user_id:'one',username:'manager',role:'coordinator',active:true},{court_id:'two',user_id:'two',username:'revoked',role:'case_manager',active:false}]};
 const summary=ownerSummary(data);assert.equal(summary.occupied,7);assert.equal(summary.available,23);assert.equal(summary.activeStaff,1);assert.equal(summary.paused,1);assert.equal(summary.staffByCourt.get('two'),undefined);
});
