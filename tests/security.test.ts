import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSameOrigin,readPrivateJSON,PrivateRequestError} from '../lib/security/request.ts';
import {safeExternalURL,validPushEndpoint,validPushKeys} from '../lib/security/urls.ts';
import {contentSecurityPolicy} from '../lib/security/policy.ts';
import {newRecordId} from '../lib/storage/record-id.ts';
import {changeDose} from '../lib/storage/dose-change.ts';
import type {Medication} from '../lib/types';
const request=(body:string,headers:Record<string,string>={})=>new Request('https://daybridge.test/api/travel/route',{method:'POST',body,headers:{'content-type':'application/json',...headers}});
test('private JSON rejects cross-origin, wrong MIME, oversized and malformed actual bodies',async()=>{
 assert.throws(()=>assertSameOrigin(request('{}',{origin:'https://attacker.test'})),(e:unknown)=>e instanceof PrivateRequestError&&e.status===403);
 assert.throws(()=>assertSameOrigin(request('{}',{'sec-fetch-site':'same-site'})),PrivateRequestError);
 await assert.rejects(readPrivateJSON(request('{}',{'content-type':'text/plain'})),(e:unknown)=>e instanceof PrivateRequestError&&e.status===415);
 await assert.rejects(readPrivateJSON(request(' '.repeat(8193))), (e:unknown)=>e instanceof PrivateRequestError&&e.status===413);
 await assert.rejects(readPrivateJSON(request('{')), (e:unknown)=>e instanceof PrivateRequestError&&e.status===400);
 assert.deepEqual(await readPrivateJSON(request('{"value":1}',{origin:'https://daybridge.test'})),{value:1});
});
test('push destinations prohibit private-network targets, credentials, suffix spoofing and unsupported schemes',()=>{
 for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://169.254.169.254/latest','https://fcm.googleapis.com.attacker.test/x','https://fcm.googleapis.com:444/x','https://u:p@fcm.googleapis.com/x','https://fcm.googleapis.com/x#bad'])assert.equal(validPushEndpoint(url),false,url);
 for(const host of ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'])assert.equal(validPushEndpoint('https://'+host+'/synthetic'),true);
 assert.equal(validPushKeys({p256dh:'B'.repeat(87),auth:'a'.repeat(22)}),true);
 assert.equal(validPushKeys({p256dh:'short',auth:'short'}),false);
 for(const value of ['javascript:alert(1)','data:text/html,hi','https://u:p@example.com','https://example.com/\n'])assert.equal(safeExternalURL(value),undefined);
 assert.equal(safeExternalURL('https://example.com/meeting'),'https://example.com/meeting');
});
test('production CSP limits script execution and Supabase connections while allowing the real map worker',()=>{
 const csp=contentSecurityPolicy('synthetic-nonce',false,'https://example.supabase.co');
 assert.match(csp,/nonce-synthetic-nonce/);assert.match(csp,/strict-dynamic/);assert.match(csp,/worker-src 'self' blob:/);
 assert.match(csp,/https:\/\/example.supabase.co wss:\/\/example.supabase.co/);assert.doesNotMatch(csp,/unsafe-eval|script-src[^;]*unsafe-inline|\*\.supabase/);
 assert.doesNotMatch(contentSecurityPolicy('x',false,'invalid'),/undefined|invalid/);
});
test('record identities do not collide when offline edits share a clock tick',()=>{
 const ids=Array.from({length:2000},()=>newRecordId('task'));assert.equal(new Set(ids).size,ids.length);
});
test('dose confirmation is idempotent, undo removes the entry, and stock cannot inflate from an empty inventory',()=>{
 const med={id:'synthetic-med',inventoryCount:1} as Medication,slot='2026-10-23T12:00:00Z';
 const first=changeDose([med],[],med.id,slot,'taken','','synthetic')!;assert.equal(first.medications[0].inventoryCount,0);assert.equal(first.logs.length,1);
 assert.equal(changeDose(first.medications,first.logs,med.id,slot,'taken','','synthetic'),null);
 const undo=changeDose(first.medications,first.logs,med.id,slot,null,'','synthetic')!;assert.equal(undo.medications[0].inventoryCount,1);assert.equal(undo.logs.length,0);
 const empty=changeDose([{...med,inventoryCount:0}],[],med.id,slot,'taken','','synthetic')!;
 assert.equal(changeDose(empty.medications,empty.logs,med.id,slot,null,'','synthetic')!.medications[0].inventoryCount,0);
 const skip=changeDose(first.medications,first.logs,med.id,slot,'skipped','','synthetic')!;assert.equal(skip.medications[0].inventoryCount,1);assert.equal(skip.logs[0].action,'skipped');
});
