import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAccountMovement} from '../lib/budget-ledger.ts';
import type {BudgetAccount} from '../lib/types.ts';

const when='2026-10-22T15:00:00.000Z';
const fixture:BudgetAccount[]=[
 {id:'checking',userId:'user',name:'Checking',accountType:'checking',balanceCents:2500,lastConfirmedAt:'2026-10-01T00:00:00Z',isActive:true},
 {id:'cash',userId:'user',name:'Cash',accountType:'cash',balanceCents:400,lastConfirmedAt:'2026-10-01T00:00:00Z',isActive:true}
];
test('income adds exact cents to the selected account only',()=>{
 const updated=applyAccountMovement(fixture,'checking',12575,when);
 assert.equal(updated[0].balanceCents,15075);
 assert.equal(updated[1].balanceCents,400);
 assert.equal(updated[0].lastConfirmedAt,when);
 assert.equal(fixture[0].balanceCents,2500);
});
test('expense deducts exact cents and reverse restores original balance',()=>{
 const spent=applyAccountMovement(fixture,'cash',-199,when);
 assert.equal(spent[1].balanceCents,201);
 const reversed=applyAccountMovement(spent,'cash',199,when);
 assert.equal(reversed[1].balanceCents,400);
});
test('no manual transaction is silently assigned to a different account',()=>{
 assert.throws(()=>applyAccountMovement(fixture,'unknown',500,when),/active account/);
 assert.throws(()=>applyAccountMovement(fixture,'checking',0,when),/Invalid ledger/);
});
