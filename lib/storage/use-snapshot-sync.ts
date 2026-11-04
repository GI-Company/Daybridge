'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {SnapshotSync,type SyncState} from './snapshot-sync';
import {readDeviceSnapshot,writeDeviceSnapshot,writeDeviceRecovery,requestDurableStorage} from './device-cache';
import {snapshotEqual,type Snapshot,type MergeChoice} from './merge-snapshots';
export function useSnapshotSync({userId,backend,payload,normalize,apply}:{userId:string;backend:SupabaseClient|null;payload:Snapshot;normalize:(value:Snapshot)=>Snapshot;apply:(value:Snapshot)=>void}){
 const [loaded,setLoaded]=useState(false),[state,setState]=useState<SyncState>({status:'syncing',issue:null,conflict:false});
 const engine=useRef<SnapshotSync|null>(null),timer=useRef<number|null>(null);
 const applyRef=useRef(apply),normalizeRef=useRef(normalize),payloadRef=useRef(payload);
 applyRef.current=apply;normalizeRef.current=normalize;payloadRef.current=payload;
 useEffect(()=>{
  let active=true;
  const transport=backend?{
   async read(){
    const {data,error}=await backend.from('private_snapshots').select('payload,revision').eq('user_id',userId).maybeSingle();
    if(error)throw Error('Cloud read failed');return data?{payload:data.payload as Snapshot,revision:Number(data.revision)}:{payload:{},revision:0};
   },
   async history(revision:number){const {data,error}=await backend.from('private_snapshot_history').select('payload').eq('user_id',userId).eq('revision',revision).maybeSingle();if(error)return null;return data?.payload as Snapshot|null;},
   async save(value:Snapshot,revision:number){const {data,error}=await backend.rpc('save_private_snapshot_for_user',{p_user_id:userId,p_payload:value,p_expected_revision:revision});if(error)throw Error(error.message);return Number(data);}
  }:null;
  const sync=new SnapshotSync({transport,readDevice:()=>readDeviceSnapshot(userId),writeDevice:value=>writeDeviceSnapshot(userId,value),backup:value=>writeDeviceRecovery(userId,value),normalize:value=>normalizeRef.current(value),online:()=>navigator.onLine,
   apply:value=>{if(active){applyRef.current(value);setLoaded(true);}},notify:value=>{if(active)setState(value);}});
  engine.current=sync;
  const refresh=()=>{if(active&&document.visibilityState==='visible')void sync.sync();};
  void sync.start().then(()=>{if(active){void requestDurableStorage();refresh();}}).catch(()=>{if(active)setState({status:'offline',issue:'Your encrypted records could not be safely loaded. Nothing was cleared. Restore storage or network access and reopen DayBridge.',conflict:false});});
  window.addEventListener('online',refresh);window.addEventListener('focus',refresh);window.addEventListener('daybridge:save-now',refresh);document.addEventListener('visibilitychange',refresh);
  const interval=window.setInterval(refresh,15000);
  // Row-level authorization still applies; only this signed-in account is subscribed.
  const channel=backend?.channel?.('private-workspace:'+userId+':'+crypto.randomUUID())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_snapshots',filter:'user_id=eq.'+userId},refresh)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'private_snapshots',filter:'user_id=eq.'+userId},refresh)
   .subscribe(status=>{if(status==='SUBSCRIBED')refresh();});
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(!snapshotEqual(payloadRef.current,sync.current())||!sync.hasDurableCopy()){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  return()=>{active=false;sync.stop();if(timer.current)clearTimeout(timer.current);window.clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('daybridge:save-now',refresh);window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('visibilitychange',refresh);if(channel)void backend?.removeChannel(channel);if(engine.current===sync)engine.current=null;};
 },[userId,backend]);
 useLayoutEffect(()=>{
  if(!loaded||!engine.current)return;
  const sync=engine.current;if(snapshotEqual(payload,sync.current()))return;
  sync.stage(payload);if(timer.current)clearTimeout(timer.current);
  timer.current=window.setTimeout(()=>{timer.current=null;void sync.sync();},500);
 },[loaded,payload]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:state.status}));return()=>{window.dispatchEvent(new CustomEvent('daybridge:sync-state',{detail:null}));};},[state.status]);
 const retrySync=useCallback(()=>{void engine.current?.sync();},[]);
 const prepareSignOut=useCallback(async()=>{const sync=engine.current;if(!sync)throw Error('Workspace not loaded');sync.stage(payloadRef.current);await sync.prepareSignOut();},[]);
 const resolveSyncConflict=useCallback(async(choice:MergeChoice)=>{await engine.current?.sync(choice);},[]);
 return {isLoaded:loaded,syncStatus:state.status,syncIssue:state.issue,syncConflict:state.conflict,retrySync,prepareSignOut,resolveSyncConflict};
}
