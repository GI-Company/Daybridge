import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function fix(page:Page,lat=34.61,lon=-83.73,accuracy=10){await page.evaluate(({lat,lon,accuracy})=>{
 (window as unknown as {syntheticGPS:(p:unknown)=>void}).syntheticGPS({coords:{latitude:lat,longitude:lon,accuracy},timestamp:Date.now()});
},{lat,lon,accuracy});}
test.beforeEach(async({page,context})=>{
 await context.grantPermissions(['geolocation']);
 await page.clock.install({time:new Date('2026-10-24T14:00:00Z')});
 await page.addInitScript(()=>{
  let id=0;const watchers=new Map<number,{success:PositionCallback;error?:PositionErrorCallback|null}>();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   watchPosition(success:PositionCallback,error:PositionErrorCallback){watchers.set(++id,{success,error});return id;},
   clearWatch(key:number){watchers.delete(key);},getCurrentPosition(success:PositionCallback,error:PositionErrorCallback){watchers.set(++id,{success,error});}
  }});
  Object.assign(window,{syntheticGPSWatchCount:()=>watchers.size,syntheticGPS:(position:GeolocationPosition)=>watchers.forEach(w=>w.success(position)),syntheticGPSDenied:()=>watchers.forEach(w=>w.error?.({code:1,message:'Synthetic denial'} as GeolocationPositionError))});
 });
 const tile=await readFile('tests/browser/tile.png');
 await page.route('**/api/travel/map-tile/**',r=>r.fulfill({contentType:'image/png',body:tile}));
 await page.route('**/api/travel/route',r=>{const input=r.request().postDataJSON();return r.fulfill({json:{basis:'live',checkedAt:new Date().toISOString(),routes:[{durationSeconds:1200,delaySeconds:0,distanceMeters:12000,historicSeconds:null,points:[input.origin,input.destination]}]}});});
});
async function calendar(page:Page){await page.goto('/map-test-internal');await page.getByRole('button',{name:'Show calendar map',exact:true}).click();}
test('calendar routing starts from current GPS automatically and never substitutes the old saved origin',async({page})=>{
 const requests:Array<{origin:unknown}>=[];page.on('request',r=>{if(r.url().endsWith('/api/travel/route'))requests.push(r.postDataJSON());});
 await calendar(page);await expect(page.getByText('Acquiring your current location automatically.',{exact:false})).toBeVisible();
 expect(requests).toHaveLength(0);
 await fix(page);
 await expect.poll(()=>requests.length).toBeGreaterThan(0);expect(requests[0].origin).toEqual({lat:34.61,lon:-83.73});
 await expect(page.getByRole('region',{name:'Trip details'})).toContainText('From your current location');
 await page.clock.fastForward(121000);
 await expect(page.getByRole('group',{name:'Route alternatives'})).toHaveCount(0);
 await expect(page.getByText('Acquiring your current location automatically.',{exact:false})).toBeVisible();
});
test('denied or imprecise location hides travel timing instead of routing from an old saved point',async({page})=>{
 let routed=0;page.on('request',r=>{if(r.url().endsWith('/api/travel/route'))routed++;});
 await calendar(page);await fix(page,34.61,-83.73,1000);
 await expect(page.getByText('An accurate location is unavailable.',{exact:false})).toBeVisible();expect(routed).toBe(0);
 await page.evaluate(()=>(window as unknown as {syntheticGPSDenied:()=>void}).syntheticGPSDenied());
 await expect(page.getByText('Location access is denied.',{exact:false})).toBeVisible();expect(routed).toBe(0);
});
test('the foreground heartbeat uses the connected device and keeps live coordinates out of saved records',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator.serviceWorker,'getRegistration',{configurable:true,value:async()=>({pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/synthetic-device'})}})}));
 const bodies:Array<{endpoint:string;fix:{point:{lat:number;lon:number}}}>=[];
 await page.route('**/api/travel/live-check',r=>{bodies.push(r.request().postDataJSON());return r.fulfill({json:{checked:true}});});
 await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 await fix(page,34.61111,-83.73333);
 await expect.poll(()=>bodies.length).toBe(1);
 expect(bodies[0]).toMatchObject({endpoint:'https://fcm.googleapis.com/synthetic-device',fix:{point:{lat:34.61111,lon:-83.73333}}});
 const saved=await page.evaluate(()=>sessionStorage.getItem('synthetic-remote-synthetic-polish')||'');expect(saved).not.toContain('34.61111');
 await page.clock.fastForward(121000);
 const prior=bodies.length;await page.clock.fastForward(60000);expect(bodies.length).toBe(prior);
});
test('opening an appointment reminder automatically requests GPS and calculates the early-arrival target',async({page})=>{
 const inputs:Array<{origin:unknown;arriveAt:string}>=[];
 await page.route('**/api/travel/route',r=>{
  const input=r.request().postDataJSON();inputs.push(input);
  return r.fulfill({json:{basis:'historical',checkedAt:'2026-10-24T14:00:00Z',routes:[{durationSeconds:1800,delaySeconds:300,distanceMeters:10000,historicSeconds:1800,points:[input.origin,input.destination],departureTime:'2026-10-26T21:45:00Z',arrivalTime:'2026-10-26T22:15:00Z',instructions:['Follow the synthetic road.']}]}});
 });
 // Root notification URLs are rewritten to the temporary test shell only in this fixture.
 await page.addInitScript(()=>{if(location.pathname==='/map-test-internal')history.replaceState(null,'','/'+location.search);});
 await page.goto('/map-test-internal?notifications=test&gps=test&tab=schedule&event=fixture-event&date=2026-10-26');
 await page.getByRole('button',{name:'Load synced fixture records'}).click();
 const planner=page.getByRole('region',{name:'Appointment travel planner'});
 await expect(planner).toBeVisible();expect(inputs).toHaveLength(0);
 await fix(page);
 await expect.poll(()=>inputs.length).toBeGreaterThan(0);
 expect(inputs[0]).toMatchObject({origin:{lat:34.61,lon:-83.73},arriveAt:'2026-10-26T22:15:00.000Z'});
 await expect(planner).toContainText('Arrival if leaving at leave-by');
 await expect(planner).toContainText('6:15 PM');await expect(planner).toContainText('5:45 PM');await expect(planner).toContainText('6:30 PM');
 await expect(planner.getByText('Estimated ETA',{exact:true})).toHaveCount(0);
 await planner.locator('summary').filter({hasText:'Turn-by-turn route instructions'}).click();await expect(planner).toContainText('Follow the synthetic road.');
});

test('the reminder slider below Arrive early saves one-to-five-hour timing and keeps notification settings in sync',async({page})=>{
 await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:/Settings & security/}).last().click();
 await page.locator('summary').filter({hasText:'Travel notifications & location settings'}).click();
 const slider=page.getByRole('slider',{name:/Remind me:/});
 await expect(slider).toHaveAttribute('max','300');
 await slider.fill('180');await expect(slider).toHaveAttribute('aria-valuetext','3 hours before departure');
 const appointment=page.getByLabel('Appointment reminder lead time',{exact:true});await expect(appointment).toHaveValue('180');
 await slider.fill('300');await expect(appointment).toHaveValue('300');
 await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 await page.reload();await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:/Settings & security/}).last().click();
 await expect(page.getByLabel('Appointment reminder lead time',{exact:true})).toHaveValue('300');
});

test('locking stops GPS without discarding the mounted draft, and unlocking reacquires it',async({page})=>{
 await page.goto('/map-test-internal?security=lock&gpsmap=test');
 await expect(page.getByText('Loading interactive map…')).toBeHidden({timeout:20000});await expect(page.getByLabel('Unsaved synthetic draft')).toBeVisible();
 await page.getByLabel('Unsaved synthetic draft').fill('Preserve this draft');await fix(page);
 await expect(page.getByTestId('lock-location')).toHaveText('current');await expect(page.getByText('Live device location enabled',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lock test workspace',exact:true}).click();
 await expect(page.getByLabel('Unsaved synthetic draft')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {syntheticGPSWatchCount:()=>number}).syntheticGPSWatchCount())).toBe(0);
 await page.getByLabel('Account password').fill('synthetic-password');await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await expect(page.getByLabel('Unsaved synthetic draft')).toHaveValue('Preserve this draft');
 await page.getByRole('button',{name:'Find my location',exact:true}).waitFor();
 await fix(page);await expect(page.getByTestId('lock-location')).toHaveText('current');await expect(page.getByText('Live device location enabled',{exact:true})).toBeVisible();
});
