import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signOutBlockReason} from '../lib/auth/sign-out.ts';

test('sign out permits only fully synced sessions with no unfinished draft',()=>{
 assert.equal(signOutBlockReason('synced',false),null);
 for(const state of ['device_saved','local_only','syncing','offline'] as const){
  assert.match(signOutBlockReason(state,false)??'',/not fully synced/);
 }
 assert.match(signOutBlockReason('synced',true)??'',/unfinished form/);
 assert.match(signOutBlockReason('device_saved',true)??'',/unfinished form/);
});
test('DayBridge signs out this device through Supabase and exposes the control in Settings',()=>{
 const card=readFileSync('components/common/SignOutCard.tsx','utf8');
 const settings=readFileSync('components/settings/SettingsView.tsx','utf8');
 assert.match(card,/auth\.signOut\(\{scope:'local'\}\)/);
 assert.match(card,/window\.location\.replace\('\/'\)/);
 assert.match(card,/signOutBlockReason/);
 assert.match(settings,/<SignOutCard\s*\/>/);
 assert.doesNotMatch(card,/clearAllUserData|resetToDefaults|localStorage\.clear/);
});
