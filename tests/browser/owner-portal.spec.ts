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
  if(input.action==='assign_staff')data.staff.push({court_id:input.court_id,user_id:'a1000000-0000-4000-8000-000000000020',username:input.username,role:input.role,active:true});
  if(input.action==='revoke_staff')data.staff[0].active=false;
  return route.fulfill({status:input.action==='create'?201:200,json:{court_id:input.action==='create'?data.courts[1].id:court}});
 });
 await page.goto('/map-test-internal?owner=test');await expect(page.getByRole('heading',{name:'Add a court',exact:true})).toBeVisible();return {data,mutations};
}
test('owner creates a court using an existing hierarchy and gets accurate setup feedback',async({page})=>{
 const state=await fixture(page);
 await page.getByLabel('State code',{exact:true}).fill('GA');await expect(page.getByLabel('State name',{exact:true})).toHaveValue('Georgia');
 await page.getByLabel('Judicial circuit',{exact:true}).fill('Beta Circuit');await expect(page.getByLabel('Circuit sign-in code',{exact:true})).toHaveValue('beta');
 await page.getByLabel('Court name',{exact:true}).fill('New Beta Court');await expect(page.getByLabel('Court sign-in code',{exact:true})).toHaveValue('new-beta-court');
 await expect(page.getByLabel('Participant seats',{exact:true})).toHaveValue('25');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Create court',exact:true}).click();expect(state.mutations).toHaveLength(0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Create court',exact:true}).click();await expect(page.getByText('Court created.',{exact:false})).toBeVisible();await expect(page.getByRole('combobox',{name:'Select court',exact:true})).toHaveValue('a1000000-0000-4000-8000-000000000012');
 expect(state.mutations[0]).toMatchObject({state_code:'GA',circuit_slug:'beta',seat_limit:25,listed:false,is_demo:true});
});
test('staff assignment uses the court alias, requires confirmation, and revokes without deleting records',async({page})=>{
 const state=await fixture(page);await page.getByRole('combobox',{name:'Select court',exact:true}).selectOption(court);
 await page.getByLabel('Staff username',{exact:true}).fill('manager');await expect(page.getByLabel('Required staff sign-in',{exact:true})).toHaveValue('manager@ga.beta.beta-court');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Assign verified staff'}).click();await expect(page.getByText('manager',{exact:true})).toBeVisible();expect(state.mutations[0].role).toBe('case_manager');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Revoke access'}).click();await expect(page.getByText('Staff access revoked.',{exact:true})).toBeVisible();expect(state.data.courts[0].occupied_seats).toBe(2);
});
test('unauthorized accounts see no owner forms and a late response cannot restore a signed-out dashboard',async({page})=>{
 await page.route('**/api/owner/setup',r=>r.fulfill({status:403,json:{error:'Owner access required'}}));
 await page.goto('/map-test-internal?owner=test');await expect(page.getByRole('heading',{name:'Owner access required'})).toBeVisible();await expect(page.getByRole('button',{name:'Create court',exact:true})).toHaveCount(0);
 await page.unroute('**/api/owner/setup');await fixture(page);await page.getByRole('combobox',{name:'Select court',exact:true}).selectOption(court);
 let release=()=>{};let received=()=>{};const wait=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{received=r;});
 await page.route('**/api/owner/setup',async r=>{if(r.request().method()==='POST'){received();await wait;return r.fulfill({json:{court_id:court}});}return r.fulfill({json:seed()});});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save court settings'}).click();await started;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('synthetic-owner-auth',{detail:null})));release();
 await expect(page.getByRole('heading',{name:'Owner sign in'})).toBeVisible();await expect(page.getByRole('heading',{name:'Add a court',exact:true})).toHaveCount(0);await expect(page.getByText('Court settings saved.',{exact:true})).toHaveCount(0);
});
