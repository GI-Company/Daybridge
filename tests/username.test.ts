import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_ALIAS_DOMAIN, normalizedUsername, usernameToAuthEmail} from '../lib/auth/username.ts';

test('admin username maps deterministically to a non-mailbox Auth identity',()=>{
 assert.equal(usernameToAuthEmail('Taylor_01'),`taylor_01@${AUTH_ALIAS_DOMAIN}`);
 assert.equal(usernameToAuthEmail('  Alpha-9  '),`alpha-9@${AUTH_ALIAS_DOMAIN}`);
});
test('rejects full email identifiers and malformed usernames',()=>{
 for(const value of ['a','ab','alice@example.com','.admin','two words','user.name','bad!','a'.repeat(33),'']) {
  assert.equal(usernameToAuthEmail(value),null,value);
 }
});
test('username mapping does not accidentally normalize away allowed uniqueness',()=>{
 assert.equal(normalizedUsername(' TeSt_02 '),'test_02');
 assert.notEqual(usernameToAuthEmail('test_02'),usernameToAuthEmail('test-02'));
});
