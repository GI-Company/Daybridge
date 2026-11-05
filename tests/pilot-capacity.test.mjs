import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
const id=n=>'f2500000-0000-4000-8000-'+String(n).padStart(12,'0');
test('25-account beta: capacity boundaries, onboarding, revocation, and worker isolation',async t=>{
 const {db}=await isolatedDatabase();
 try{
  const court=(await db.query("select id from public.daybridge_courts where is_demo limit 1")).rows[0].id;
  const staff=id(100),accounts=Array.from({length:26},(_,n)=>id(n+1));
  for(const user of [staff,...accounts])await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query("insert into public.daybridge_court_staff(court_id,user_id,role) values($1,$2,'coordinator')",[court,staff]);
  for(let i=0;i<25;i++)await asRole(db,'service_role','',()=>db.query('select public.daybridge_assign_participant($1,$2,$3,$4)',[court,accounts[i],'beta_'+i,staff]));
  const assign=()=>asRole(db,'service_role','',()=>db.query('select public.daybridge_assign_participant($1,$2,$3,$4)',[court,accounts[25],'beta_25',staff]));
  await assert.rejects(assign(),/seat limit/i);
  const transition=(user,action)=>asRole(db,'service_role','',()=>db.query('select public.daybridge_transition_participant($1,$2,$3,$4)',[court,user,staff,action]));
  await transition(accounts[0],'suspend');await assert.rejects(assign(),/seat limit/i);
  await transition(accounts[0],'remove');await assign();
  await assert.rejects(transition(accounts[0],'suspend'),/seat limit/i);
  await assert.rejects(transition(accounts[0],'restore'),/seat limit/i);
  await transition(accounts[25],'remove');await transition(accounts[0],'restore');
  await db.query("update public.daybridge_courts set subscription_status='paused' where id=$1",[court]);
  await assert.rejects(assign(),/subscription/i);await transition(accounts[0],'suspend');await assert.rejects(transition(accounts[0],'restore'),/subscription/i);
  await db.query("update public.daybridge_courts set subscription_status='pilot' where id=$1",[court]);await transition(accounts[0],'restore');
  const start=performance.now();
  for(let i=0;i<25;i++)await asRole(db,'authenticated',accounts[i],async()=>{
   assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,true);
   await db.query('select public.save_private_snapshot_for_user($1,$2,0)',[accounts[i],JSON.stringify({tasks:[{id:'task-'+i,title:'Private task'}],notes:[{id:'note-'+i,text:'Private note'}],profile:{timezone:'America/New_York'}})]);
   const rows=(await db.query('select user_id from public.private_snapshots')).rows;assert.deepEqual(rows,[{user_id:accounts[i]}]);
   await assert.rejects(db.query('select * from public.daybridge_reminder_snapshot($1)',[accounts[(i+1)%25]]),/permission denied/i);
   await assert.rejects(db.query('select daybridge_private.workspace_access_for_user($1)',[accounts[(i+1)%25]]),/permission denied/i);
  });
  t.diagnostic(`25 isolated account saves/reads completed in ${Math.round(performance.now()-start)} ms on disposable PostgreSQL; this is not hosted load evidence.`);
  await db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[accounts[0],JSON.stringify({daybridge_managed:true,daybridge_must_change_password:true})]);
  await asRole(db,'authenticated',accounts[0],async()=>{
   assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,false);
   assert.equal((await db.query('select * from public.private_snapshots')).rows.length,0);
   await assert.rejects(db.query("select public.save_private_snapshot_for_user($1,'{}',1)",[accounts[0]]));
   await assert.rejects(db.query('insert into public.travel_preferences(user_id) values($1)',[accounts[0]]),/row-level security/i);
  });
  await asRole(db,'service_role','',async()=>{
   assert.equal((await db.query('select * from public.daybridge_reminder_snapshot($1)',[accounts[0]])).rows.length,0);
   const payload=(await db.query('select * from public.daybridge_reminder_snapshot($1)',[accounts[1]])).rows[0].payload;
   assert.equal(payload.tasks[0].id,'task-1');assert.equal(payload.notes,undefined);
  });
  await db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[accounts[0],JSON.stringify({daybridge_managed:true,daybridge_must_change_password:false})]);
  await transition(accounts[0],'suspend');
  await asRole(db,'authenticated',accounts[0],async()=>assert.equal((await db.query('select * from public.travel_preferences')).rows.length,0));
  await asRole(db,'service_role','',async()=>assert.equal((await db.query('select * from public.daybridge_reminder_snapshot($1)',[accounts[0]])).rows.length,0));
  assert.equal((await db.query('select count(*)::int as n from public.private_snapshots')).rows[0].n,25);
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,27);
 }finally{await db.close();}
});

test('beta migration rollback and reapplication preserve pre-existing private records',async()=>{
 const {db}=await isolatedDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[id(999)]);
  await db.query('insert into public.private_snapshots(user_id,payload,revision) values($1,$2,1)',[id(999),JSON.stringify({tasks:[{id:'preserved',title:'Existing private record'}]})]);
  const before=(await db.query('select * from public.private_snapshots')).rows;
  await db.exec(await readFile(new URL('../docs/pilot/ROLLBACK_BETA_ACCESS.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select * from public.private_snapshots')).rows,before);
  assert.equal((await db.query("select to_regprocedure('public.daybridge_reminder_snapshot(uuid)') as fn")).rows[0].fn,null);
  await db.exec(await readFile(new URL('../supabase/migrations/20261105022302_beta_access_and_seat_safety.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select * from public.private_snapshots')).rows,before);
  await asRole(db,'authenticated',id(999),async()=>assert.equal((await db.query('select public.daybridge_workspace_access() as allowed')).rows[0].allowed,true));
 }finally{await db.close();}
});
