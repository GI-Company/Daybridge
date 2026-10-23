import {test,expect} from '@playwright/test';
const query='?notifications=test';
// The fixture is served from a temporary route; production notification URLs use the root shell.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{if(location.pathname==='/map-test-internal')history.replaceState(null,'','/'+location.search);});});
async function notify(page:import('@playwright/test').Page,url:string){
 await page.evaluate(value=>navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'DAYBRIDGE_NOTIFICATION',url:value},origin:location.origin})),url);
}
test('appointment notification survives hydration and opens the exact detail dialog',async({page})=>{
 await page.goto('/map-test-internal'+query+'&tab=schedule&event=fixture-event&date=2026-10-23');
 await expect(page.getByTestId('active-tab')).toHaveText('schedule');
 await expect(page.getByRole('dialog',{name:'Appointment details'})).toHaveCount(0);
 await page.getByRole('button',{name:'Load synced fixture records'}).click();
 await expect(page.getByRole('dialog',{name:'Appointment details'})).toContainText('Exact appointment from notification');
});
test('warm-app notifications focus the exact task and bill and preserve history',async({page})=>{
 await page.goto('/map-test-internal'+query);
 await page.getByRole('button',{name:'Load synced fixture records'}).click();
 await notify(page,'/?tab=tasks&task=fixture-task&account=fixture-account');
 await expect(page.locator('[data-notification-target="fixture-task"]')).toBeFocused();
 await expect(page.getByText('Preparation detail')).toBeVisible();
 await notify(page,'/?tab=money&bill=fixture-bill&account=fixture-account');
 await expect(page.locator('[data-notification-target="fixture-bill"]')).toBeFocused();
 await page.goBack();await expect(page.getByTestId('active-tab')).toHaveText('tasks');
});
test('dose notification selects its date and dose, while a refill opens inventory',async({page})=>{
 await page.goto('/map-test-internal'+query);await page.getByRole('button',{name:'Load synced fixture records'}).click();
 const slot='2026-10-23T12:00:00.000Z';
 await notify(page,'/?tab=health&medication=fixture-medication&date=2026-10-23&slot='+encodeURIComponent(slot));
 await expect(page.locator('[data-notification-target="fixture-medication-'+slot+'"]')).toBeFocused();
 await notify(page,'/?tab=health&medication=fixture-medication');
 await expect(page.locator('[data-notification-target="fixture-medication"]')).toBeFocused();
 await expect(page.getByText('Refill Outlook & Inventory')).toBeVisible();
});
test('removed items and another account produce useful messages without opening the wrong record',async({page})=>{
 await page.goto('/map-test-internal'+query);await page.getByRole('button',{name:'Load synced fixture records'}).click();
 await notify(page,'/?tab=tasks&task=removed-task&account=fixture-account');
 await expect(page.getByRole('status')).toContainText('This task is no longer available');
 await page.getByRole('button',{name:'Navigate Today'}).click();
 await notify(page,'/?tab=schedule&event=fixture-event&account=another-account');
 await expect(page.getByTestId('active-tab')).toHaveText('today');
 await expect(page.getByRole('status')).toContainText('another DayBridge account');
});
