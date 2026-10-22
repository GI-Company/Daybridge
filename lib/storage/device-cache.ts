/**
 * Private device-side record store for DayBridge.
 * Only ciphertext is stored as record data. AES-GCM keys are non-extractable
 * CryptoKeys stored in IndexedDB and scoped to this browser origin and user.
 *
 * SECURITY: a compromised same-origin script or unlocked browser profile can
 * still use stored keys; this is not equivalent to an independent PIN/password
 * or hardware-backed encryption. Clearing site storage also clears this cache.
 */
export interface DeviceSnapshot {
 payload:Record<string,unknown>;
 revision:number;
 dirty:boolean;
 updatedAt:number;
}
type Envelope={version:1;iv:Uint8Array;ciphertext:ArrayBuffer};
const DB_NAME='daybridge-private-device-v1';
const SNAPSHOTS='snapshots';
const KEYS='keys';
let opening:Promise<IDBDatabase>|null=null;

function openDatabase():Promise<IDBDatabase>{
 if(!('indexedDB' in globalThis)||!globalThis.crypto?.subtle)
  return Promise.reject(new Error('Secure device storage unavailable'));
 if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(SNAPSHOTS))db.createObjectStore(SNAPSHOTS);
   if(!db.objectStoreNames.contains(KEYS))db.createObjectStore(KEYS);
  };
  request.onsuccess=()=>{
   const db=request.result;
   db.onversionchange=()=>{db.close();opening=null};
   resolve(db);
  };
  request.onerror=()=>reject(request.error??new Error('Device database failed to open'));
  request.onblocked=()=>reject(new Error('Device database is blocked by another app tab'));
 }).catch(error=>{opening=null;throw error});
 return opening;
}
async function readEntry<T>(store:string,id:string):Promise<T|undefined>{
 const db=await openDatabase();
 return new Promise<T|undefined>((resolve,reject)=>{
  const transaction=db.transaction(store,'readonly');
  const request=transaction.objectStore(store).get(id);
  request.onsuccess=()=>resolve(request.result as T|undefined);
  request.onerror=()=>reject(request.error??new Error('Device read failed'));
  transaction.onabort=()=>reject(transaction.error??new Error('Device transaction cancelled'));
 });
}
async function writeEntry(store:string,id:string,value:unknown,insertOnly=false):Promise<void>{
 const db=await openDatabase();
 return new Promise<void>((resolve,reject)=>{
  const transaction=db.transaction(store,'readwrite');
  const request=insertOnly?transaction.objectStore(store).add(value,id):transaction.objectStore(store).put(value,id);
  transaction.oncomplete=()=>resolve();
  request.onerror=()=>reject(request.error??new Error('Device write failed'));
  transaction.onerror=()=>reject(transaction.error??new Error('Device transaction failed'));
  transaction.onabort=()=>reject(transaction.error??new Error('Device transaction cancelled'));
 });
}
async function keyFor(userId:string):Promise<CryptoKey>{
 const existing=await readEntry<CryptoKey>(KEYS,userId);
 if(existing)return existing;
 const fresh=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 try{await writeEntry(KEYS,userId,fresh,true);return fresh}
 catch{
  // A second tab may have generated the same user's key first.
  const raced=await readEntry<CryptoKey>(KEYS,userId);
  if(raced)return raced;
  throw new Error('Unable to preserve device encryption key');
 }
}
function additionalData(userId:string):Uint8Array{
 return new TextEncoder().encode('daybridge-snapshot-v1:'+userId);
}
export async function readDeviceSnapshot(userId:string):Promise<DeviceSnapshot|null>{
 const envelope=await readEntry<Envelope>(SNAPSHOTS,userId);
 if(!envelope)return null;
 if(envelope.version!==1||!envelope.iv||!envelope.ciphertext)throw new Error('Unsupported local record format');
 const key=await keyFor(userId);
 const decoded=await crypto.subtle.decrypt({
  name:'AES-GCM',iv:new Uint8Array(envelope.iv).buffer,additionalData:additionalData(userId).buffer as ArrayBuffer
 },key,envelope.ciphertext);
 const value=JSON.parse(new TextDecoder().decode(decoded)) as DeviceSnapshot;
 if(!value||typeof value!=='object'||!value.payload||Array.isArray(value.payload)
  ||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.dirty!=='boolean')
  throw new Error('Local record data is invalid');
 return value;
}
export async function writeDeviceSnapshot(userId:string,snapshot:DeviceSnapshot):Promise<void>{
 const key=await keyFor(userId);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encoded=new TextEncoder().encode(JSON.stringify(snapshot));
 const ciphertext=await crypto.subtle.encrypt({
  name:'AES-GCM',iv:iv.buffer,additionalData:additionalData(userId).buffer as ArrayBuffer
 },key,encoded.buffer as ArrayBuffer);
 await writeEntry(SNAPSHOTS,userId,{version:1,iv,ciphertext} satisfies Envelope);
}
export async function requestDurableStorage():Promise<boolean>{
 if(typeof navigator==='undefined'||!navigator.storage?.persist)return false;
 try{return await navigator.storage.persist()}catch{return false}
}
export async function isDurableStorage():Promise<boolean>{
 if(typeof navigator==='undefined'||!navigator.storage?.persisted)return false;
 try{return await navigator.storage.persisted()}catch{return false}
}
