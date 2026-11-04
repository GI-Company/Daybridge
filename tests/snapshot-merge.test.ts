import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshots,snapshotEqual} from '../lib/storage/merge-snapshots.ts';
const event={id:'event',title:'Appointment',startTime:'2026-11-05T10:00:00',location:'Original'};
test('stale devices take newer cloud values and merge independent fields and record additions',()=>{
 const base={events:[event],tasks:[],profile:{name:'Owner',timezone:'UTC'}};
 const device={...base,events:[{...event,location:'Device-only venue'}],tasks:[{id:'local',title:'Local task'}]};
 const cloud={...base,events:[{...event,startTime:'2026-11-05T11:00:00'},{id:'phone',title:'New phone appointment'}],profile:{name:'Owner',timezone:'America/New_York'}};
 const merged=mergeSnapshots(base,device,cloud);assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.payload.events,[{...event,startTime:'2026-11-05T11:00:00',location:'Device-only venue'},{id:'phone',title:'New phone appointment'}]);assert.deepEqual(merged.payload.tasks,device.tasks);assert.deepEqual(merged.payload.profile,cloud.profile);
});
test('remote deletions are not resurrected by stale devices; delete/edit collisions need a choice',()=>{
 const base={events:[event]};assert.deepEqual(mergeSnapshots(base,base,{events:[]}).payload,{events:[]});
 const collision=mergeSnapshots(base,{events:[{...event,title:'Local title'}]},{events:[]});assert.deepEqual(collision.conflicts,['events.event']);assert.deepEqual(mergeSnapshots(base,{events:[{...event,title:'Local title'}]},{events:[]},'cloud').payload,{events:[]});
});
test('conflicting same-field edits are identified and resolution does not erase independent edits',()=>{
 const base={events:[event],tasks:[]};const left={events:[{...event,title:'Mac'}],tasks:[{id:'local'}]};const right={events:[{...event,title:'Phone',location:'Phone address'}],tasks:[]};
 assert.deepEqual(mergeSnapshots(base,left,right).conflicts,['events.event.title']);const result=mergeSnapshots(base,left,right,'cloud');assert.deepEqual(result.payload.events,right.events);assert.deepEqual(result.payload.tasks,left.tasks);
});
test('nested sticky pages merge independently and changed dose schedules do not silently duplicate',()=>{
 const base={noteBooklets:[{id:'book',pages:[{id:'one',content:'Old'},{id:'two',content:'Old'}]}],medicationSchedules:[{id:'s',medicationId:'m',timeOfDay:'08:00'}]};
 const left=structuredClone(base),right=structuredClone(base);left.noteBooklets[0].pages[0].content='Mac';right.noteBooklets[0].pages[1].content='Phone';
 assert.deepEqual(mergeSnapshots(base,left,right).conflicts,[]);
 left.medicationSchedules[0].timeOfDay='09:00';right.medicationSchedules[0].timeOfDay='10:00';assert.deepEqual(mergeSnapshots(base,left,right).conflicts,['medicationSchedules.m']);
});
test('concurrent ledger and dose edits reconcile derived totals, deduplicate slots, and never mutate inputs',()=>{
 const base={accounts:[{id:'a',balanceCents:1000}],transactions:[],medications:[{id:'m',inventoryCount:10}],medicationLogs:[]};
 const left={accounts:[{id:'a',balanceCents:900}],transactions:[{id:'one',accountId:'a',amountCents:-100}],medications:[{id:'m',inventoryCount:9}],medicationLogs:[{id:'l',medicationId:'m',scheduledSlotUtc:'2026-11-03T08:00:00Z',action:'taken',inventoryDelta:-1}]};
 const right={accounts:[{id:'a',balanceCents:800}],transactions:[{id:'two',accountId:'a',amountCents:-200}],medications:[{id:'m',inventoryCount:9}],medicationLogs:[{id:'r',medicationId:'m',scheduledSlotUtc:'2026-11-03T12:00:00Z',action:'taken',inventoryDelta:-1}]};
 const copy=structuredClone({base,left,right}),result=mergeSnapshots(base,left,right);assert.deepEqual(result.conflicts,[]);assert.equal((result.payload.accounts as typeof left.accounts)[0].balanceCents,700);assert.equal((result.payload.medications as typeof left.medications)[0].inventoryCount,8);assert.deepEqual({base,left,right},copy);
 const same={...right,medicationLogs:[{...left.medicationLogs[0],id:'different-id'}]};const once=mergeSnapshots(base,left,same);assert.equal((once.payload.medicationLogs as unknown[]).length,1);assert.equal((once.payload.medications as typeof left.medications)[0].inventoryCount,9);
 assert.ok(snapshotEqual({x:1,y:undefined},{x:1}));
});
