/* DayBridge: push-only service worker. Sensitive pages and API responses are never cached. */
self.addEventListener('install',event=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  const title='DayBridge reminder';
  const options={body:'Open DayBridge to review an upcoming item.',icon:'/icon.svg',badge:'/icon.svg',tag:'daybridge-reminder',data:{url:'/'},renotify:false};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  const existing=clients.find(c=>new URL(c.url).origin===self.location.origin);
  return existing?existing.focus():self.clients.openWindow('/');
 }));
});
