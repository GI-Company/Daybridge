import {test,expect} from '@playwright/test';

test('temporary entitlement errors preserve the mounted workspace; explicit denial hides it',async({page})=>{
 let unavailable=false;
 await page.route('**/api/account/managed-access',route=>route.fulfill(unavailable?{status:503,json:{error:'Temporary outage'}}:{json:{allowed:true,reason:'active'}}));
 await page.goto('/map-test-internal?security=billing');
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 await page.getByLabel('Managed workspace draft').fill('Keep unfinished work');
 unavailable=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Access could not be refreshed');
 await expect(page.getByLabel('Managed workspace draft')).toHaveValue('Keep unfinished work');
 await page.route('**/api/account/managed-access',route=>route.fulfill({json:{allowed:false,reason:'suspended'}}));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeHidden();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toHaveCount(1);
 await expect(page.getByRole('heading',{name:'Court access is inactive'})).toBeVisible();
 await page.route('**/api/account/managed-access',route=>route.fulfill({json:{allowed:true}}));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByLabel('Managed workspace draft')).toHaveValue('Keep unfinished work');
});

test('undoing a bill payment allows recording it again exactly once',async({page})=>{
 await page.clock.install({time:new Date('2026-10-24T14:00:00Z')});
 await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 const cloud=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-remote-synthetic-polish')||'null')?.payload);
 const pay=async()=>{
  await page.getByRole('button',{name:'Mark Paid',exact:true}).click();
  await page.getByRole('combobox',{name:'Account',exact:true}).selectOption('synthetic-cash');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Confirm payment',exact:true}).click();
 };
 await page.getByRole('button',{name:'Budget',exact:true}).last().click();await pay();
 await expect.poll(async()=> (await cloud())?.bills[0].isPaid).toBe(true);
 await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:/Settings/}).last().click();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(async()=> (await cloud())?.bills[0].isPaid).toBe(false);
 await page.getByRole('button',{name:'Budget',exact:true}).last().click();await pay();
 await expect(page.getByText('Demo bill marked paid and deducted from Demo checking.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Mark Paid',exact:true})).toHaveCount(0);
 await expect.poll(async()=> (await cloud())?.bills[0].isPaid).toBe(true);
 const saved=await cloud();expect(saved.accounts[0].balanceCents).toBe(-3983);expect(saved.transactions.filter((tx:{operationId?:string})=>tx.operationId?.startsWith('bill:'))).toHaveLength(1);
});

test('court settings cannot be edited while their save is in progress',async({page})=>{
 const court='a1000000-0000-4000-8000-000000000010',circuit='a1000000-0000-4000-8000-000000000011';
 const data={states:[{code:'GA',name:'Georgia'}],circuits:[{id:circuit,state_code:'GA',name:'Beta Circuit',login_slug:'beta'}],courts:[{id:court,circuit_id:circuit,court_name:'Beta Court',login_slug:'beta-court',seat_limit:25,occupied_seats:0,subscription_status:'pilot',listed:false,enabled:true,is_demo:true}],staff:[]};
 let release=()=>{},received=()=>{};
 const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{received=resolve;});
 await page.route('**/api/owner/setup',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:data});
  const input=route.request().postDataJSON();received();await waiting;Object.assign(data.courts[0],input);return route.fulfill({json:{court_id:court}});
 });
 await page.goto('/map-test-internal?owner=test');await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();
 await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 const name=page.getByLabel('Display name',{exact:true});await name.fill('Submitted court');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Save court settings',exact:true}).click();await started;
 await expect(name).toBeDisabled();release();
 await expect(page.getByText('Court settings saved.',{exact:true})).toBeVisible();await expect(name).toHaveValue('Submitted court');
});

test('virtual meeting URL is saved and shown as a safe Join link',async({page})=>{
 await page.clock.install({time:new Date('2026-10-24T14:01:00Z')});
 await page.goto('/map-test-internal?checkin=test');await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
 await page.getByRole('button',{name:'Add synthetic appointment'}).click();
 await page.getByPlaceholder('e.g. Appointment or shift').fill('Virtual audit meeting');
 await page.getByLabel('Start time',{exact:true}).fill('10:30');await page.getByLabel('End time',{exact:true}).fill('11:30');
 await page.getByLabel('Location or meeting link (optional)').fill('https://example.com/meeting');
 await page.getByRole('button',{name:'More options (optional)'}).click();await page.getByLabel('Meeting format',{exact:false}).selectOption('virtual');
 await page.getByRole('button',{name:'Save Appointment',exact:true}).click();
 const saved=JSON.parse(await page.getByTestId('check-in-records').innerText()).events.find((event:{title:string})=>event.title==='Virtual audit meeting');
 expect(saved.location).toBeUndefined();expect(saved.meetingUrl).toBe('https://example.com/meeting');
 await page.getByRole('region',{name:'Selected day schedule'}).getByRole('button').filter({hasText:'Virtual audit meeting'}).click();
 const details=page.getByRole('dialog',{name:'Appointment details'});await expect(details.getByRole('link')).toBeVisible();
 await expect(details.getByRole('link')).toHaveAttribute('href','https://example.com/meeting');
});

test('encrypted access grant permits offline reopening, expires, and is cleared by confirmed denial',async({page})=>{
 await page.clock.install({time:new Date('2026-11-07T12:00:00Z')});
 await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>sessionStorage.getItem('access-offline')!=='yes'}));
 let response:'allowed'|'outage'|'denied'='allowed';
 await page.route('**/api/account/managed-access',route=>route.fulfill(response==='outage'?{status:503,json:{error:'Unavailable'}}:response==='denied'?{status:401,json:{allowed:false}}:{json:{allowed:true}}));
 await page.goto('/map-test-internal?security=billing');
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise<boolean>((resolve,reject)=>{
  const request=indexedDB.open('daybridge-private-device-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{
   const db=request.result;const get=db.transaction('snapshots','readonly').objectStore('snapshots').get('access:synthetic-billing');get.onsuccess=()=>{resolve(Boolean(get.result?.ciphertext));db.close();};get.onerror=()=>reject(get.error);
  };
 }))).toBe(true);
 response='outage';await page.evaluate(()=>sessionStorage.setItem('access-offline','yes'));await page.reload();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 // A network outage also works when the OS still reports that Wi-Fi is online.
 await page.evaluate(()=>sessionStorage.removeItem('access-offline'));await page.reload();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 await page.clock.setSystemTime(new Date('2026-11-08T13:00:00Z'));await page.reload();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toHaveCount(0);
 response='allowed';await page.getByRole('button',{name:'Check access again'}).click();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeVisible();
 response='denied';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toBeHidden();
 response='outage';await page.evaluate(()=>sessionStorage.setItem('access-offline','yes'));await page.reload();
 await expect(page.getByText('Paid workspace allowed',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Could not verify access online. Reconnect and try again.')).toBeVisible();
});

test('paycheck undo allows one new receipt, same-cycle edits retain it, and a later payday is separate',async({page})=>{
 await page.clock.install({time:new Date('2026-10-24T14:00:00Z')});
 await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 const cloud=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-remote-synthetic-polish')||'null')?.payload);
 const budget=async()=>{await page.getByRole('button',{name:'Budget',exact:true}).last().click();await page.locator('summary').filter({hasText:'Paycheck planning (optional)'}).click();};
 const receive=async()=>{
  await page.getByRole('button',{name:'Record deposit',exact:true}).click();
  await page.getByLabel('Received into account').selectOption('synthetic-cash');
  const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save deposit',exact:true})});
  await form.locator('input[type=number]').fill('100');await form.getByRole('button',{name:'Save deposit',exact:true}).click();
  await expect.poll(async()=>Boolean((await cloud())?.paycheckPlan.reconciledAt)).toBe(true);
 };
 await budget();await receive();await expect.poll(async()=> (await cloud())?.accounts[0].balanceCents).toBe(11017);
 await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:/Settings/}).last().click();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(async()=> (await cloud())?.accounts[0].balanceCents).toBe(1017);
 await budget();await receive();await expect.poll(async()=> (await cloud())?.accounts[0].balanceCents).toBe(11017);
 await page.getByRole('button',{name:'Edit next payday',exact:true}).click();await page.getByRole('button',{name:'Save payday',exact:true}).click();
 await expect(page.getByRole('button',{name:'Record deposit',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Edit next payday',exact:true}).click();await page.getByLabel('Next payday',{exact:true}).fill('2026-11-19');
 await page.getByRole('button',{name:'Save payday',exact:true}).click();await receive();
 await expect.poll(async()=> (await cloud())?.accounts[0].balanceCents).toBe(21017);
 expect((await cloud()).transactions.filter((tx:{operationId?:string})=>tx.operationId?.startsWith('paycheck:'))).toHaveLength(2);
});
