/* DayBridge offline app shell + private Web Push.
 * Only public app shell and hashed /_next/static assets are cached.
 * Never cache Supabase, private records, POST requests, or API responses.
 * User data lives in encrypted IndexedDB and syncs via owner-scoped RLS.
 */
const SHELL_CACHE='daybridge-shell-v1';
const ROOT='/';

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  try{
   const response=await fetch(ROOT,{cache:'reload'});
   if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
    const cache=await caches.open(SHELL_CACHE);await cache.put(ROOT,response.clone());
   }
  }catch{/* An offline install must not poison the cache. */}
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/'))return;

 if(request.mode==='navigate'&&url.pathname===ROOT){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
     const copy=response.clone();
     event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.put(ROOT,copy)).catch(()=>undefined));
    }
    return response;
   }catch{
    const cached=await caches.match(ROOT);
    return cached||new Response(
     '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>DayBridge offline</h1><p>Open DayBridge once while connected to enable offline startup.</p></body></html>',
     {status:503,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}}
    );
   }
  })());
  return;
 }
 if(url.pathname.startsWith('/_next/static/')||/^\/maps\/maplibre\/\d+\.\d+\.\d+\/maplibre-gl-(worker|shared)\.mjs$/.test(url.pathname)){
  event.respondWith((async()=>{
   const cache=await caches.open(SHELL_CACHE);
   const hit=await cache.match(request);
   if(hit)return hit;
   const result=await fetch(request);
   if(result.ok&&result.type!=='opaque')
    event.waitUntil(cache.put(request,result.clone()).catch(()=>undefined));
   return result;
  })());
 }
});

self.addEventListener('message',event=>{
 if(event.data?.type!=='DAYBRIDGE_WARM_SHELL')return;
 const assets=Array.isArray(event.data.assets)?event.data.assets.slice(0,160):[];
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL_CACHE);
  await Promise.allSettled(assets.map(async(value)=>{
   if(typeof value!=='string')return;
   const url=new URL(value,self.location.origin);
   if(url.origin!==self.location.origin||!url.pathname.startsWith('/_next/static/'))return;
   const request=new Request(url.href,{credentials:'omit'});
   if(await cache.match(request))return;
   const response=await fetch(request);
   if(response.ok&&response.type!=='opaque')await cache.put(request,response);
  }));
 })());
});

function notificationDestination(raw){
 try{
  const target=new URL(typeof raw==='string'?raw:'/',self.location.origin);
  if(target.origin!==self.location.origin||target.pathname!=='/')return '/';
  const tabs=['today','schedule','locations','tasks','health','money','court','review','resources','settings'];
  const tab=target.searchParams.get('tab');if(!tabs.includes(tab))return '/';
  const params=new URLSearchParams({tab});
  for(const key of ['event','task','medication','bill','account']){
   const value=target.searchParams.get(key);if(value&&/^[\w-]{1,160}$/.test(value))params.set(key,value);
  }
  const date=target.searchParams.get('date');if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date))params.set('date',date);
  const slot=target.searchParams.get('slot');if(slot&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(slot))params.set('slot',slot);
  return '/?'+params.toString();
 }catch{return '/';}
}
self.addEventListener('push',event=>{
 let message={};
 try{message=event.data?.json()||{}}catch{}
 const kind=String(message.kind||'general').replace(/[^a-z_]/g,'').slice(0,24);
 const title=typeof message.title==='string'?message.title.slice(0,100):'DayBridge reminder';
 const body=typeof message.body==='string'?message.body.slice(0,240):'Open DayBridge to review an upcoming item.';
 const tag=typeof message.tag==='string'&&/^daybridge-[a-z0-9_-]{1,140}$/.test(message.tag)?message.tag:'daybridge-'+kind;
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/icon.svg',badge:'/icon.svg',tag,
  data:{url:notificationDestination(message.url)},renotify:false,silent:message.silent===true}));
});
function askClient(client,message,timeout){
 return new Promise(resolve=>{
  const channel=new MessageChannel();
  const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
  const timer=setTimeout(()=>finish(null),timeout);
  channel.port1.onmessage=event=>finish(event.data);
  try{client.postMessage(message,[channel.port2]);}catch{finish(null);}
 });
}
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const destination=notificationDestination(event.notification.data?.url);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const eligible=windows.filter(client=>{
   try{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname==='/';}catch{return false;}
  });
  const states=await Promise.all(eligible.map(async client=>({client,status:await askClient(client,{type:'DAYBRIDGE_CLIENT_STATUS'},350)})));
  const installed=states.filter(item=>item.status?.installed===true).map(item=>item.client);
  const candidates=installed.length?installed:states.filter(item=>item.status?.installed!==false).map(item=>item.client);
  const existing=candidates.find(client=>client.focused)||candidates.find(client=>client.visibilityState==='visible')||candidates[0];
  if(existing){
   // Acknowledge delivery to the mounted workspace. During startup/sign-in the
   // listener may not exist yet: navigation preserves the target through reload.
   const reply=await askClient(existing,{type:'DAYBRIDGE_NOTIFICATION',url:destination},1200);
   const handled=reply?.handled===true;
   if(handled){await existing.focus().catch(()=>undefined);return;}
   try{const navigated=await existing.navigate(destination);if(navigated){await navigated.focus().catch(()=>undefined);return;}}catch{}
  }
  await self.clients.openWindow(destination);
 })());
});
