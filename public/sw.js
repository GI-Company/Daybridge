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
 if(url.pathname.startsWith('/_next/static/')){
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

// Push actions are supported by Chromium-based Android PWAs. Browsers may
// omit the buttons; tapping the notification body still opens the event.
const isAppointmentId=value=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

self.addEventListener('push',event=>{
 let message={};
 try{message=event.data?.json()||{}}catch{}
 const kind=String(message.kind||'general').replace(/[^a-z_]/g,'').slice(0,24);
 const title=typeof message.title==='string'?message.title.slice(0,100):'DayBridge reminder';
 const body=typeof message.body==='string'?message.body.slice(0,300):'DayBridge has a new reminder.';
 const tag=typeof message.tag==='string'&&/^daybridge-[a-z_-]+-[a-f0-9-]{36}$/.test(message.tag)
  ?message.tag:'daybridge-'+kind;
 let url='/';
 try{
  const target=new URL(typeof message.url==='string'?message.url:'/',self.location.origin);
  if(target.origin===self.location.origin&&target.pathname==='/')url=target.pathname+target.search;
 }catch{}
 const appointmentId=isAppointmentId(message.appointmentId)?message.appointmentId:null;
 const canAcknowledge=appointmentId&&message.canAcknowledge===true;
 const actions=canAcknowledge?[
  {action:'on-my-way',title:'On my way'},
  {action:'view-route',title:'View route'}
 ]:appointmentId?[{action:'view-route',title:'View route'}]:[];
 const sentAt=Number(message.sentAt);
 // Keep showing a notification even on delayed delivery; TTL limits old pushes,
 // but a service worker must not silently discard accepted user-visible pushes.
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'/icon.svg',badge:'/icon.svg',tag,renotify:false,
  timestamp:Number.isFinite(sentAt)&&sentAt>0?sentAt:Date.now(),
  actions,data:{url,appointmentId,kind,canAcknowledge}
 }));
});

async function openAppointment(url){
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
 if(existing){
  const focused=await existing.focus();
  focused.postMessage({type:'DAYBRIDGE_TRAVEL_NOTIFICATION',url});
 }else await self.clients.openWindow(url);
}
self.addEventListener('notificationclick',event=>{
 const data=event.notification.data||{};
 const destination=typeof data.url==='string'&&data.url.startsWith('/')?data.url:'/';
 if(event.action==='on-my-way'&&isAppointmentId(data.appointmentId)){
  event.notification.close();
  event.waitUntil((async()=>{
   try{
    const response=await fetch('/api/travel/acknowledge',{
     method:'POST',credentials:'include',mode:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({appointmentId:data.appointmentId,source:'notification'})
    });
    if(!response.ok)throw new Error('Acknowledgment not accepted');
    await self.registration.showNotification('On my way confirmed',{
     body:'Your departure was acknowledged. DayBridge will keep watching traffic on the planned route.',
     icon:'/icon.svg',badge:'/icon.svg',
     tag:'daybridge-ack-'+data.appointmentId,
     data:{url:destination},silent:true
    });
   }catch{
    // An action is NEVER treated as acknowledged until the server confirms it.
    await self.registration.showNotification('Departure not confirmed',{
     body:'Could not save On my way. Open DayBridge to retry while signed in and online.',
     icon:'/icon.svg',badge:'/icon.svg',
     tag:'daybridge-ack-error-'+data.appointmentId,
     actions:[{action:'view-route',title:'Open appointment'}],
     data:{url:destination}
    }).catch(()=>undefined);
   }
  })());
  return;
 }
 event.notification.close();
 event.waitUntil(openAppointment(destination));
});
