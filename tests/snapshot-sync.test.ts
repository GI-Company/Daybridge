import test from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotSync,type RemoteSnapshot,type SyncState} from '../lib/storage/snapshot-sync.ts';
import type {DeviceSnapshot} from '../lib/storage/device-cache.ts';
import type {Snapshot} from '../lib/storage/merge-snapshots.ts';
const clone=<T>(value:T):T=>structuredClone(value);
function setup(initial:RemoteSnapshot={payload:{events:[{id:'event',title:'Old',time:'10:00'}],tasks:[]},revision:1},device:DeviceSnapshot|null=null){
 let cloud=clone(initial),cache=device?clone(device):null,view:Snapshot={},state:SyncState|undefined,online=true;
 const history=new Map<number,Snapshot>([[cloud.revision,clone(cloud.payload)]]),recoveries:DeviceSnapshot[]=[];
 let failWrite=false,beforeSave:(()=>void)|undefined;
 const sync=new SnapshotSync({transport:{read:async()=>clone(cloud),history:async revision=>clone(history.get(revision)??null),save:async(payload,revision)=>{beforeSave?.();beforeSave=undefined;if(revision!==cloud.revision)throw Error('snapshot_conflict');history.set(cloud.revision,clone(cloud.payload));cloud={payload:clone(payload),revision:cloud.revision+1};return cloud.revision;}},readDevice:async()=>cache,writeDevice:async value=>{if(failWrite)throw Error('blocked');cache=clone(value);},backup:async value=>{recoveries.push(clone(value));},normalize:value=>value,apply:value=>{view=clone(value);},notify:value=>{state=value;},online:()=>online});
 return {sync,get cloud(){return cloud;},get cache(){return cache;},get view(){return view;},get state(){return state;},recoveries,history,setCloud(payload:Snapshot){history.set(cloud.revision,clone(cloud.payload));cloud={payload:clone(payload),revision:cloud.revision+1};},setOnline(value:boolean){online=value;},failWrites(){failWrite=true;},race(fn:()=>void){beforeSave=fn;}};
}
test('a clean open workspace adopts newer cloud records without a reload or write-back',async()=>{
 const s=setup();await s.sync.start();s.setCloud({events:[{id:'event',title:'From phone'}],tasks:[{id:'new'}]});await s.sync.sync();assert.deepEqual(s.view,s.cloud.payload);assert.equal(s.cloud.revision,2);assert.equal(s.cache?.dirty,false);assert.equal(s.state?.status,'synced');
});
test('legacy dirty cache recovers its base from history and merges into the latest phone data',async()=>{
 const base={events:[{id:'event',title:'Old'}],tasks:[]};const local={...base,tasks:[{id:'local',title:'Unsent Mac task'}]};
 const s=setup({payload:{events:[{id:'event',title:'New phone'}],tasks:[]},revision:2},{payload:local,revision:1,dirty:true,updatedAt:1});s.history.set(1,base);await s.sync.start();assert.deepEqual(s.cloud.payload,{events:[{id:'event',title:'New phone'}],tasks:local.tasks});assert.equal(s.state?.status,'synced');assert.ok(s.cache?.basePayload);
});
test('a save race retries against the current version without dropping either side',async()=>{
 const s=setup();await s.sync.start();s.sync.stage({...s.view,tasks:[{id:'local'}]});s.race(()=>s.setCloud({events:[{id:'event',title:'Phone update'}],tasks:[]}));await s.sync.sync();assert.deepEqual(s.cloud.payload,{events:[{id:'event',title:'Phone update'}],tasks:[{id:'local'}]});assert.equal(s.state?.status,'synced');
});
test('same-field conflicts preserve a separate encrypted recovery copy and can use newer cloud values',async()=>{
 const s=setup();await s.sync.start();s.sync.stage({events:[{id:'event',title:'Mac',time:'10:00'}],tasks:[{id:'local'}]});s.setCloud({events:[{id:'event',title:'Phone',time:'11:00'}],tasks:[]});await s.sync.sync();assert.equal(s.state?.conflict,true);assert.equal(s.recoveries.length,1);await s.sync.prepareSignOut();assert.equal(s.cache?.dirty,true);assert.deepEqual(s.cloud.payload.events,[{id:'event',title:'Phone',time:'11:00'}]);await s.sync.sync('cloud');assert.deepEqual(s.cloud.payload,{events:[{id:'event',title:'Phone',time:'11:00'}],tasks:[{id:'local'}]});assert.equal(s.state?.conflict,false);assert.equal(s.state?.status,'synced');
});
test('missing legacy history requires a choice, and storage failures block session exit',async()=>{
 const s=setup({payload:{tasks:[{id:'phone'}]},revision:9},{payload:{tasks:[{id:'mac'}]},revision:3,dirty:true,updatedAt:1});await s.sync.start();assert.equal(s.state?.conflict,true);assert.equal(s.cloud.revision,9);await s.sync.sync('cloud');assert.deepEqual(s.view,{tasks:[{id:'phone'}]});assert.equal(s.recoveries.length,1);s.failWrites();await assert.rejects(s.sync.prepareSignOut());
});
test('offline changes remain durable through sign-out preparation and merge on reconnection',async()=>{
 const s=setup();await s.sync.start();s.setOnline(false);s.sync.stage({...s.view,tasks:[{id:'offline'}]});await s.sync.prepareSignOut();assert.equal(s.cache?.dirty,true);s.setCloud({events:[{id:'event',title:'Updated elsewhere'}],tasks:[]});s.setOnline(true);await s.sync.sync();assert.deepEqual(s.cloud.payload.tasks,[{id:'offline'}]);assert.deepEqual(s.cloud.payload.events,[{id:'event',title:'Updated elsewhere'}]);
});
