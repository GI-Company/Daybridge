import {mergeSnapshots,snapshotEqual,type Snapshot,type MergeChoice} from './merge-snapshots.ts';
import type {DeviceSnapshot} from './device-cache';
export type RemoteSnapshot={payload:Snapshot;revision:number};
export type SyncState={status:'synced'|'device_saved'|'syncing'|'offline';issue:string|null;conflict:boolean};
type Transport={read:()=>Promise<RemoteSnapshot>;history:(revision:number)=>Promise<Snapshot|null>;save:(payload:Snapshot,revision:number)=>Promise<number>};
type Options={transport:Transport|null;readDevice:()=>Promise<DeviceSnapshot|null>;writeDevice:(snapshot:DeviceSnapshot)=>Promise<void>;backup:(snapshot:DeviceSnapshot)=>Promise<void>;normalize:(payload:Snapshot)=>Snapshot;apply:(payload:Snapshot)=>void;notify:(state:SyncState)=>void;online:()=>boolean};
/** Serializes cloud reconciliation while local edits continue to stage durably. */
export class SnapshotSync {
 private base:RemoteSnapshot|null=null;
 private local:Snapshot={};
 private revision=0;
 private generation=0;
 private durableGeneration=-1;
 private writes:Promise<void>=Promise.resolve();
 private writeError=false;
 private work:Promise<void>|null=null;
 private requested=false;
 private stopped=false;
 private initialized=false;
 private conflict=false;
 private backupFingerprint='';
 private readonly options:Options;
 private nextChoice:MergeChoice|undefined;
 private writerId=crypto.randomUUID();
 constructor(options:Options){this.options=options;}
 current(){return this.local;}
 hasDurableCopy(){return this.initialized&&!this.writeError&&this.durableGeneration===this.generation;}
 private state(status:SyncState['status'],issue:string|null=null){if(!this.stopped)this.options.notify({status,issue,conflict:this.conflict});}
 private snapshot():DeviceSnapshot{return {payload:this.local,revision:this.base?.revision??this.revision,basePayload:this.base?.payload,dirty:!this.base||!snapshotEqual(this.local,this.base.payload),updatedAt:Date.now(),writerId:this.writerId};}
 private persist(){
  const value=this.snapshot(),generation=this.generation;
  const next=this.writes.catch(()=>undefined).then(()=>this.options.writeDevice(value));this.writes=next;
  return next.then(()=>{this.writeError=false;this.durableGeneration=generation;}).catch(error=>{this.writeError=true;this.state('offline','Device storage could not save your changes. Keep this workspace open and retry after restoring storage access.');throw error;});
 }
 private apply(value:Snapshot){if(!snapshotEqual(value,this.local)){this.local=value;this.generation++;this.options.apply(value);}}
 async start(){
  const device=await this.options.readDevice();if(this.stopped)return;
  if(device){this.local=this.options.normalize(device.payload);this.revision=device.revision;if(device.basePayload)this.base={payload:this.options.normalize(device.basePayload),revision:device.revision};else if(!device.dirty)this.base={payload:this.local,revision:device.revision};}
  if(!device&&this.options.transport&&this.options.online()){
   const remote=await this.options.transport.read();if(this.stopped)return;this.base={...remote,payload:this.options.normalize(remote.payload)};this.revision=remote.revision;this.local=this.base.payload;
  }else if(!device)throw Error('No cloud connection or encrypted device backup is available. Reconnect to load records safely.');
  this.initialized=true;this.options.apply(this.local);
  await this.persist();if(this.stopped)return;
  if(this.options.transport&&this.options.online())await this.sync();else this.state('device_saved','Showing the encrypted copy on this device. Changes will sync when connected.');
 }
 stage(value:Snapshot){
  if(this.stopped||!this.initialized||snapshotEqual(value,this.local))return;
  this.local=value;this.generation++;this.state('syncing');
  void this.persist().then(()=>{if(!this.options.online())this.state('device_saved','Changes are encrypted on this device and will sync when connected.');}).catch(()=>undefined);
 }
 async prepareSignOut(){
  // Do not wait for an unavailable network or a conflicting device. Require durable encryption.
  await this.persist();await this.writes;if(this.writeError)throw Error('Encrypted device saving failed. Keep this app open and retry before signing out.');
 }
 sync(choice?:MergeChoice):Promise<void>{
  if(this.stopped||!this.initialized)return Promise.resolve();
  if(choice)this.nextChoice=choice;
  if(this.work){this.requested=true;return this.work;}
  const resolution=this.nextChoice;this.nextChoice=undefined;
  this.work=this.reconcile(resolution).finally(()=>{this.work=null;if(this.requested&&!this.stopped){this.requested=false;void this.sync().catch(()=>undefined);}});
  return this.work;
 }
 private async protect(){
  const snapshot=this.snapshot(),fingerprint=JSON.stringify(snapshot.payload);
  if(fingerprint===this.backupFingerprint)return;
  await this.writes;await this.options.backup(snapshot);this.backupFingerprint=fingerprint;
 }
 private async reconcile(choice?:MergeChoice){
  if(!this.options.transport||!this.options.online()){this.state('device_saved','Changes are encrypted on this device and will sync when connected.');return;}
  try{
   for(let attempt=0;attempt<6&&!this.stopped;attempt++){
    const row=await this.options.transport.read();if(this.stopped)return;
    const remote={...row,payload:this.options.normalize(row.payload)};
    if(remote.revision<this.revision){this.state('device_saved','Waiting for the newest cloud revision. Your local changes are preserved.');return;}
    if(!this.base){
     if(remote.revision===this.revision)this.base=remote;
     else {const previous=await this.options.transport.history(this.revision);if(this.stopped)return;if(previous)this.base={payload:this.options.normalize(previous),revision:this.revision};}
    }
    if(this.base&&remote.revision===this.base.revision&&snapshotEqual(remote.payload,this.base.payload)&&snapshotEqual(this.local,this.base.payload)){this.conflict=false;this.state('synced');return;}
    let merged:Snapshot;
    if(!this.base){
     await this.protect();if(this.stopped)return;
     if(!choice){this.conflict=true;this.state('device_saved','This device has an older unsynced copy without a shared version. Choose the latest cloud copy to load your newer phone data. The device copy is kept encrypted for recovery.');return;}
     merged=choice==='cloud'?remote.payload:this.local;
    }else{
     const result=mergeSnapshots(this.base.payload,this.local,remote.payload,choice);
     if(result.conflicts.length){
      const generation=this.generation;await this.protect();if(this.stopped)return;if(generation!==this.generation)continue;
      if(!choice){this.conflict=true;this.state('device_saved',`${result.conflicts.length} field(s) were changed differently on two devices. Choose which conflicting values to keep; other changes merge automatically. An encrypted device recovery copy is retained.`);return;}
     }
     merged=result.payload;
    }
    this.conflict=false;this.base=remote;this.revision=remote.revision;this.apply(merged);
    const generation=this.generation;await this.persist();if(this.stopped)return;
    if(generation!==this.generation)continue;
    if(snapshotEqual(this.local,remote.payload)){this.state('synced');return;}
    const sending=this.local;
    let revision:number;
    try{revision=await this.options.transport.save(sending,remote.revision);}catch(error){if(error instanceof Error&&error.message.includes('snapshot_conflict'))continue;throw error;}
    if(this.stopped)return;
    if(!Number.isSafeInteger(revision)||revision<=remote.revision)throw Error('Invalid cloud revision');
    this.base={payload:sending,revision};this.revision=revision;
    await this.persist();if(this.stopped)return;
    if(snapshotEqual(this.local,sending)){this.state('synced');return;}
   }
   if(!this.stopped)this.state('device_saved','Another device is actively saving. Your changes are safe; synchronization will retry.');
  }catch(error){
   const message=error instanceof Error?error.message:'';
   const issue=message.includes('snapshot_too_large')?'Cloud records exceed the 2 MiB limit. Export a backup and reduce large notes. Your encrypted device copy is preserved.':message.includes('snapshot_rate_limited')?'Cloud save limit reached. Your encrypted device copy is preserved and will retry next minute.':'Cloud synchronization is temporarily unavailable. Your encrypted device copy is preserved and will retry automatically.';
   if(!this.stopped&&!this.writeError)this.state('device_saved',issue);
  }
 }
 stop(){this.stopped=true;}
}
