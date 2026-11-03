import test from 'node:test';
import assert from 'node:assert/strict';
import {courtStaffAuthEmail,resolveCourtStaffLogin} from '../lib/auth/court-staff.ts';

const scope={state_code:'GA',circuit_slug:'enotah',court_slug:'starcourt'};
test('state, judicial circuit and court produce the exact staff Auth identity',()=>{
  assert.equal(courtStaffAuthEmail('Admin_01','GA','enotah','starcourt'),'admin_01@ga.enotah.starcourt');
  assert.equal(resolveCourtStaffLogin('Admin_01',scope),'admin_01@ga.enotah.starcourt');
  assert.equal(resolveCourtStaffLogin('ADMIN_01@GA.ENOTAH.STARCOURT',scope),'admin_01@ga.enotah.starcourt');
});
test('wrong state, circuit, court or generic email are refused',()=>{
  for(const email of ['admin_01@fl.enotah.starcourt','admin_01@ga.other.starcourt',
     'admin_01@ga.enotah.anothercourt','admin_01@gmail.com']){
    assert.equal(resolveCourtStaffLogin(email,scope),null,email);
  }
});
test('invalid staff names or court slugs are rejected',()=>{
  for(const user of ['x','two words','admin@example.com','x'.repeat(40)])
    assert.equal(courtStaffAuthEmail(user,'GA','enotah','starcourt'),null);
  assert.equal(courtStaffAuthEmail('admin','GA','enotah','bad.court'),null);
  assert.equal(courtStaffAuthEmail('admin','Georgia','enotah','starcourt'),null);
  assert.equal(courtStaffAuthEmail('admin','GA','','starcourt'),null);
});
