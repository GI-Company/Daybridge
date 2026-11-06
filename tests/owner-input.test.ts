import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerSetupInput} from '../lib/admin/owner-input.ts';
import {suggestedLoginSlug} from '../lib/admin/owner-types.ts';
const input={action:'create',state_code:'GA',state_name:'Georgia',circuit_name:'Circuit One',circuit_slug:'circuit-one',court_name:'Beta Court',court_slug:'beta-court',seat_limit:25,is_demo:true,listed:false};
test('owner forms reject privilege fields, invalid seats, identifiers, and alias-changing updates',()=>{
 assert.equal(ownerSetupInput.safeParse(input).success,true);
 for(const change of [{seat_limit:0},{seat_limit:2.5},{seat_limit:100001},{court_slug:'bad@alias'},{state_code:'GA.other'},{owner:true},{action:'grant_owner'}])assert.equal(ownerSetupInput.safeParse({...input,...change}).success,false);
 assert.equal(ownerSetupInput.safeParse({action:'update',court_id:'a1000000-0000-4000-8000-000000000001',court_name:'Beta Court',seat_limit:25,subscription_status:'pilot',listed:false,enabled:true,court_slug:'changed'}).success,false);
 assert.equal(suggestedLoginSlug('Enotah Judicial Circuit'),'enotah-judicial-circuit');
 assert.equal(suggestedLoginSlug('  Côte Court  '),'cote-court');
});
