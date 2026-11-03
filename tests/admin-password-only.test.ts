import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync('lib/admin/courts.ts','utf8');
const portal=readFileSync('components/admin/AdminPortal.tsx','utf8');
test('court authentication still requires trusted Supabase identity and court membership',()=>{
  assert.match(server,/browserSession\.auth\.getUser\(\)/);
  assert.match(server,/eq\('court_id',courtId\)/);
  assert.match(server,/eq\('user_id',user\.id\)/);
  assert.match(server,/courtStaffAuthEmail/);
});
test('portal authenticates through Supabase password login and loads scoped court accounts',()=>{
  assert.match(portal,/auth\.signInWithPassword/);
  assert.match(portal,/api\/admin\/participants\?court_id/);
});
