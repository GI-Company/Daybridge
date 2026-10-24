import {test,expect,type Page} from '@playwright/test';
const url='/map-test-internal?checkin=test';
async function records(page:Page){return JSON.parse(await page.getByTestId('check-in-records').innerText());}
async function add(page:Page){
 await page.getByRole('button',{name:'Add synthetic appointment'}).click();
 await page.getByLabel('Appointment type').selectOption('drug_testing');
 await expect(page.getByLabel('Repeat',{exact:true})).toHaveValue('daily');
 await page.getByLabel('Start time',{exact:true}).fill('10:00');
 await page.getByLabel('End time',{exact:true}).fill('11:00');
 await expect(page.getByLabel('Location or meeting link (optional)')).toHaveCount(0);
 await page.getByRole('button',{name:'Save Check-in',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(async()=> (await records(page)).events.length).toBe(2);
 await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
}
test.beforeEach(async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>sessionStorage.getItem('synthetic-check-in-offline')!=='yes'}));await page.clock.install({time:new Date('2026-10-24T14:01:00Z')});await page.goto(url);await expect(page.getByTestId('check-in-sync')).toHaveText('synced');});
test('daily check-in saves its window, completes only today, survives reload, and can be undone from Today',async({page})=>{
 await add(page);
 const saved=await records(page),event=saved.events.find((x:{checkInReminderMinutes?:number})=>x.checkInReminderMinutes===15);
 expect(event).toMatchObject({title:'Drug test check-in',rrule:'FREQ=DAILY',startTime:'2026-10-24T10:00:00',endTime:'2026-10-24T11:00:00',venueType:'phone',travelBufferMinutes:0});
 expect(saved.reminders).toHaveLength(1);expect(saved.tomorrowReminders).toHaveLength(1);
 expect(saved.tasks[0].title).toBe('Existing task to preserve');
 const day=page.getByRole('region',{name:'Selected day schedule'});
 await day.getByRole('button').filter({hasText:'Drug test check-in'}).click();
 const dialog=page.getByRole('dialog',{name:'Appointment details'});
 await expect(dialog.getByRole('button',{name:'Attended',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect.poll(async()=> (await records(page)).reminders.length).toBe(0);
 expect((await records(page)).tomorrowReminders).toHaveLength(1);
 await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
 await page.reload();await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
 expect((await records(page)).occurrences[0]).toMatchObject({attendanceStatus:'unconfirmed'});
 expect((await records(page)).reminders).toHaveLength(0);
 await page.getByRole('button',{name:'Switch Today / Schedule'}).click();
 await page.getByRole('button',{name:'Undo done',exact:true}).click();
 await expect.poll(async()=> (await records(page)).reminders.length).toBe(1);
 await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
 const cloud=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-remote-synthetic-check-in')!));
 expect(cloud.payload.customPreservedField).toEqual({value:'preserve-me'});
 expect(cloud.payload.events.find((x:{id:string})=>x.id==='legacy-event').rrule).toBe('FREQ=WEEKLY');
});
test('offline completion stays on the device through reload and syncs without losing previous records',async({page,context})=>{
 await add(page);await page.getByRole('button',{name:'Switch Today / Schedule'}).click();
 await page.evaluate(()=>sessionStorage.setItem('synthetic-check-in-offline','yes'));
 await context.setOffline(true);
 await page.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(page.getByTestId('check-in-sync')).toHaveText(/device_saved|offline/);
 await expect(page.getByRole('status')).toContainText('Waiting to sync');
 // Keep the page available locally while the simulated remote continues to reject writes.
 await context.setOffline(false);
 await page.reload();
 await expect.poll(async()=> (await records(page)).occurrences[0]?.checkInCompletedAt).toBeTruthy();
 expect((await records(page)).tasks).toHaveLength(1);
 await page.evaluate(()=>{sessionStorage.removeItem('synthetic-check-in-offline');window.dispatchEvent(new Event('online'));});
 await page.getByRole('button',{name:'Flush check-in edits'}).click();
 await expect(page.getByTestId('check-in-sync')).toHaveText('synced');
 expect((await records(page)).reminders).toHaveLength(0);
 const cloud=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-remote-synthetic-check-in')!));
 expect(cloud.payload.eventOccurrences[0].checkInCompletedAt).toBeTruthy();
 expect(cloud.payload.events).toHaveLength(2);expect(cloud.payload.tasks).toHaveLength(1);
});
test('an invalid window cannot save and ordinary appointments can repeat daily too',async({page})=>{
 await page.getByRole('button',{name:'Add synthetic appointment'}).click();
 await page.getByLabel('Appointment type').selectOption('drug_testing');
 await page.getByLabel('Start time',{exact:true}).fill('10:00');await page.getByLabel('End time',{exact:true}).fill('09:00');
 await page.getByRole('button',{name:'Save Check-in',exact:true}).click();
 await expect(page.locator('p[role=alert]')).toContainText('end time after the start');
 await page.getByLabel('End time',{exact:true}).fill('11:00');
 await page.getByLabel('Appointment type').selectOption('personal');
 await page.getByPlaceholder('e.g. Appointment or shift').fill('Daily ordinary appointment');
 await page.getByRole('button',{name:'Save Appointment',exact:true}).click();
 await expect.poll(async()=> (await records(page)).events.length).toBe(2);
 const event=(await records(page)).events.find((x:{id:string})=>x.id!=='legacy-event');
 expect(event.rrule).toBe('FREQ=DAILY');expect(event.checkInReminderMinutes).toBeUndefined();
});

test('check-in notification opens its exact day and Court uses task completion independently of attendance',async({page})=>{
 await add(page);
 await page.getByRole('button',{name:'Open Court',exact:true}).click();
 const checkIn=page.getByRole('region',{name:'Drug test check-in'});
 await expect(checkIn).toBeVisible();
 await expect(page.getByRole('button',{name:'Mark Attended',exact:true})).toHaveCount(0);
 await checkIn.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect.poll(async()=> (await records(page)).reminders.length).toBe(0);
 const next=(await records(page)).tomorrowReminders[0].url;
 await page.evaluate(value=>navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'DAYBRIDGE_NOTIFICATION',url:value},origin:location.origin})),next);
 const dialog=page.getByRole('dialog',{name:'Appointment details'});
 await expect(dialog).toContainText('Oct 25, 2026');
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect.poll(async()=> (await records(page)).tomorrowReminders.length).toBe(0);
 expect((await records(page)).occurrences).toHaveLength(2);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Switch Today / Schedule'}).click();
 await page.getByRole('button',{name:'Undo done',exact:true}).click();
 await expect.poll(async()=> (await records(page)).reminders.length).toBe(1);
 expect((await records(page)).tomorrowReminders).toHaveLength(0);
});
