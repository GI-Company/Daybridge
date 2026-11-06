import {test,expect,type Page} from '@playwright/test';
const court='a1000000-0000-4000-8000-000000000010',circuit='a1000000-0000-4000-8000-000000000011';
const seed=()=>({states:[{code:'GA',name:'Georgia'}],circuits:[{id:circuit,state_code:'GA',name:'Beta Circuit',login_slug:'beta'}],courts:[{id:court,circuit_id:circuit,court_name:'Beta Court',login_slug:'beta-court',seat_limit:25,occupied_seats:2,subscription_status:'pilot',listed:false,enabled:true,is_demo:true}],staff:[] as {court_id:string;user_id:string;role:string;active:boolean;username:string}[]});
async function fixture(page:Page){
 const data=seed(),mutations:Record<string,unknown>[]=[];
 await page.route('**/api/owner/setup',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:data});
  const input=route.request().postDataJSON();mutations.push(input);
  if(input.action==='create')data.courts.push({...data.courts[0],...input,id:'a1000000-0000-4000-8000-000000000012',occupied_seats:0});
  if(input.action==='update')Object.assign(data.courts.find(c=>c.id===input.court_id)!,input);
  if(input.action==='assign_staff'&&data.staff.some(s=>s.username===input.username)){data.staff.find(s=>s.username===input.username)!.active=true;return route.fulfill({json:{court_id:court}});}
  if(input.action==='assign_staff')data.staff.push({court_id:input.court_id,user_id:'a1000000-0000-4000-8000-000000000020',username:input.username,role:input.role,active:true});
  if(input.action==='revoke_staff')data.staff[0].active=false;
  return route.fulfill({status:input.action==='create'?201:200,json:{court_id:input.action==='create'?data.courts[1].id:court}});
 });
 await page.route('**/api/owner/staff/activity?*',route=>route.fulfill({json:{entries:[{id:'history-1',action:'participant_created',created_at:'2026-11-06T12:00:00Z',relation:'Performed by this staff member'},{id:'history-2',action:'owner_revoke_staff',created_at:'2026-11-06T13:00:00Z',relation:'Affected this staff member'}],nextCursor:null}}));
 await page.route('**/api/owner/staff',async route=>{
  const input=route.request().postDataJSON();mutations.push(input);
  if(route.request().method()==='POST')data.staff.push({court_id:input.court_id,user_id:'a1000000-0000-4000-8000-'+String(data.staff.length+20).padStart(12,'0'),username:input.username,role:input.role,active:true});
  const username=input.username||data.staff.find(s=>s.user_id===input.user_id)!.username;
  return route.fulfill({status:route.request().method()==='POST'?201:200,json:{username,email:username+'@ga.beta.beta-court',temporaryPassword:'FictionalStaffSecret_123'}});
 });
 await page.goto('/map-test-internal?owner=test');await expect(page.getByRole('navigation',{name:'Owner dashboard'})).toBeVisible();return {data,mutations};
}
test('owner creates a court using an existing hierarchy and gets accurate setup feedback',async({page})=>{
 const state=await fixture(page);
 await page.getByRole('button',{name:'Add a court',exact:true}).click();
 await page.getByLabel('State code',{exact:true}).fill('GA');await expect(page.getByLabel('State name',{exact:true})).toHaveValue('Georgia');
 await page.getByLabel('Judicial circuit',{exact:true}).fill('Beta Circuit');await expect(page.getByLabel('Circuit sign-in code',{exact:true})).toHaveValue('beta');
 await page.getByLabel('Court name',{exact:true}).fill('New Beta Court');await expect(page.getByLabel('Court sign-in code',{exact:true})).toHaveValue('new-beta-court');
 await expect(page.getByLabel('Participant seats',{exact:true})).toHaveValue('25');
 await expect(page.getByRole('checkbox',{name:'Show in public court directory',exact:true})).not.toBeChecked();
 await page.getByRole('checkbox',{name:'Show in public court directory',exact:true}).check();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Create court',exact:true}).click();expect(state.mutations).toHaveLength(0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Create court',exact:true}).click();await expect(page.getByText('Court created.',{exact:false})).toBeVisible();await expect(page.getByRole('combobox',{name:'Select court',exact:true})).toHaveValue('a1000000-0000-4000-8000-000000000012');
 expect(state.mutations[0]).toMatchObject({state_code:'GA',circuit_slug:'beta',seat_limit:25,listed:true,is_demo:true});
});
test('staff assignment uses the court alias, requires confirmation, and revokes without deleting records',async({page})=>{
 const state=await fixture(page);await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 await page.getByRole('button',{name:'Link existing login',exact:true}).click();await page.getByLabel('Staff username',{exact:true}).fill('manager');await expect(page.getByLabel('Required staff sign-in',{exact:true})).toHaveValue('manager@ga.beta.beta-court');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Assign verified staff'}).click();await expect(page.getByText('manager',{exact:true})).toBeVisible();expect(state.mutations[0].role).toBe('case_manager');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Revoke access for manager',exact:true}).click();await expect(page.getByText('Staff access revoked. Account and audit history retained.',{exact:true})).toBeVisible();expect(state.data.courts[0].occupied_seats).toBe(2);
});
test('unauthorized accounts see no owner forms and a late response cannot restore a signed-out dashboard',async({page})=>{
 await page.route('**/api/owner/setup',r=>r.fulfill({status:403,json:{error:'Owner access required'}}));
 await page.goto('/map-test-internal?owner=test');await expect(page.getByRole('heading',{name:'Owner access required'})).toBeVisible();await expect(page.getByRole('button',{name:'Create court',exact:true})).toHaveCount(0);
 await page.unroute('**/api/owner/setup');await fixture(page);await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 let release=()=>{};let received=()=>{};const wait=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{received=r;});
 await page.route('**/api/owner/setup',async r=>{if(r.request().method()==='POST'){received();await wait;return r.fulfill({json:{court_id:court}});}return r.fulfill({json:seed()});});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save court settings'}).click();await started;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('synthetic-owner-auth',{detail:null})));release();
 await expect(page.getByRole('heading',{name:'Owner sign in'})).toBeVisible();await expect(page.getByRole('heading',{name:'Add a court',exact:true})).toHaveCount(0);await expect(page.getByText('Court settings saved.',{exact:true})).toHaveCount(0);
});


test('overview, court search, instructions and security explanations form a responsive dashboard',async({page},testInfo)=>{
 await fixture(page);
 await expect(page.getByRole('region',{name:'Program totals'})).toContainText('23');
 await expect(page.getByText('Needs staff',{exact:true})).toBeVisible();
 await expect(page.getByText('Your activity log is ready',{exact:true})).toBeVisible();
 await page.screenshot({path:'/private/tmp/daybridge-owner-dashboard-'+testInfo.project.name+'.png',fullPage:true});
 const navigation=page.getByRole('navigation',{name:'Owner dashboard'});
 await navigation.getByRole('button',{name:'Courts',exact:true}).click();
 await page.getByLabel('Search courts',{exact:true}).fill('not-a-court');await expect(page.getByText('No courts match',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByRole('button',{name:'Manage Beta Court',exact:true})).toBeVisible();
 await navigation.getByRole('button',{name:'Setup guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Set up a court in five steps',exact:true})).toBeVisible();
 await expect(page.getByText('a court can have multiple staff accounts',{exact:false})).toBeVisible();
 await navigation.getByRole('button',{name:'Security & account',exact:true}).click();await expect(page.getByRole('heading',{name:'How owner access is protected',exact:true})).toBeVisible();
 await expect(page.getByText('This dashboard currently does not require multi-factor authentication.',{exact:false})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Change password',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('instructions retain draft fields and refresh requires permission to discard them',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Add a court',exact:true}).click();
 await page.getByLabel('Court name',{exact:true}).fill('Unsaved draft court');
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Setup guide',exact:true}).click();
 await page.getByRole('button',{name:'Add a court',exact:true}).click();await expect(page.getByLabel('Court name',{exact:true})).toHaveValue('Unsaved draft court');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Refresh dashboard',exact:true}).click();await expect(page.getByLabel('Court name',{exact:true})).toHaveValue('Unsaved draft court');
});


test('owner creates multiple staff, resets once, revokes while retaining history, and restores access',async({page},testInfo)=>{
 const state=await fixture(page);
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 const credentials=page.getByRole('status',{name:'Temporary credentials'});
 for(const username of ['manager','colleague']){
  await page.getByLabel('Staff username',{exact:true}).fill(username);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Create staff account',exact:true}).click();
  await expect(credentials).toContainText(username+'@ga.beta.beta-court');
  await expect(credentials).not.toContainText('FictionalStaffSecret_123');
  await credentials.getByRole('button',{name:'Show temporary password'}).click();await expect(credentials).toContainText('FictionalStaffSecret_123');
  await expect(credentials.getByRole('link',{name:'Court staff portal'})).toHaveAttribute('href','/admin?court_id='+court);
  await credentials.getByRole('button',{name:'Dismiss credentials'}).click();
 }
 expect(state.data.staff).toHaveLength(2);expect(state.data.courts[0].occupied_seats).toBe(2);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset password for manager',exact:true}).click();expect(state.mutations).toHaveLength(2);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset password for manager',exact:true}).click();await expect(credentials).toBeVisible();
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Setup guide',exact:true}).click();await expect(credentials).toBeHidden();
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Revoke access for manager',exact:true}).click();
 await expect(page.getByRole('button',{name:'Restore access for manager',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Revoke access for colleague',exact:true})).toBeVisible();expect(state.data.staff).toHaveLength(2);
 await page.getByRole('button',{name:'View audit history for manager',exact:true}).click();const history=page.getByRole('region',{name:'Audit history for manager',exact:true});await expect(history).toContainText('Staff access revoked');await expect(history).toContainText('Performed by this staff member');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/private/tmp/daybridge-staff-management-'+testInfo.project.name+'.png',fullPage:true});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore access for manager',exact:true}).click();await expect(page.getByRole('button',{name:'Reset password for manager',exact:true})).toBeVisible();
});
test('late staff credentials never appear after owner sign-out',async({page})=>{
 await fixture(page);await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 let release=()=>{};let receive=()=>{};const waiting=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{receive=r;});
 await page.route('**/api/owner/staff',async route=>{receive();await waiting;return route.fulfill({status:201,json:{username:'manager',email:'manager@ga.beta.beta-court',temporaryPassword:'FictionalLateStaffSecret'}});});
 await page.getByLabel('Staff username',{exact:true}).fill('manager');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Create staff account',exact:true}).click();await started;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('synthetic-owner-auth',{detail:null})));release();await expect(page.getByRole('heading',{name:'Owner sign in'})).toBeVisible();await expect(page.getByRole('status',{name:'Temporary credentials'})).toHaveCount(0);
});

test('directory changes survive staff setup and publish only after saving court settings',async({page})=>{
 const state=await fixture(page);
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();
 await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();
 const listed=page.getByRole('checkbox',{name:'Show in public directory',exact:true});
 await listed.check();
 await expect(page.getByText('Unsaved court settings.',{exact:false})).toBeVisible();
 await page.getByLabel('Staff username',{exact:true}).fill('manager');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Create staff account',exact:true}).click();
 await expect(page.getByRole('status',{name:'Temporary credentials'})).toBeVisible();
 await expect(listed).toBeChecked();expect(state.data.courts[0].listed).toBe(false);
 await page.getByRole('navigation',{name:'Owner dashboard'}).getByRole('button',{name:'Courts',exact:true}).click();
 await page.getByRole('button',{name:'Manage Beta Court',exact:true}).click();await expect(listed).toBeChecked();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save court settings',exact:true}).click();
 await expect(page.getByText('Saved: this court appears in the public staff sign-in directory.',{exact:true})).toBeVisible();
 expect(state.data.courts[0].listed).toBe(true);
 await expect(page.getByRole('link',{name:'Open this court in staff portal',exact:true})).toHaveAttribute('href','/admin?court_id='+court);
 await page.getByRole('button',{name:'Refresh dashboard',exact:true}).click();await expect(listed).toBeChecked();
});
