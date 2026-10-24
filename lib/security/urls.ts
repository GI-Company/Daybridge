export function safeExternalURL(value:unknown):string|undefined {
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return undefined;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
export function validPushEndpoint(value:unknown):value is string {
 if(typeof value!=='string'||value.length>4096)return false;
 try{
  const url=new URL(value);
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&allowed.includes(url.hostname);
 }catch{return false;}
}
export function validPushKeys(value:unknown):value is {p256dh:string;auth:string}{
 if(!value||typeof value!=='object')return false;
 const keys=value as Record<string,unknown>;
 return typeof keys.p256dh==='string'&&/^[\w-]{87}$/.test(keys.p256dh)&&typeof keys.auth==='string'&&/^[\w-]{22}$/.test(keys.auth);
}
