import {test,expect} from '@playwright/test';
const storage='/map-test-internal?security=storage';
async function cloud(page:import('@playwright/test').Page){return page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-remote-synthetic-a')||'null')?.payload);}
async function records(page:import('@playwright/test').Page){return JSON.parse(await page.getByTestId('records').innerText());}
test('offline edits survive encrypted device reload and flush without duplicate records',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'onLine',{get:()=>sessionStorage.getItem('synthetic-offline')!=='yes'});});
 await page.goto(storage);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 await page.evaluate(()=>sessionStorage.setItem('synthetic-offline','yes'));
 await page.getByRole('button',{name:'Create synthetic task',exact:true}).click();await expect(page.getByTestId('sync-status')).toHaveText('device_saved');
 await page.reload();await expect(page.getByTestId('records')).toContainText('Synthetic offline task');
 await page.evaluate(()=>{sessionStorage.removeItem('synthetic-offline');window.dispatchEvent(new Event('online'));});
 await expect(page.getByTestId('sync-status')).toHaveText('synced');expect((await records(page)).tasks).toHaveLength(1);
 await page.getByRole('button',{name:'Flush edits',exact:true}).click();await page.reload();expect((await records(page)).tasks).toHaveLength(1);
 await page.getByRole('button',{name:'Delete tasks',exact:true}).click();await expect.poll(async()=> (await cloud(page)).tasks.length).toBe(0);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 await page.reload();await expect(page.getByTestId('records')).not.toContainText('Synthetic offline task');
});
test('a stale device preserves its edits and refuses to overwrite a newer revision',async({page})=>{
 await page.goto(storage);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 await page.getByRole('button',{name:'Other device advances revision'}).click();
 await page.getByRole('button',{name:'Create synthetic task',exact:true}).click();
 await expect(page.getByTestId('sync-issue')).toContainText('newer cloud changes');
 await page.reload();await expect(page.getByTestId('records')).toContainText('Synthetic offline task');await expect(page.getByTestId('sync-issue')).toContainText('not merged');
});
test('account switching separates pending device records and cloud destinations',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'onLine',{get:()=>sessionStorage.getItem('synthetic-offline')!=='yes'});});
 await page.goto(storage);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 await page.evaluate(()=>sessionStorage.setItem('synthetic-offline','yes'));await page.getByRole('button',{name:'Create synthetic task',exact:true}).click();await expect(page.getByTestId('sync-status')).toHaveText('device_saved');
 await page.evaluate(()=>sessionStorage.removeItem('synthetic-offline'));await page.getByRole('button',{name:'Switch synthetic account'}).click();await expect(page.getByTestId('owner')).toHaveText('synthetic-b');await expect(page.getByTestId('sync-status')).toHaveText('synced');
 expect((await records(page)).tasks).toHaveLength(0);
 await page.getByRole('button',{name:'Switch synthetic account'}).click();await expect(page.getByTestId('records')).toContainText('Synthetic offline task');await expect(page.getByTestId('sync-status')).toHaveText('synced');
});
test('explicit dose actions, stock, undo, attendance instances, and record identities persist',async({page})=>{
 await page.goto(storage);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 await page.getByRole('button',{name:'Confirm dose twice'}).click();let data=await records(page);expect(data.logs).toHaveLength(1);expect(data.medications[0].inventoryCount).toBe(0);
 await expect.poll(async()=> (await cloud(page))?.medicationLogs?.[0]?.action).toBe('taken');await expect(page.getByTestId('sync-status')).toHaveText('synced');await page.reload();await expect(page.getByTestId('records')).toContainText('taken');
 await page.getByRole('button',{name:'Undo dose',exact:true}).click();data=await records(page);expect(data.logs).toHaveLength(0);expect(data.medications[0].inventoryCount).toBe(1);
 await page.getByRole('button',{name:'Report separate occurrences'}).click();data=await records(page);expect(data.occurrences).toHaveLength(2);expect(data.occurrences.map((x:{startTimeUtc:string})=>x.startTimeUtc)).toEqual(['2026-10-23T12:00:00.000Z','2026-10-30T12:00:00.000Z']);
 await page.getByRole('button',{name:'Create batch'}).click();data=await records(page);expect(new Set(data.tasks.map((x:{id:string})=>x.id)).size).toBe(20);
 await expect.poll(async()=> (await cloud(page))?.tasks?.length).toBe(20);await expect(page.getByTestId('sync-status')).toHaveText('synced');await page.reload();await expect(page.getByTestId('sync-status')).toHaveText('synced');data=await records(page);expect(data.logs).toHaveLength(0);expect(data.tasks).toHaveLength(20);
});
test('private export includes current participant records and requires an explicit warning',async({page})=>{
 await page.goto(storage);await expect(page.getByTestId('sync-status')).toHaveText('synced');
 const download=page.waitForEvent('download');page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/export.*json/i}).click();const result=await download;expect(result.suggestedFilename()).toBe('daybridge-private-export.json');
 const stream=await result.createReadStream();const chunks=[];for await(const chunk of stream!)chunks.push(chunk);const snapshot=JSON.parse(Buffer.concat(chunks).toString());expect(snapshot.profile.id).toBe('synthetic-a');expect(snapshot.medications[0].name).toBe('Synthetic medication');expect(snapshot.profile.id).not.toBe('synthetic-b');
});
test('session lock retains drafts, rejects wrong passwords, and survives reload',async({page})=>{
 await page.goto('/map-test-internal?security=lock');await page.getByLabel('Unsaved synthetic draft').fill('Synthetic draft stays mounted');
 await page.getByRole('button',{name:'Lock test workspace'}).click();await expect(page.getByLabel('Unsaved synthetic draft')).toBeHidden();
 await page.getByLabel('Account password').fill('wrong');await page.getByRole('button',{name:'Unlock',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('not recognized');
 await page.getByLabel('Account password').fill('synthetic-password');await page.getByRole('button',{name:'Unlock',exact:true}).click();await expect(page.getByLabel('Unsaved synthetic draft')).toHaveValue('Synthetic draft stays mounted');
 await page.getByRole('button',{name:'Lock test workspace'}).click();await page.reload();await expect(page.getByRole('heading',{name:'DayBridge locked'})).toBeVisible();
});
test('session lock stays closed offline and supports inactivity locking',async({page,context})=>{
 await page.goto('/map-test-internal?security=lock');await page.getByRole('button',{name:'Lock test workspace'}).click();await context.setOffline(true);
 await page.getByLabel('Account password').fill('synthetic-password');await page.getByRole('button',{name:'Unlock',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('Connect to the internet');
 await context.setOffline(false);await page.getByLabel('Account password').fill('synthetic-password');await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await page.getByRole('button',{name:'Enable synthetic short idle timer'}).click();await expect(page.getByRole('heading',{name:'DayBridge locked'})).toBeVisible();
});
test('auth gate denies anonymous and expired cached identities and permits an unexpired offline device session',async({page})=>{
 await page.goto('/map-test-internal?security=auth');await expect(page.getByRole('heading',{name:'Unlock DayBridge'})).toBeVisible();
 await page.getByLabel('Username or email').fill('synthetic@example.invalid');await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('not recognized');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByText('Authorized synthetic identity: synthetic-auth')).toBeVisible();
 await page.addInitScript(()=>{Object.defineProperty(navigator,'onLine',{get:()=>false});});
 await page.evaluate(()=>sessionStorage.setItem('synthetic-auth-expired','yes'));await page.reload();await expect(page.getByRole('heading',{name:'Unlock DayBridge'})).toBeVisible();
 await page.evaluate(()=>sessionStorage.removeItem('synthetic-auth-expired'));await page.reload();await expect(page.getByText('Authorized synthetic identity: synthetic-auth')).toBeVisible();
});
test('production policy blocks unauthorized inline scripts and exposes only liveness',async({page,request})=>{
 await page.route('**/map-test-internal?security=lock',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('</head>',`<script>document.documentElement.dataset.injected='yes'</script></head>`)});});
 const response=await page.goto('/map-test-internal?security=lock');const policy=response!.headers()['content-security-policy'];expect(policy).toContain('strict-dynamic');

 expect(await page.locator('html').getAttribute('data-injected')).toBeNull();
 const health=await request.get('/api/health');expect(await health.json()).toEqual({status:'ok',version:expect.any(String)});expect(health.headers()['cache-control']).toBe('no-store');
 for(const path of ['/api/travel/route','/api/notifications/device']){const denied=await request.post(path,{data:{},headers:{origin:'https://attacker.invalid'}});expect(denied.status()).toBe(403);}
});

test('update cannot reload while device edits or a draft remain pending',async({page})=>{
 await page.route('**/api/version',route=>route.fulfill({json:{version:'synthetic-new-release'}}));
 await page.goto('/map-test-internal?security=update');await expect(page.getByRole('region',{name:'DayBridge update available'})).toBeVisible();
 await page.getByLabel('Synthetic update draft').fill('Synthetic draft');
 await page.getByRole('button',{name:'Set unsynced device state'}).click();await expect(page.getByRole('button',{name:'Update now',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Set cloud saved state'}).click();await page.getByRole('button',{name:'Update now',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('Finish saving');await expect(page.getByLabel('Synthetic update draft')).toHaveValue('Synthetic draft');
 await page.getByRole('button',{name:'Finish synthetic draft'}).click();const navigation=page.waitForEvent('framenavigated',frame=>frame===page.mainFrame());await page.getByRole('button',{name:'Update now',exact:true}).click();await navigation;
});

test('manual locking protects other open tabs of the same account',async({page,context})=>{
 await page.goto('/map-test-internal?security=lock');await expect(page.getByLabel('Unsaved synthetic draft')).toBeVisible();
 const other=await context.newPage();await other.goto('/map-test-internal?security=lock');await expect(other.getByLabel('Unsaved synthetic draft')).toBeVisible();
 await page.getByRole('button',{name:'Lock test workspace'}).click();await expect(other.getByRole('heading',{name:'DayBridge locked'})).toBeVisible();
 const newTab=await context.newPage();await newTab.goto('/map-test-internal?security=lock');await expect(newTab.getByRole('heading',{name:'DayBridge locked'})).toBeVisible();await newTab.close();await other.close();
});
