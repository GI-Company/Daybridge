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

self.addEventListener('push',event=>{
 let message={};
 try{message=event.data?.json()||{}}catch{}
 const kind=String(message.kind||'general').replace(/[^a-z_]/g,'').slice(0,24);
 const title=typeof message.title==='string'?message.title.slice(0,100):'DayBridge reminder';
 const body=typeof message.body==='string'?message.body.slice(0,240):'Open DayBridge to review an upcoming item.';
 const pushTag=typeof message.tag==='string'&&/^daybridge-[a-z_-]+-[a-f0-9-]{36}$/.test(message.tag)?message.tag:'daybridge-'+kind;
 let url='/';
 try{
  const target=new URL(typeof message.url==='string'?message.url:'/',self.location.origin);
  // Push payloads can only navigate inside the private DayBridge home shell.
  if(target.origin===self.location.origin&&target.pathname==='/')url=target.pathname+target.search;
 }catch{}
 const options={body,icon:'/icon.svg',badge:'/icon.svg',tag:pushTag,
  data:{url},renotify:false};
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const destination=event.notification.data?.url||'/';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const existing=clients.find(c=>new URL(c.url).origin===self.location.origin);
  if(existing){
   const focused=await existing.focus();
   focused.postMessage({type:'DAYBRIDGE_TRAVEL_NOTIFICATION',url:destination});
   return;
  }
  await self.clients.openWindow(destination);
 }));
});
