import {test,expect} from '@playwright/test';
const court='d6000000-0000-4000-8000-000000000001',user='d6000000-0000-4000-8000-000000000003';
const now=()=>new Date().toISOString();
test('participant sharing is default-off and requires category plus explicit item/history choices',async({page},info)=>{
 const data={enabled:true,court_id:court,consents:[] as {category:string;enabled:boolean;enabled_at:string}[],items:[] as {source_kind:string;source_id:string;category:string;include_history:boolean;share_from:string;needs_review?:boolean}[],events:[],history:[]};
 const posts:Record<string,unknown>[]=[];
 page.on('dialog',d=>d.accept());
 await page.route('**/api/participant/reporting',async route=>{
  if(route.request().method()==='POST'){
   const input=route.request().postDataJSON();posts.push(input);
   if(input.action==='consent'){data.consents=[{category:input.category,enabled:input.enabled,enabled_at:now()}];if(!input.enabled)data.items=[];}
   if(input.action==='share')data.items=[{source_kind:input.source_kind,source_id:input.source_id,category:input.category,include_history:input.include_history,share_from:input.history_from||now()}];
   if(input.action==='unshare')data.items=[];
  }await route.fulfill({json:data});
 });
 await page.goto('/map-test-internal?reporting=participant');
 await expect(page.getByRole('heading',{name:'Sharing with My Court'})).toBeVisible();
 await expect(page.getByText('No items selected.',{exact:false})).toBeVisible();
 for(const check of await page.getByRole('checkbox').all())await expect(check).not.toBeChecked();
 await page.getByRole('checkbox',{name:'Court-program meetings',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Court-program meetings',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'Share selected item',exact:true})).toBeDisabled();
 await page.getByLabel('Private item name (only you see this)').selectOption('event:private-court-event');
 await page.getByRole('button',{name:'Share selected item',exact:true}).click();
 expect(posts.at(-1)).toEqual({action:'share',source_kind:'event',source_id:'private-court-event',category:'meeting',include_history:false});
 await expect(page.getByText('Future activity only',{exact:false})).toBeVisible();
 data.items[0].needs_review=true;await page.getByRole('button',{name:'Refresh sharing history'}).click();await expect(page.getByText('Schedule or court link changed.',{exact:false})).toBeVisible();
 await page.getByRole('checkbox',{name:'Separately include historical activity for this selected item'}).check();
 await expect(page.getByRole('button',{name:'Share selected item',exact:true})).toBeDisabled();
 await page.getByLabel('Include activity on or after',{exact:false}).fill(new Date(Date.now()-86400000).toISOString().slice(0,10));
 await page.getByRole('button',{name:'Share selected item',exact:true}).click();expect(posts.at(-1)?.include_history).toBe(true);
 await page.getByRole('checkbox',{name:'Court-program meetings',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Court-program meetings',exact:true})).not.toBeChecked();await expect(page.getByRole('button',{name:'Stop sharing item'})).toHaveCount(0);
 expect(JSON.stringify(posts)).not.toContain('Private court meeting title');
 await page.screenshot({path:'/private/tmp/daybridge-progress-consent-'+info.project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('staff dashboard shows limited self-reports, filters, unknowns and disabled state',async({page},info)=>{
 let enabled=true;const queries:URLSearchParams[]=[];
 await page.route('**/api/admin/progress?*',async route=>{
  queries.push(new URL(route.request().url()).searchParams);
  await route.fulfill({json:enabled?{enabled:true,updated_at:now(),participants:[{user_id:user,username:'fictional_pilot_01',status:'active',sharing_categories:1,last_reported_at:now()},{user_id:'disabled-user',username:'fictional_pilot_02',status:'active',sharing_categories:0,last_reported_at:null}],events:[{id:'safe-1',user_id:user,username:'fictional_pilot_01',category:'meeting',status:'complete',scheduled_at:now(),ends_at:now(),reported_at:now(),updated_at:now(),provenance:'participant_self_report'}],summary:{shared:1,complete:1,incomplete:0,not_reported:0,upcoming:0},weekly:[{period:now(),shared:1,complete:1}],monthly:[{period:now(),shared:1,complete:1}]}:{enabled:false}});
 });
 await page.goto('/map-test-internal?reporting=staff');await expect(page.getByRole('heading',{name:'Participant Progress'})).toBeVisible();
 await expect(page.getByText('Sharing disabled',{exact:true})).toBeVisible();await expect(page.getByText('Not enough information',{exact:true})).toHaveCount(0);
 await page.getByLabel('Activity category').selectOption('meeting');await expect.poll(()=>queries.at(-1)?.get('category')).toBe('meeting');
 await page.getByRole('button',{name:'fictional_pilot_01',exact:true}).click();await expect.poll(()=>queries.at(-1)?.get('participant')).toBe(user);
 await expect(page.getByRole('heading',{name:'Participant overview'})).toBeVisible();
 await page.screenshot({path:'/private/tmp/daybridge-progress-staff-'+info.project.name+'.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 enabled=false;await page.getByRole('button',{name:'Refresh progress',exact:true}).click();await expect(page.getByRole('heading',{name:'Reporting disabled for this court'})).toBeVisible();await expect(page.getByRole('heading',{name:'Shared activity details'})).toHaveCount(0);
});
test('staff report denies an unauthorized account without displaying progress',async({page})=>{
 await page.route('**/api/admin/progress?*',route=>route.fulfill({status:403,json:{error:'Court reporting access denied'}}));
 await page.goto('/map-test-internal?reporting=staff');await expect(page.getByRole('alert').filter({hasText:'Court reporting access denied'})).toContainText('Court reporting access denied');await expect(page.getByRole('heading',{name:'Shared activity details'})).toHaveCount(0);
});

test('court-level default-off blocks participant sharing and publishes no activity',async({page})=>{
 let writes=0;
 await page.route('**/api/participant/reporting',async route=>{if(route.request().method()!=='GET')writes++;await route.fulfill({json:{enabled:false,court_id:court,consents:[],items:[],events:[],history:[]}});});
 await page.goto('/map-test-internal?reporting=participant');await expect(page.getByText('Court reporting is disabled.',{exact:false})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Court-program meetings',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Share selected item',exact:true})).toHaveCount(0);expect(writes).toBe(0);
});

test('tablet report controls fit the viewport and disabled state remains readable',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 await page.route('**/api/admin/progress?*',route=>route.fulfill({json:{enabled:false}}));
 await page.goto('/map-test-internal?reporting=staff');await expect(page.getByRole('heading',{name:'Reporting disabled for this court'})).toBeVisible();
 await expect(page.getByLabel('Activity category')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
