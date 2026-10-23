import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {MessageChannel} from 'node:worker_threads';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(clients:object[]=[]){
 const handlers:Record<string,(event:unknown)=>void>={},notifications:unknown[]=[],opened:string[]=[];
 const self={location:{origin:'https://app.test'},addEventListener:(kind:string,callback:(event:unknown)=>void)=>{handlers[kind]=callback;},registration:{showNotification:async(title:string,options:unknown)=>{notifications.push({title,options});}},clients:{matchAll:async()=>clients,openWindow:async(url:string)=>{opened.push(url);}}};
 runInNewContext(source,{self,URL,URLSearchParams,MessageChannel,setTimeout:(callback:()=>void)=>setTimeout(callback,50),clearTimeout});
 const fire=async(kind:string,details:object)=>{let work:Promise<unknown>|undefined;handlers[kind]({...details,waitUntil:(promise:Promise<unknown>)=>{work=promise;}});await work;};
 return {fire,notifications,opened};
}
test('push payload uses private content, stable tags, quiet-hour flag and a safe destination',async()=>{
 const w=worker();await w.fire('push',{data:{json:()=>({kind:'medication',title:'DayBridge reminder',url:'/?tab=health&medication=m-1',tag:'daybridge-dose-123',silent:true})}});
 const notice=w.notifications[0] as {options:{tag:string;data:{url:string};silent:boolean}};
 assert.equal(notice.options.tag,'daybridge-dose-123');assert.equal(notice.options.data.url,'/?tab=health&medication=m-1');assert.equal(notice.options.silent,true);
 const malicious=worker();await malicious.fire('push',{data:{json:()=>({url:'https://evil.test/steal'})}});
 assert.equal((malicious.notifications[0] as typeof notice).options.data.url,'/');
});
test('notification click reuses a ready app without reload and transfers the exact target',async()=>{
 let received='',focused=0,navigated=0;
 const w=worker([{url:'https://app.test/',focused:true,postMessage:(message:{url:string;type:string},ports:MessagePort[])=>{if(message.type==='DAYBRIDGE_CLIENT_STATUS'){ports[0].postMessage({installed:true});return;}received=message.url;ports[0].postMessage({handled:true});},focus:async()=>{focused++;},navigate:async()=>{navigated++;}}]);
 await w.fire('notificationclick',{notification:{data:{url:'/?tab=schedule&event=e-1&date=2026-10-23'},close:()=>{}}});
 assert.equal(received,'/?tab=schedule&event=e-1&date=2026-10-23');assert.equal(focused,1);assert.equal(navigated,0);assert.deepEqual(w.opened,[]);
});
test('a starting or signed-out app is navigated so the destination survives authentication',async()=>{
 let navigated='';const w=worker([{url:'https://app.test/',postMessage:()=>{},navigate:async(url:string)=>{navigated=url;return {focus:async()=>{}};}}]);
 await w.fire('notificationclick',{notification:{data:{url:'/?tab=tasks&task=t-1'},close:()=>{}}});
 assert.equal(navigated,'/?tab=tasks&task=t-1');assert.deepEqual(w.opened,[]);
});
test('closed-app clicks open the destination, ignoring unrelated same-origin windows',async()=>{
 const w=worker([{url:'https://app.test/auth/callback'}]);
 await w.fire('notificationclick',{notification:{data:{url:'/?tab=money&bill=b-1'},close:()=>{}}});assert.deepEqual(w.opened,['/?tab=money&bill=b-1']);
});

test('an installed app is preferred over a focused regular browser tab',async()=>{
 let browserCalls=0,appCalls=0;
 const client=(installed:boolean)=>({url:'https://app.test/',focused:!installed,postMessage:(message:{type:string},ports:MessagePort[])=>{if(message.type==='DAYBRIDGE_CLIENT_STATUS')ports[0].postMessage({installed});else{if(installed)appCalls++;else browserCalls++;ports[0].postMessage({handled:true});}},focus:async()=>{}});
 const w=worker([client(false),client(true)]);
 await w.fire('notificationclick',{notification:{data:{url:'/?tab=settings'},close:()=>{}}});
 assert.equal(browserCalls,0);assert.equal(appCalls,1);
});
