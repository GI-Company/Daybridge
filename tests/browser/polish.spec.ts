import {test,expect,type Page} from '@playwright/test';
async function more(page:Page,label:string){await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:new RegExp(label)}).last().click();}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-24T14:00:00Z')});await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');});
test('budget and Today show a positive shortfall, correct payday date and twelve calendar days',async({page})=>{
 await expect(page.getByText('You need $39.83 more',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Budget',exact:true}).last().click();
 await expect(page.getByText('You need $39.83 more to cover planned obligations')).toBeVisible();
 await expect(page.getByText('Next Payday: Nov 5, 2026 (12d)',{exact:true})).toBeVisible();
});
test('calendar heading shows a future date once',async({page})=>{
 await page.getByRole('button',{name:'Schedule',exact:true}).last().click();
 await page.getByLabel('Jump to date').fill('2026-11-02');
 await expect(page.getByRole('heading',{name:'Mon, Nov 2, 2026',exact:true})).toBeVisible();
});
test('weekly summary expands detail, reports true statuses, and includes it in native printing and CSV',async({page})=>{
 await more(page,'Weekly review');
 const details=page.locator('details').filter({has:page.getByText('Recent & upcoming obligations',{exact:false})}).first();
 await expect(details).not.toHaveAttribute('open','');
 await expect(page.getByLabel('Personal reflection & notes')).toBeEmpty();
 await details.locator('summary').click();
 await expect(details).toContainText('Upcoming');await expect(details).toContainText('Attended (self-reported)');
 await expect(page.getByText('Self-reported active')).toHaveCount(0);
 await details.locator('summary').click();
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 await expect(details).toHaveAttribute('open','');
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await expect(details).not.toHaveAttribute('open','');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();
 const stream=await (await download).createReadStream(),chunks=[];for await(const chunk of stream!)chunks.push(chunk);
 expect(Buffer.concat(chunks).toString()).toContain('Community workshop');
});
test('medications keep doses first and preserve management and schedule editing behind one expansion',async({page})=>{
 await more(page,'Medications');
 await expect(page.getByRole('button',{name:'Mark Taken',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Edit times',exact:true})).toBeHidden();
 await page.locator('summary').filter({hasText:'Manage medications & dose times'}).click();
 await page.getByRole('button',{name:'Edit times',exact:true}).click();
 await expect(page.getByLabel('Dose 1',{exact:true})).toHaveValue('08:00');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Mark Taken',exact:true}).click();
 await expect(page.getByRole('button',{name:'Undo dose entry',exact:true})).toBeVisible();
});
