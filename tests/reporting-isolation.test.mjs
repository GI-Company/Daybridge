import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
const id=n=>'d6000000-0000-4000-8000-'+String(n).padStart(12,'0');
const [staff,otherStaff,participant,otherParticipant,owner]=[1,2,3,4,5].map(id);
const now=Date.now(),date=days=>new Date(now+days*86400000).toISOString();
async function fixture(){
 const {db}=await isolatedDatabase();
 const court=(await db.query("select id from public.daybridge_courts where is_demo limit 1")).rows[0].id;
 const circuit=(await db.query('select circuit_id from public.daybridge_courts where id=$1',[court])).rows[0].circuit_id;
 const second=(await db.query("insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit) values($1,'Reporting other court','other-report',25) returning id",[circuit])).rows[0].id;
 for(const [user,email,meta] of [[staff,'manager@zz.samplecircuit.samplecourt',{}],[otherStaff,'manager@zz.samplecircuit.other-report',{}],[participant,'reporting_p1@accounts.daybridge.example.com',{}],[otherParticipant,'reporting_p2@accounts.daybridge.example.com',{}],[owner,'owner@accounts.daybridge.example.com',{daybridge_platform_owner:true}]])
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[user,email,JSON.stringify(meta)]);
 await db.query("insert into public.daybridge_court_staff(court_id,user_id,role) values($1,$2,'case_manager'),($3,$4,'case_manager')",[court,staff,second,otherStaff]);
 for(const [c,u,s,n] of [[court,participant,staff,'reporting_p1'],[second,otherParticipant,otherStaff,'reporting_p2']])
  await asRole(db,'service_role','',()=>db.query('select public.daybridge_assign_participant($1,$2,$3,$4)',[c,u,n,s]));
 const call=(name,args)=>asRole(db,'service_role','',async()=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result);
 const participantRPC=(input,u=participant)=>call('daybridge_participant_reporting',[u,JSON.stringify(input)]);
 const flag=(enabled,c=court,actor=owner)=>call('daybridge_owner_reporting',[actor,c,enabled]);
 const report=(actor=staff,c=court,user=null,category=null)=>call('daybridge_staff_progress',[actor,c,date(-20),date(20),user,category]);
 const payload={events:[{id:'court-future',category:'court',title:'PRIVATE TITLE',description:'PRIVATE DESCRIPTION',startTime:date(2),endTime:date(2.05),location:'PRIVATE ADDRESS',destinationLat:34.1234,destinationLon:-83.1234},
  {id:'class-past',category:'class',title:'PRIVATE CLASS',startTime:date(-2),endTime:date(-1.95)},
  {id:'therapy',category:'therapy',startTime:date(2),endTime:date(2.05)},
  {id:'drug-checkin',category:'drug_testing',checkInReminderMinutes:15,startTime:date(2),endTime:date(2.05)},
  {id:'personal',category:'personal',startTime:date(2),endTime:date(2.05)}],
 eventOccurrences:[],tasks:[{id:'court-task',title:'PRIVATE TASK',linkedEventId:'court-future',dueDate:date(2),completed:false},{id:'private-task',title:'SECRET GENERAL TASK',dueDate:date(2),completed:true}],
 medications:[{name:'PRIVATE MEDICATION',strengthText:'PRIVATE DOSE'}],medicationLogs:[{action:'taken'}],accounts:[{name:'PRIVATE BANK',balanceCents:99999}],transactions:[{notes:'PRIVATE MONEY'}],noteBooklets:[{pages:[{content:'PRIVATE NOTE'}]}],contacts:[{name:'PRIVATE CONTACT'}],savedPlaces:[{lat:34.1234,lon:-83.1234}]};
 let revision=0;
 const save=async()=>{revision=await asRole(db,'authenticated',participant,async()=> (await db.query('select public.save_private_snapshot_for_user($1,$2,$3) as rev',[participant,JSON.stringify(payload),revision])).rows[0].rev);};
 const consent=category=>participantRPC({action:'consent',category,enabled:true});
 const share=(source_id,category='meeting',extra={})=>participantRPC({action:'share',source_id,source_kind:'event',category,include_history:false,...extra});
 return {db,court,second,call,participantRPC,flag,report,payload,save,consent,share};
}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501'||/permission denied|access.*required|denied|disabled/i.test(e.message));

test('reporting is default-off; DB denies browser roles and cross-court/owner access',async()=>{
 const f=await fixture();try{
  const secured=(await f.db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and (relname like 'daybridge_reporting_%' or relname in ('daybridge_progress_events','daybridge_report_access_audit')) and relkind='r'")).rows;
  assert.equal(secured.length,6);assert.ok(secured.every(r=>r.relrowsecurity),'every reporting table must enable RLS');
  await f.save();assert.equal((await f.participantRPC({action:'read'})).enabled,false);
  assert.deepEqual((await f.participantRPC({action:'read'})).events,[]);
  assert.deepEqual(await f.report(),{enabled:false});
  await denied(()=>f.consent('meeting'));await denied(()=>f.flag(true,f.court,staff));
  for(const [role,u] of [['anon',''],['authenticated',participant],['authenticated',staff],['authenticated',owner]])await asRole(f.db,role,u,async()=>{
   for(const table of ['daybridge_reporting_consent','daybridge_reporting_items','daybridge_progress_events','daybridge_report_access_audit','daybridge_reporting_consent_history','daybridge_reporting_courts'])await denied(()=>f.db.query('select * from public.'+table));
   await denied(()=>f.db.query("select public.daybridge_participant_reporting($1,'{}')",[participant]));
   await denied(()=>f.db.query('select public.daybridge_owner_reporting($1,$2,true)',[owner,f.court]));
   await denied(()=>f.db.query('select public.daybridge_staff_progress($1,$2,$3,$4,null,null)',[staff,f.court,date(-20),date(20)]));
  });
  await f.flag(true);await denied(()=>f.report(otherStaff));await denied(()=>f.report(staff,f.second));await denied(()=>f.report(owner));await denied(()=>f.report(staff,f.court,otherParticipant));
  await denied(()=>f.participantRPC({action:'read'},staff));await denied(()=>f.participantRPC({action:'read'},owner));
  // A platform owner with an accidental staff assignment is still denied progress.
  await f.db.query("update auth.users set raw_app_meta_data='{"+'"daybridge_platform_owner":true'+"}' where id=$1",[staff]);await denied(()=>f.report());
 }finally{await f.db.close();}
});

test('consent plus item choice, historical boundaries, and strict source allowlist',async()=>{
 const f=await fixture();try{
  await f.save();await f.flag(true);await f.consent('meeting');
  assert.equal((await f.report()).events.length,0);await f.share('court-future');
  assert.equal((await f.report()).events.length,1);assert.equal((await f.report()).events[0].status,'not_reported');
  for(const source of ['therapy','drug-checkin','personal','missing'])await assert.rejects(()=>f.share(source),/not eligible/);
  await assert.rejects(()=>f.share('private-task','obligation',{source_kind:'task'}),/Enable this category/);
  await f.consent('class');await f.share('class-past','class');assert.equal((await f.report()).events.length,1);
  await f.share('class-past','class',{include_history:true,history_from:date(-3)});assert.equal((await f.report()).events.length,2);
  await assert.rejects(()=>f.share('class-past','class',{include_history:true}),/History start/);
  const persisted=(await f.participantRPC({action:'read'}));assert.equal(persisted.items.find(i=>i.source_id==='class-past').include_history,true);
  await f.consent('obligation');await assert.rejects(()=>f.share('private-task','obligation',{source_kind:'task'}),/not eligible/);
  await f.share('court-task','obligation',{source_kind:'task'});assert.equal((await f.report()).summary.shared,3);
  const serialized=JSON.stringify(await f.report());for(const secret of ['PRIVATE','SECRET','34.1234','-83.1234','medication','account','description','source_id','source_key'])assert.equal(serialized.includes(secret),false,secret+' must never leave organizer');
  await f.participantRPC({action:'consent',category:'meeting',enabled:false});assert.equal((await f.report()).events.some(e=>e.category==='meeting'),false);
  assert.equal((await f.participantRPC({action:'read'})).events.find(e=>e.category==='meeting').status,'withdrawn');
  await f.consent('meeting');assert.equal((await f.report()).events.some(e=>e.category==='meeting'),false,'re-enable must not automatically resume items');
 }finally{await f.db.close();}
});

test('atomic private save corrects, undoes and deletes reports without stale completion',async()=>{
 const f=await fixture();try{
  await f.save();await f.flag(true);await f.consent('meeting');await f.share('court-future');
  const occ={id:'saved-occurrence',eventId:'court-future',startTimeUtc:date(2),endTimeUtc:date(2.05),attendanceStatus:'attended_self_reported',attendanceRecordedAt:new Date(Date.now()+1000).toISOString()};
  f.payload.eventOccurrences.push(occ);await f.save();assert.equal((await f.report()).events[0].status,'complete');
  const auditCount=(await f.db.query('select count(*)::int as n from public.daybridge_report_access_audit')).rows[0].n;
  assert.ok(auditCount>0);
  occ.attendanceStatus='not_attended_self_reported';await f.save();assert.equal((await f.report()).events[0].status,'incomplete');
  occ.attendanceStatus='unconfirmed';delete occ.attendanceRecordedAt;await f.save();assert.equal((await f.report()).events[0].status,'not_reported');
  f.payload.eventOccurrences=[];await f.save();assert.equal((await f.report()).events[0].status,'not_reported');
  f.payload.events=f.payload.events.filter(e=>e.id!=='court-future');await f.save();assert.equal((await f.report()).events.length,0);
  assert.equal((await f.participantRPC({action:'read'})).events[0].status,'withdrawn');
  const before=(await f.db.query('select count(*)::int as n from public.daybridge_report_access_audit')).rows[0].n;
  await denied(()=>f.report(otherStaff));assert.equal((await f.db.query('select count(*)::int as n from public.daybridge_report_access_audit')).rows[0].n,before);
 }finally{await f.db.close();}
});

test('revocation, suspension/removal, court disable and feature disable fail closed without changing seats',async()=>{
 const f=await fixture();try{
  await f.save();await f.flag(true);await f.consent('meeting');await f.share('court-future');
  await f.db.query('update public.daybridge_court_staff set active=false where user_id=$1',[staff]);await denied(()=>f.report());
  await f.db.query('update public.daybridge_court_staff set active=true,password_change_required=true where user_id=$1',[staff]);await denied(()=>f.report());
  await f.db.query('update public.daybridge_court_staff set password_change_required=false where user_id=$1',[staff]);
  await f.call('daybridge_transition_participant',[f.court,participant,staff,'suspend']);assert.equal((await f.report()).events.length,0);
  assert.equal((await f.report()).participants[0].status,'suspended');await denied(()=>f.participantRPC({action:'read'}));
  await f.call('daybridge_transition_participant',[f.court,participant,staff,'restore']);assert.equal((await f.report()).events.length,0);
  assert.equal((await f.participantRPC({action:'read'})).consents[0].enabled,false);
  await f.consent('meeting');await f.share('court-future');await f.flag(false);assert.deepEqual(await f.report(),{enabled:false});
  await f.flag(true);assert.equal((await f.report()).events.length,0);
  await f.consent('meeting');await f.share('court-future');await f.db.query('update public.daybridge_courts set enabled=false where id=$1',[f.court]);await denied(()=>f.report());
  await f.db.query('update public.daybridge_courts set enabled=true where id=$1',[f.court]);assert.equal((await f.report()).events.length,0);
  await f.consent('meeting');await f.share('court-future');await f.call('daybridge_transition_participant',[f.court,participant,staff,'remove']);assert.equal((await f.report()).participants.length,0);
  assert.equal((await f.db.query('select seat_limit from public.daybridge_courts where id=$1',[f.court])).rows[0].seat_limit,25);
  assert.equal((await f.db.query('select count(*)::int as n from public.private_snapshots where user_id=$1',[participant])).rows[0].n,1);
 }finally{await f.db.close();}
});

test('report dates honor appointment/profile timezones and linked task corrections remain private',async()=>{
 const f=await fixture();try{
  const future=date(2).slice(0,10);
  f.payload.profile={timezone:'America/New_York'};
  f.payload.events[0].startTime=future+'T10:00:00';f.payload.events[0].endTime=future+'T11:00:00';f.payload.events[0].timezone='America/New_York';
  f.payload.tasks[0].dueDate=future+'T10:00:00';
  await f.save();await f.flag(true);await f.consent('meeting');await f.share('court-future');await f.consent('obligation');await f.share('court-task','obligation',{source_kind:'task'});
  let result=await f.report();for(const e of result.events)assert.equal(Date.parse(e.scheduled_at),Date.parse(future+'T15:00:00Z'),e.category+': '+e.scheduled_at);
  f.payload.tasks[0].completed=true;f.payload.tasks[0].completedAt=new Date(Date.now()+1000).toISOString();await f.save();result=await f.report();assert.equal(result.events.find(e=>e.category==='obligation').status,'complete');
  f.payload.tasks[0].completed=false;delete f.payload.tasks[0].completedAt;await f.save();assert.equal((await f.report()).events.find(e=>e.category==='obligation').status,'not_reported');
  delete f.payload.tasks[0].linkedEventId;await f.save();assert.equal((await f.report()).events.some(e=>e.category==='obligation'),false);
  // Current metadata and current staff session are independently enforced in SQL.
  await f.db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[participant,JSON.stringify({daybridge_managed:true,daybridge_must_change_password:true})]);
  await denied(()=>f.participantRPC({action:'read'}));
  await f.db.query('update public.daybridge_court_staff set credential_valid_after=now() where user_id=$1',[staff]);await denied(()=>f.report());
  const session=id(77);await f.db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,now()+interval \'1 second\')',[session,staff]);
  const signed=await f.call('daybridge_staff_progress',[staff,f.court,date(-20),date(20),null,null,session]);assert.equal(signed.enabled,true);
 }finally{await f.db.close();}
});

test('schedule/recurrence edits require review rather than preserving stale attendance',async()=>{
 const f=await fixture();try{
  await f.save();await f.flag(true);await f.consent('meeting');await f.share('court-future');
  f.payload.eventOccurrences=[{id:'occ',eventId:'court-future',startTimeUtc:date(2),endTimeUtc:date(2.05),attendanceStatus:'attended_self_reported',attendanceRecordedAt:new Date(Date.now()+1000).toISOString()}];
  await f.save();assert.equal((await f.report()).events[0].status,'complete');
  f.payload.events[0].title='DIFFERENT PRIVATE TITLE';await f.save();assert.equal((await f.report()).events[0].status,'complete','private text does not revoke an approved schedule');
  f.payload.events[0].startTime=date(3);f.payload.events[0].endTime=date(3.05);await f.save();assert.equal((await f.report()).events.length,0);
  assert.equal((await f.participantRPC({action:'read'})).items[0].needs_review,true);
  await f.share('court-future');
  assert.equal((await f.participantRPC({action:'read'})).items[0].needs_review,false);
  assert.equal((await f.report()).events[0].status,'not_reported','rescheduled appointment cannot reuse an old occurrence');
  assert.equal(Date.parse((await f.report()).events[0].scheduled_at),Date.parse(date(3)));
  // Recurrence changes withdraw too; old saved attendance is not silently reused.
  f.payload.events[0].rrule='FREQ=WEEKLY';await f.save();assert.equal((await f.report()).events.length,0);
 }finally{await f.db.close();}
});

test('report reads fail closed when an access audit cannot be written',async()=>{
 const f=await fixture();try{
  await f.save();await f.flag(true);await f.consent('meeting');await f.share('court-future');
  const before=(await f.db.query('select count(*)::int as n from public.daybridge_report_access_audit')).rows[0].n;
  await f.db.exec('alter table public.daybridge_report_access_audit add constraint synthetic_audit_failure check(false) not valid');
  await assert.rejects(()=>f.report(),/synthetic_audit_failure/);
  assert.equal((await f.db.query('select count(*)::int as n from public.daybridge_report_access_audit')).rows[0].n,before);
  await f.db.exec('alter table public.daybridge_report_access_audit drop constraint synthetic_audit_failure');
  assert.equal((await f.report()).events.length,1);
 }finally{await f.db.close();}
});
