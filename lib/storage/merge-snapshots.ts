export type Snapshot=Record<string,unknown>;
export type MergeChoice='cloud'|'device';
const missing=Symbol('missing');
type Value=unknown|typeof missing;
const object=(value:unknown):value is Snapshot=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function snapshotEqual(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((item,i)=>snapshotEqual(item,b[i]));
 if(object(a)&&object(b)){const ak=Object.keys(a).filter(k=>a[k]!==undefined),bk=Object.keys(b).filter(k=>b[k]!==undefined);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&snapshotEqual(a[k],b[k]));}
 return false;
}
/** A three-way merge never treats a missing record in an old device as a new deletion. */
export function mergeSnapshots(base:Snapshot,device:Snapshot,cloud:Snapshot,choice?:MergeChoice){
 const conflicts:string[]=[];
 function merge(b:Value,l:Value,r:Value,path:string):Value{
  if(b===undefined)b=missing;if(l===undefined)l=missing;if(r===undefined)r=missing;
  if((path.startsWith('medicationLogs.')||path.startsWith('eventOccurrences.'))&&path.endsWith('.id')&&b===missing)return r;
  if(path.endsWith('.recordedAtUtc')||path.endsWith('.lastConfirmedAt')){if(l!==missing&&r!==missing)return String(l)>String(r)?l:r;}
  if(snapshotEqual(l,r))return r;
  if(snapshotEqual(l,b))return r;
  if(snapshotEqual(r,b))return l;
  if(path.endsWith('.updatedAt')||path.endsWith('.updated_at'))return String(l)>String(r)?l:r;
  if((object(b)||b===missing)&&object(l)&&object(r)){
   const old=object(b)?b:{};const result:Snapshot={};
   for(const key of new Set([...Object.keys(old),...Object.keys(l),...Object.keys(r)])){
    const value=merge(Object.hasOwn(old,key)?old[key]:missing,Object.hasOwn(l,key)?l[key]:missing,Object.hasOwn(r,key)?r[key]:missing,path?path+'.'+key:key);
    if(value!==missing&&value!==undefined)result[key]=value;
   }return result;
  }
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
   const keyFor=(value:unknown):string|null=>{
    if(!object(value))return null;
    if(path==='medicationLogs'&&typeof value.medicationId==='string'&&typeof value.scheduledSlotUtc==='string')return value.medicationId+'/'+value.scheduledSlotUtc;
    if(path==='eventOccurrences'&&typeof value.eventId==='string'&&typeof value.startTimeUtc==='string')return value.eventId+'/'+value.startTimeUtc;
    return typeof value.id==='string'?value.id:null;
   };
   // Schedule replacements are one edit per medication, not a union of dose times.
   if(path==='medicationSchedules'){
    const grouped=(items:unknown[])=>{const groups:Snapshot={};for(const item of items){if(!object(item)||typeof item.medicationId!=='string')return null;(groups[item.medicationId]??=[] as unknown[]);(groups[item.medicationId] as unknown[]).push(item);}return groups;};
    const bg=grouped(b),lg=grouped(l),rg=grouped(r);
    if(bg&&lg&&rg){const result:unknown[]=[];for(const key of new Set([...Object.keys(bg),...Object.keys(lg),...Object.keys(rg)])){const old=bg[key]??[],left=lg[key]??[],right=rg[key]??[];let value:unknown;if(snapshotEqual(left,right)||snapshotEqual(left,old))value=right;else if(snapshotEqual(right,old))value=left;else{conflicts.push(path+'.'+key);value=choice==='device'?left:right;}result.push(...value as unknown[]);}return result;}
   }
   const keyed=(items:unknown[])=>{const entries=items.map(item=>[keyFor(item),item] as const);if(entries.some(([key])=>!key)||new Set(entries.map(([key])=>key)).size!==items.length)return null;return new Map(entries as Array<readonly[string,unknown]>);};
   const bm=keyed(b),lm=keyed(l),rm=keyed(r);
   if(bm&&lm&&rm){const result:unknown[]=[];for(const key of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const value=merge(bm.has(key)?bm.get(key):missing,lm.has(key)?lm.get(key):missing,rm.has(key)?rm.get(key):missing,path+'.'+key);if(value!==missing)result.push(value);}return result;}
  }
  conflicts.push(path||'workspace');return choice==='device'?l:r;
 }
 const payload=structuredClone(merge(base,device,cloud,'')) as Snapshot;
 // Reconcile derived balances/stock only when both devices' changes exactly match
 // their recorded ledger/dose movements. Manual corrections remain conflicts.
 const rows=(value:Snapshot,key:string)=>Array.isArray(value[key])?(value[key] as unknown[]).filter(object):[];
 for(const config of [{collection:'accounts',field:'balanceCents',ledger:'transactions',owner:'accountId',delta:'amountCents'}, {collection:'medications',field:'inventoryCount',ledger:'medicationLogs',owner:'medicationId',delta:'inventoryDelta'}]){
  const sum=(value:Snapshot,id:string)=>rows(value,config.ledger).filter(item=>item[config.owner]===id).reduce((n,item)=>n+(typeof item[config.delta]==='number'?item[config.delta] as number:0),0);
  for(const item of rows(payload,config.collection)){
   const old=rows(base,config.collection).find(x=>x.id===item.id),left=rows(device,config.collection).find(x=>x.id===item.id),right=rows(cloud,config.collection).find(x=>x.id===item.id);
   if(!old||!left||!right||typeof old[config.field]!=='number'||typeof left[config.field]!=='number'||typeof right[config.field]!=='number')continue;
   const start=old[config.field] as number,l=left[config.field] as number,r=right[config.field] as number,id=item.id as string;
   if(l===start||r===start)continue;
   const dl=sum(device,id)-sum(base,id),dr=sum(cloud,id)-sum(base,id),projected=start+sum(payload,id)-sum(base,id),path=config.collection+'.'+id+'.'+config.field;
   if(l-start===dl&&r-start===dr&&Number.isSafeInteger(projected)&&(config.field!=='inventoryCount'||projected>=0)){
    item[config.field]=projected;const at=conflicts.indexOf(path);if(at>=0)conflicts.splice(at,1);
   }else if(l===r&&(!snapshotEqual(rows(device,config.ledger),rows(cloud,config.ledger)))){
    if(!conflicts.includes(path))conflicts.push(path);item[config.field]=choice==='device'?l:r;
   }
  }
 }
 return {payload,conflicts};
}
