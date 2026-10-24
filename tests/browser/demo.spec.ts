import {test,expect,type Locator,type Page} from '@playwright/test';
test.skip(process.env.DAYBRIDGE_RECORD_DEMO!=='true','Opt-in local demonstration; never a production service acceptance test.');
test.skip(({isMobile})=>!isMobile,'Record one mobile take only.');
test.use({viewport:{width:432,height:936},video:{mode:'on',size:{width:432,height:936}}});
async function caption(page:Page,message:string,target?:Locator){
 if(target)await target.scrollIntoViewIfNeeded();
 const box=target?await target.boundingBox():null;
 await page.evaluate(({message,box})=>{
  let note=document.getElementById('demo-caption');if(!note){note=document.createElement('div');note.id='demo-caption';document.body.append(note);}
  note.textContent='DEMO · '+message;Object.assign(note.style,{position:'fixed',bottom:'82px',left:'16px',right:'16px',padding:'12px',borderRadius:'14px',background:'#0f3430',color:'white',font:'600 13px system-ui',textAlign:'center',zIndex:'200',pointerEvents:'none',boxShadow:'0 4px 20px #0003'});
  let ring=document.getElementById('demo-ring');if(!ring){ring=document.createElement('div');ring.id='demo-ring';document.body.append(ring);}
  Object.assign(ring.style,{display:box?'block':'none',position:'fixed',left:(box?.x||0)-4+'px',top:(box?.y||0)-4+'px',width:(box?.width||0)+8+'px',height:(box?.height||0)+8+'px',border:'3px solid #d97706',borderRadius:'14px',pointerEvents:'none',zIndex:'199'});
 },{message,box});
}
async function more(page:Page,label:string){await page.getByRole('button',{name:'More',exact:true}).last().click();await page.getByRole('button',{name:new RegExp(label)}).last().click();}
test('record a short tour of the updated screens using fictional local records',async({page},info)=>{
 test.setTimeout(90000);
 await page.clock.install({time:new Date('2026-10-24T14:00:00Z')});
 await page.goto('/map-test-internal?polish=test');await expect(page.getByTestId('polish-sync')).toHaveText('synced');
 await caption(page,'Today: see what needs your attention');await page.waitForTimeout(3500);
 const done=page.getByRole('button',{name:'Mark done',exact:true});
 await caption(page,'Finish today’s check-in in one tap',done);await page.waitForTimeout(2000);await done.click();
 await caption(page,'Tomorrow’s check-in starts fresh');await page.waitForTimeout(2500);
 await page.getByRole('button',{name:'Schedule',exact:true}).last().click();
 await caption(page,'Schedule: one calendar for your obligations');await page.waitForTimeout(4000);
 await more(page,'Medications');
 const taken=page.getByRole('button',{name:'Mark Taken',exact:true});
 await caption(page,'Medication logging stays at the top',taken);await page.waitForTimeout(2000);await taken.click();
 await caption(page,'One dose entry, with an Undo action');await page.waitForTimeout(2500);
 await page.getByRole('button',{name:'Budget',exact:true}).last().click();
 await caption(page,'Budget: a clear shortfall and accurate payday count',page.getByText('You need $39.83 more to cover planned obligations'));await page.waitForTimeout(4000);
 await more(page,'Weekly review');
 await caption(page,'Weekly review: only records from this week',page.getByRole('group',{name:'Past seven days summary'}).or(page.locator('[aria-label="Past seven days summary"]')));await page.waitForTimeout(3000);
 const summary=page.locator('summary').filter({hasText:'Recent & upcoming obligations'});await summary.click();
 await caption(page,'Expand details to see each occurrence’s status',summary);await page.waitForTimeout(4000);
 await summary.click();await page.evaluate(()=>window.scrollTo({top:0}));
 await caption(page,'DayBridge · daily obligations, reminders, and personal records');await page.waitForTimeout(3500);
 await page.screenshot({path:info.outputPath('demo-final.png')});
});
