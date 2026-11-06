import test from 'node:test';
import assert from 'node:assert/strict';
import {staffCreateInput,staffResetInput,staffPasswordInput} from '../lib/admin/staff-input.ts';
const court_id='a1000000-0000-4000-8000-000000000001';
test('staff credential requests cannot pick passwords, aliases or owner claims',()=>{
 const create={court_id,username:'Manager',role:'coordinator'};
 assert.equal(staffCreateInput.parse(create).username,'manager');
 for(const input of [{...create,password:'picked'},{...create,email:'owner@example.invalid'},{...create,role:'owner'},{...create,app_metadata:{daybridge_platform_owner:true}},{...create,username:'manager@other.court'}])assert.equal(staffCreateInput.safeParse(input).success,false);
 assert.equal(staffResetInput.safeParse({court_id,user_id:court_id}).success,true);
 assert.equal(staffResetInput.safeParse({court_id,user_id:court_id,password:'picked'}).success,false);
});
test('staff password setup requires proof of current password and a different strong replacement',()=>{
 assert.equal(staffPasswordInput.safeParse({court_id,password:'different-password'}).success,false);
 assert.equal(staffPasswordInput.safeParse({court_id,current_password:'same-password',password:'same-password'}).success,false);
 assert.equal(staffPasswordInput.safeParse({court_id,current_password:'temporary-value',password:'new-private-password'}).success,true);
});
