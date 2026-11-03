import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usernameToAuthEmail} from '../lib/auth/username.ts';

// Source-level regression checks: real hosted authorization and isolation
// tests with signed sessions are still required before pilot activation.
const sql=readFileSync('supabase/migrations/20261103040000_daybridge_court_admin.sql','utf8');
const api=readFileSync('app/api/admin/participants/route.ts','utf8');
const auth=readFileSync('lib/admin/courts.ts','utf8');
const page=readFileSync('components/admin/AdminPortal.tsx','utf8');
const landing=readFileSync('components/common/InstallGate.tsx','utf8');
const firstUse=readFileSync('app/api/account/complete-onboarding/route.ts','utf8');

test('court tables enable RLS and deny browser table access',()=>{
  for(const table of ['daybridge_states','daybridge_judicial_circuits','daybridge_courts','daybridge_court_staff','daybridge_court_participants','daybridge_court_audit']){
    assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
  }
  assert.match(sql,/revoke all on public\.daybridge_states,[\s\S]+from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.daybridge_assign_participant[\s\S]+to service_role/i);
  assert.match(sql,/grant execute on function public\.daybridge_transition_participant[\s\S]+to service_role/i);
});

test('admin API requires signed-in identity, staff role, and MFA',()=>{
  assert.match(auth,/browserSession\.auth\.getUser\(\)/);
  assert.match(auth,/getAuthenticatorAssuranceLevel\(\)/);
  assert.match(auth,/currentLevel!=='aal2'/);
  assert.match(auth,/eq\('court_id',courtId\)/);
  assert.match(auth,/eq\('user_id',user\.id\)/);
  assert.match(api,/requireCourtAdmin\(court_id\)/);
  assert.match(api,/readPrivateJSON\(request\)/);
});

test('three-tier court hierarchy has unique parent keys and sample seed',()=>{
  assert.match(sql,/daybridge_judicial_circuits[\s\S]*?references public\.daybridge_states\(code\)/);
  assert.match(sql,/daybridge_courts[\s\S]*?references public\.daybridge_judicial_circuits\(id\)/);
  assert.match(sql,/unique \(state_code, name\)/);
  assert.match(sql,/unique \(circuit_id, court_name\)/);
  assert.match(sql,/values \('ZZ','Sample State'\)/);
  assert.match(sql,/values \('ZZ','Sample Judicial Circuit'\)/);
  assert.match(sql,/select c\.id, 'Sample Court',25,true,true,true/);
  assert.match(page,/name="state"/);
  assert.match(page,/name="judicial-circuit"/);
  assert.match(page,/name="court"/);
  assert.ok(page.indexOf('name="state"') < page.indexOf('name="judicial-circuit"'));
  assert.ok(page.indexOf('name="judicial-circuit"') < page.indexOf('name="court"'));
});

test('court seats use serialized database assignment',()=>{
  assert.match(sql,/for update/i);
  assert.match(sql,/v_count >= v_limit/);
  assert.match(api,/daybridge_assign_participant/);
});

test('admin API does not query private user content',()=>{
  assert.doesNotMatch(api,/private_snapshots|medication_logs|budget_accounts/);
  assert.doesNotMatch(page,/private_snapshots|medication_logs|budget_accounts/);
  assert.match(api,/\.eq\('court_id',court\.id\)/);
});

test('first-use password change happens before removing onboarding restriction',()=>{
  assert.match(firstUse,/db\.auth\.updateUser\(\{password:parsed\.data\.password\}\)/);
  const updatePos=firstUse.indexOf('db.auth.updateUser');
  const clearPos=firstUse.indexOf('service.auth.admin.updateUserById');
  assert.ok(updatePos>0&&clearPos>updatePos);
  assert.equal(usernameToAuthEmail('enotah-p001'),'enotah-p001@accounts.daybridge.example.com');
});

test('landing has a semantic footer link instead of embedded login',()=>{
  const footer=landing.slice(landing.indexOf('<footer className='));
  assert.match(footer,/<nav aria-label="Court staff access"/);
  assert.match(footer,/<a href="\/admin"/);
  assert.doesNotMatch(landing,/AdminPortalEntry/);
});
