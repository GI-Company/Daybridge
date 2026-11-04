import {test,expect,type Page,type BrowserContext} from '@playwright/test';

test('independent devices receive changes, merge offline edits, preserve drafts and allow safe local sign-out',async({browser})=>{
 const contexts:BrowserContext[]=[];const pages:Page[]=[];
 let row={revision:1,payload:{profile:{id:'synthetic-shared',fullName:'Original name'},tasks:[] as unknown[]}};
 const history:Record<string,unknown>={};let saves=0;
 try{
  for(const device of ['phone','mac']){
   const context=await browser.newContext();contexts.push(context);
   const page=await context.newPage();pages.push(page);
   await page.route('**/synthetic-sync',async route=>{
    const body=route.request().postDataJSON();
    if(body.action==='history'){await route.fulfill({json:{data:history[body.revision]||null,error:null}});return;}
    if(body.action==='read'){await route.fulfill({json:{data:row,error:null}});return;}
    if(body.p_expected_revision!==row.revision){await route.fulfill({json:{data:null,error:{message:'snapshot_conflict'}}});return;}
    history[row.revision]={payload:row.payload};row={revision:row.revision+1,payload:body.p_payload};saves++;
    await route.fulfill({json:{data:row.revision,error:null}});
    for(const target of pages)void target.evaluate(()=>window.dispatchEvent(new Event('synthetic-remote-change'))).catch(()=>undefined);
   });
   await page.goto('/map-test-internal?security=sync&device='+device);
   await expect(page.getByTestId('sync-status')).toHaveText('synced');
  }
  const [phone,mac]=pages;
  await mac.getByLabel('Appointment draft').fill('Keep this unfinished appointment');
  await phone.getByRole('button',{name:'Add device task',exact:true}).click();
  await expect(mac.getByTestId('sync-records')).toContainText('Task from phone');
  await expect(mac.getByLabel('Appointment draft')).toHaveValue('Keep this unfinished appointment');
  await mac.getByLabel('Appointment draft').fill('');
  await contexts[1].setOffline(true);
  await mac.getByRole('button',{name:'Add device task',exact:true}).click();
  await expect(mac.getByTestId('sync-status')).toHaveText('device_saved');
  await phone.getByRole('button',{name:'Change name',exact:true}).click();
  await expect(phone.getByTestId('sync-status')).toHaveText('synced');
  await contexts[1].setOffline(false);
  await mac.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(mac.getByTestId('name')).toHaveText('Name from phone');
  await expect(phone.getByTestId('sync-records')).toContainText('Task from mac');
  await expect(mac.getByTestId('sync-status')).toHaveText('synced');
  await contexts[1].setOffline(true);
  await mac.getByRole('button',{name:'Change name',exact:true}).click();
  await expect(mac.getByTestId('sync-status')).toHaveText('device_saved');
  // Move the phone to a different value so this is a genuine same-field collision.
  await phone.getByRole('button',{name:'Change name',exact:true}).click();
  // The prior phone name is unchanged, so explicitly advance the synthetic cloud here.
  history[row.revision]={payload:row.payload};row={revision:row.revision+1,payload:{...row.payload,profile:{...row.payload.profile,fullName:'Newest phone name'}}};
  await contexts[1].setOffline(false);await mac.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(mac.getByTestId('sync-issue')).toContainText('changed differently');
  mac.once('dialog',dialog=>dialog.accept());
  await mac.getByRole('button',{name:'Use latest cloud values',exact:true}).click();
  await expect(mac.getByTestId('name')).toHaveText('Newest phone name');
  await expect(mac.getByTestId('sync-status')).toHaveText('synced');
  mac.once('dialog',dialog=>dialog.accept());
  const download=mac.waitForEvent('download');await mac.getByRole('button',{name:'Export device sync recovery copies'}).click();
  const recovery=await download;const stream=await recovery.createReadStream();let content='';for await(const chunk of stream!)content+=chunk.toString();
  expect(JSON.parse(content).recoveries.some((entry:{payload:{profile:{fullName:string}}})=>entry.payload.profile.fullName==='Name from mac')).toBe(true);
  await contexts[1].setOffline(true);
  await mac.getByRole('button',{name:'Add device task',exact:true}).click();
  await expect(mac.getByTestId('sync-status')).toHaveText('device_saved');
  await mac.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(mac.getByText('Some changes have not reached the cloud.')).toBeVisible();
  await mac.getByRole('button',{name:'Confirm sign out',exact:true}).click();
  await expect(mac.getByText('Signed out safely')).toBeVisible();
  expect(saves).toBeGreaterThanOrEqual(3);
 }finally{for(const context of contexts)await context.close();}
});

test('subscription gate preserves account controls and never treats a success URL as payment',async({page})=>{
 let paid=false,method='';
 await page.route('**/api/account/managed-access',async route=>{method=route.request().method();await route.fulfill({json:{allowed:paid,reason:paid?'subscribed':'subscription_required',hasBilling:true,billingReady:true}});});
 await page.goto('/map-test-internal?security=billing&billing=returned');
 await expect(page.getByRole('heading',{name:'Keep your routine going'})).toBeVisible();
 expect(method).toBe('POST');
 await expect(page.getByRole('link',{name:'Export cloud records'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Manage subscription',exact:true})).toBeVisible();
 await page.route('**/api/billing/checkout',route=>route.fulfill({status:503,json:{error:'Synthetic billing connection unavailable'}}));
 await page.getByRole('button',{name:'Subscribe · $3.99 USD/month',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Synthetic billing connection unavailable'})).toHaveText('Synthetic billing connection unavailable');
 paid=true;await page.getByRole('button',{name:'Check access again'}).click();
 await expect(page.getByText('Paid workspace allowed')).toBeVisible();
});
