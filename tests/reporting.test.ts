import test from 'node:test';
import assert from 'node:assert/strict';
import type {CalendarEvent,TaskItem} from '../lib/types.ts';
import {eligibleReportingItems} from '../lib/reporting/eligibility.ts';
import {progressLabel,type ProgressEvent} from '../lib/reporting/types.ts';
import {participantReportingInput,progressQuery} from '../lib/reporting/input.ts';
test('reporting eligibility never promotes health, unrelated events or general tasks',()=>{
 const events=['court','case_management','class','self_help','therapy','drug_testing','work','personal','other','custom_test'].map((category,i)=>({id:String(i),category,title:'Private '+i})) as CalendarEvent[];
 const tasks=[{id:'linked',linkedEventId:'0'},{id:'unrelated'},{id:'health',linkedEventId:'4'}] as TaskItem[];
 const eligible=eligibleReportingItems(events,tasks);
 assert.deepEqual(eligible.map(i=>i.id),['0','1','2','linked']);
 assert.deepEqual(eligible[2].categories,['class']);assert.deepEqual(eligible[3].categories,['obligation']);
});
test('missing reports, upcoming items, corrections and unknowns use noncompliance-neutral labels',()=>{
 const e={status:'not_reported',scheduled_at:'2026-11-07T12:00:00Z'} as ProgressEvent;
 assert.equal(progressLabel(e,Date.parse('2026-11-06')),'Upcoming');assert.equal(progressLabel(e,Date.parse('2026-11-08')),'Not self-reported');
 assert.equal(progressLabel({...e,status:'incomplete'}),'Self-reported incomplete');assert.equal(progressLabel({...e,status:'unknown'}),'Not enough information');
 assert.equal(progressLabel({...e,status:'withdrawn'}),'Sharing withdrawn');
});
test('HTTP payload allowlists reject privacy-sensitive fields, actor spoofing and invalid periods',()=>{
 assert.equal(participantReportingInput.safeParse({action:'share',source_kind:'event',source_id:'one',category:'meeting',include_history:false}).success,true);
 for(const injected of [{description:'secret'},{user_id:'other'},{court_id:'other'},{medication:'secret'},{lat:30}])assert.equal(participantReportingInput.safeParse({action:'consent',category:'meeting',enabled:true,...injected}).success,false);
 assert.equal(participantReportingInput.safeParse({action:'consent',category:'medication',enabled:true}).success,false);
 assert.equal(participantReportingInput.safeParse({action:'share',source_kind:'event',source_id:'one',category:'meeting',include_history:true}).success,false);
 const q={court_id:'d6000000-0000-4000-8000-000000000001',start:'2026-11-01T00:00:00Z',end:'2026-12-01T00:00:00Z'};
 assert.equal(progressQuery.safeParse(q).success,true);assert.equal(progressQuery.safeParse({...q,end:'2027-12-01T00:00:00Z'}).success,false);
});
