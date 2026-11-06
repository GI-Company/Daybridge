import {test,expect,type Page} from '@playwright/test';
const court='da730f6c-165a-4af2-b135-4fc06993e46b',second='a724d697-7304-4763-aa96-09f62c2a5824';
const directory=[{id:court,state_code:'GA',state_name:'Georgia',circuit_id:'synthetic-enotah',circuit_name:'Enotah Judicial Circuit',circuit_slug:'enotah',court_name:'DayBridge STAR Court Test',court_slug:'starcourt'},{id:second,state_code:'GA',state_name:'Georgia',circuit_id:'synthetic-enotah',circuit_name:'Enotah Judicial Circuit',circuit_slug:'enotah',court_name:'Other Test Court',court_slug:'other'}];
async function fixture(page:Page){
 const participants=[{user_id:'synthetic-one',username:'participant001',status:'active',created_at:'2026-11-01T14:24:00Z',created_by_label:'You'},{user_id:'synthetic-two',username:'participant002',status:'active',created_at:'2026-11-01T13:00:00Z',created_by_label:'Court staff'},{user_id:'synthetic-three',username:'participant003',status:'suspended',created_at:'2026-11-01T12:00:00Z',created_by_label:'You'}];
 const activity:Array<{id:string;action:string;username:string;actor_label:string;created_at:string}>=[];
 let creates=0,changes=0;
 await page.route('**/api/admin/courts',route=>route.fulfill({json:{courts:directory}}));
 await page.route('**/api/admin/activity?*',route=>route.fulfill({json:{entries:activity,nextCursor:null}}));
 await page.route('**/api/admin/participants**',async route=>{
  const request=route.request();
  if(request.method()==='GET'){
   if(new URL(request.url()).searchParams.get('court_id')!==court)return route.fulfill({status:403,json:{error:'You are not assigned to this court'}});
   return route.fulfill({json:{court:{id:court,name:'DayBridge STAR Court Test',is_demo:true,seat_limit:25,subscription_plan:'pilot',subscription_status:'pilot'},participants:participants.filter(p=>p.status!=='removed'),occupied_seats:participants.filter(p=>p.status!=='removed').length,administrator:{username:'manager',role:'coordinator'}}});
  }
  const input=request.postDataJSON();
  if(request.method()==='POST'){
   creates++;if(participants.some(p=>p.username===input.username))return route.fulfill({status:409,json:{error:'Username is unavailable'}});
   participants.push({user_id:'synthetic-new',username:input.username,status:'active',created_at:'2026-11-03T12:00:00Z',created_by_label:'You'});activity.unshift({id:'audit-created',action:'participant_created',username:input.username,actor_label:'You',created_at:'2026-11-03T12:00:00Z'});
   return route.fulfill({status:201,json:{username:input.username,temporaryPassword:'FictionalOneTimeValue_123'}});
  }
  changes++;const account=participants.find(p=>p.user_id===input.user_id)!;
  if(input.action!=='reset')account.status=input.action==='restore'?'active':input.action==='remove'?'removed':'suspended';
  activity.unshift({id:'audit-'+changes,action:'participant_'+(input.action==='reset'?'password_reset':input.action),username:account.username,actor_label:'You',created_at:'2026-11-03T13:00:00Z'});
  return route.fulfill({json:input.action==='reset'?{temporaryPassword:'FictionalResetValue_456'}:{status:account.status}});
 });
 await page.goto('/map-test-internal?admin=test');await expect(page.getByRole('region',{name:'Selected court'})).toContainText('DayBridge STAR Court Test');
 return {participants,counts:()=>({creates,changes})};
}
async function accountAction(page:Page,name:string,username='participant001'){
 const menu=page.getByLabel('Actions for '+username,{exact:true});
 if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name,exact:true}).click();
}
test('dashboard renders backend counts and supports account creation, search, credential handoff and activity',async({page},testInfo)=>{
 if(testInfo.project.name==='desktop')await page.setViewportSize({width:1672,height:950});
 const state=await fixture(page);await expect(page.getByText('Assigned seats',{exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/daybridge-admin-'+testInfo.project.name+'.png',fullPage:true});
 await expect(page.getByRole('heading',{name:'Participants (3)'})).toBeVisible();
 await page.getByLabel('Participant username',{exact:false}).fill('participant004');
 await expect(page.getByLabel('Internal Auth alias (preview)')).toHaveValue('participant004@accounts.daybridge.example.com');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 const credentials=page.getByRole('status',{name:'Temporary credentials'});await expect(credentials).toContainText('Account created successfully');
 await credentials.getByRole('button',{name:'Show temporary password'}).click();await expect(credentials).toContainText('FictionalOneTimeValue_123');
 await expect(page.getByRole('heading',{name:'Participants (4)'})).toBeVisible();expect(state.counts().creates).toBe(1);
 await page.getByLabel('Search participants',{exact:true}).fill('participant004');await expect(page.locator('tbody tr')).toHaveCount(1);
 await credentials.getByRole('button',{name:'Dismiss credentials'}).click();await expect(credentials).toHaveCount(0);
 await page.getByRole('navigation',{name:'Admin portal'}).getByRole('button',{name:'Activity',exact:true}).click();
 await expect(page.getByText('Account created',{exact:false})).toBeVisible();await expect(page.getByText('participant004',{exact:false})).toBeVisible();
 await page.getByRole('navigation',{name:'Admin portal'}).getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Court & subscription'})).toBeVisible();await expect(page.getByRole('heading',{name:'Change password'})).toBeVisible();
});
test('participant actions require confirmation and update seats, status, credentials and audit',async({page})=>{
 const state=await fixture(page);
 await accountAction(page,'Suspend participant001');
 const confirm=page.getByRole('dialog');await expect(confirm).toContainText('keeps the assigned seat');await confirm.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.counts().changes).toBe(0);
 await accountAction(page,'Suspend participant001');await confirm.getByRole('button',{name:'Confirm suspend account',exact:true}).click();if(await page.getByRole('table').count())await expect(page.getByRole('row').filter({hasText:'participant001'})).toContainText('Suspended');else await expect(page.getByRole('article',{name:'Participant participant001',exact:true})).toContainText('Suspended');
 await accountAction(page,'Restore participant001');await confirm.getByRole('button',{name:'Confirm restore account',exact:true}).click();
 await accountAction(page,'Reset password for participant001');await confirm.getByRole('button',{name:'Confirm reset password',exact:true}).click();
 const credential=page.getByRole('status',{name:'Temporary credentials'});await expect(credential).toContainText('Temporary password issued');await credential.getByRole('button',{name:'Show temporary password'}).click();await expect(credential).toContainText('FictionalResetValue_456');
 await page.getByRole('navigation',{name:'Admin portal'}).getByRole('button',{name:'Participants',exact:true}).click();await expect(credential).toHaveCount(0);
 await accountAction(page,'Remove participant001');await expect(confirm).toContainText('Supabase account and personal records remain');await confirm.getByRole('button',{name:'Confirm remove from court',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Participants (2)'})).toBeVisible();await expect(page.locator('tbody')).not.toContainText('participant001');expect(state.participants).toHaveLength(3);expect(state.counts().changes).toBe(4);
});
test('an expired session clears credentials and ignores a delayed privileged response',async({page})=>{
 await fixture(page);await page.getByLabel('Participant username',{exact:false}).fill('participant004');
 let release:()=>void=()=>{};let received:()=>void=()=>{};const wait=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{received=resolve;});
 await page.route('**/api/admin/participants',async route=>{received();await wait;await route.fulfill({status:201,json:{username:'participant004',temporaryPassword:'FictionalDelayedValue'}});});
 await page.getByRole('button',{name:'Create account',exact:true}).click();await started;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('synthetic-admin-auth',{detail:null})));release();
 await expect(page.getByRole('heading',{name:'Court staff sign in'})).toBeVisible();await expect(page.getByRole('status',{name:'Temporary credentials'})).toHaveCount(0);await expect(page.getByText('FictionalDelayedValue')).toHaveCount(0);await expect(page.locator('tbody')).toHaveCount(0);
});
test('switching to an unauthorized court clears the previous court and shows denial',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Change court',exact:true}).click();await page.getByRole('combobox',{name:'Court',exact:true}).selectOption(second);await expect(page.getByRole('alert').filter({hasText:'You are not assigned'})).toContainText('You are not assigned to this court');await expect(page.locator('tbody')).toHaveCount(0);await expect(page.getByLabel('Participant username',{exact:false})).toHaveCount(0);
});

test('duplicate usernames show a real error without success credentials and secrets clear on session end',async({page})=>{
 const state=await fixture(page);await page.getByLabel('Participant username',{exact:false}).fill('participant001');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByText('Username is unavailable',{exact:true})).toBeVisible();await expect(page.getByRole('status',{name:'Temporary credentials'})).toHaveCount(0);expect(state.participants).toHaveLength(3);
 await page.getByLabel('Participant username',{exact:false}).fill('participant004');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('status',{name:'Temporary credentials'})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('synthetic-admin-auth',{detail:null})));await expect(page.getByRole('heading',{name:'Court staff sign in'})).toBeVisible();await expect(page.getByRole('status',{name:'Temporary credentials'})).toHaveCount(0);
});

test('narrow participant cards expose keyboard-accessible actions, clear filters and fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);
 const cards=page.getByLabel('Participant cards',{exact:true});await expect(cards).toBeVisible();await expect(cards.getByRole('article')).toHaveCount(3);
 await expect(page.getByRole('table')).toHaveCount(0);
 const menu=page.getByLabel('Actions for participant001',{exact:true}),actions=page.getByRole('group',{name:'Account actions for participant001',exact:true});
 await menu.focus();await menu.press('Enter');await expect(actions).toBeVisible();await page.keyboard.press('Escape');await expect(actions).toBeHidden();await expect(menu).toBeFocused();
 await menu.click();await page.getByRole('heading',{name:'Participants (3)',exact:true}).click();await expect(actions).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByLabel('Search participants',{exact:true}).fill('no-match');await expect(page.getByText('No matching participants',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(cards.getByRole('article')).toHaveCount(3);
 await accountAction(page,'Remove participant001');await expect(page.getByRole('dialog')).toContainText('participant001');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(menu).toBeFocused();
});


test('temporary staff credentials cannot open participant administration before password setup',async({page})=>{
 await page.route('**/api/admin/courts',r=>r.fulfill({json:{courts:directory}}));
 await page.route('**/api/admin/participants**',r=>r.fulfill({status:403,json:{error:'Change your staff password',password_change_required:true}}));
 let attempts=0;
 await page.route('**/api/admin/staff-password',r=>{attempts++;return r.fulfill(attempts===1?{status:400,json:{error:'Temporary password was not accepted'}}:{json:{ok:true}});});
 await page.goto('/map-test-internal?admin=test');
 await expect(page.getByRole('heading',{name:'Set your private staff password'})).toBeVisible();await expect(page.getByLabel('Participant username',{exact:false})).toHaveCount(0);
 const fill=async()=>{await page.getByLabel('Current temporary password',{exact:true}).fill('FictionalTemporary');await page.getByLabel('New staff password',{exact:true}).fill('FictionalPrivate_456');await page.getByLabel('Confirm new staff password',{exact:true}).fill('FictionalPrivate_456');};
 await fill();await page.getByRole('button',{name:'Save staff password',exact:true}).click();await expect(page.getByRole('region',{name:'Staff password setup'}).getByRole('alert')).toContainText('Temporary password was not accepted');await expect(page.getByLabel('Current temporary password',{exact:true})).toHaveValue('');
 await fill();await page.getByRole('button',{name:'Save staff password',exact:true}).click();await expect(page.getByRole('heading',{name:'Court staff sign in'})).toBeVisible();await expect(page.getByText('Staff password saved. Sign in with your new password.',{exact:true})).toBeVisible();
});

test('refresh initializes selectors when the first published court arrives and preserves valid selections',async({page})=>{
 let courts:typeof directory=[];
 await page.route('**/api/admin/courts',r=>r.fulfill({json:{courts}}));
 await page.goto('/map-test-internal?admin=test&court_id='+court);
 await expect(page.getByRole('alert').filter({hasText:'No courts have been published'})).toBeVisible();
 courts=directory;
 await page.getByRole('button',{name:'Refresh court directory',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'State',exact:true})).toHaveValue('GA');
 await expect(page.getByRole('combobox',{name:'Judicial circuit',exact:true})).toHaveValue('synthetic-enotah');
 await expect(page.getByRole('combobox',{name:'Court',exact:true})).toHaveValue(court);
 await page.getByRole('combobox',{name:'Court',exact:true}).selectOption(second);
 await page.getByRole('button',{name:'Refresh court directory',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Court',exact:true})).toHaveValue(second);
 courts=[directory[0]];
 await page.getByRole('button',{name:'Refresh court directory',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Court',exact:true})).toHaveValue(court);
});
