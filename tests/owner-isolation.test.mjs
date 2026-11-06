import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
const owner='a1000000-0000-4000-8000-000000000001',staff='a1000000-0000-4000-8000-000000000002',other='a1000000-0000-4000-8000-000000000003';
const input={action:'create',state_code:'GA',state_name:'Georgia',circuit_name:'Beta Circuit',circuit_slug:'beta',court_name:'Beta Court',court_slug:'beta-court',seat_limit:25,is_demo:true,listed:false};
test('owner setup denies self-promotion, preserves tenancy, and safely creates/reuses court hierarchy',async()=>{
 const {db}=await isolatedDatabase();
 try{
  await db.query("insert into auth.users(id,raw_app_meta_data,email,email_confirmed_at) values($1,'{\"daybridge_platform_owner\":true}','owner@example.invalid',now()),($2,'{}','manager@ga.beta.beta-court',now()),($3,'{\"daybridge_platform_owner\":\"true\"}','other@example.invalid',now())",[owner,staff,other]);
  const setup=(actor,value)=>asRole(db,'service_role','',async()=> (await db.query('select public.daybridge_owner_setup($1,$2) as id',[actor,JSON.stringify(value)])).rows[0].id);
  for(const role of ['anon','authenticated'])await asRole(db,role,owner,async()=>{
   await assert.rejects(db.query('select public.daybridge_owner_setup($1,$2)',[owner,JSON.stringify(input)]),/permission denied/i);
   await assert.rejects(db.query('select public.daybridge_owner_directory($1)',[owner]),/permission denied/i);
   await assert.rejects(db.query('select daybridge_private.platform_owner($1)',[owner]),/permission denied/i);
  });
  for(const actor of [staff,other])await assert.rejects(setup(actor,input),/Owner access required/);
  const court=await setup(owner,input);
  assert.equal((await db.query('select listed from public.daybridge_courts where id=$1',[court])).rows[0].listed,false);
  await assert.rejects(setup(owner,input),/duplicate/i);
  const second=await setup(owner,{...input,court_name:'Second Beta Court',court_slug:'second'});
  assert.equal((await db.query("select count(*)::int as n from public.daybridge_judicial_circuits where state_code='GA'")).rows[0].n,1);
  await assert.rejects(setup(owner,{...input,state_code:'XX',state_name:'Rollback State',court_name:'x',circuit_name:'Rollback Circuit'}));
  assert.equal((await db.query("select * from public.daybridge_states where code='XX'")).rows.length,0);
  await setup(owner,{action:'assign_staff',court_id:court,username:'manager',role:'case_manager'});
  await assert.rejects(setup(owner,{action:'assign_staff',court_id:second,username:'manager',role:'coordinator'}),/exact staff sign-in/i);
  await asRole(db,'service_role','',async()=>{
   const dir=(await db.query('select public.daybridge_owner_directory($1) as data',[owner])).rows[0].data;
   assert.equal(dir.staff[0].username,'manager');assert.equal(JSON.stringify(dir).includes('owner@example.invalid'),false);
  });
  await db.query("update auth.users set raw_app_meta_data='{\"daybridge_managed\":true}' where id=$1",[staff]);
  await assert.rejects(setup(owner,{action:'assign_staff',court_id:court,username:'manager',role:'coordinator'}),/exact staff sign-in/i);
  await db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[staff]);
  await db.query("insert into public.daybridge_court_participants(user_id,court_id,username,created_by) values($1,$3,'beta-one',$2),($2,$3,'beta-two',$2)",[other,staff,court]);
  const update={action:'update',court_id:court,court_name:'Renamed Beta Court',seat_limit:1,subscription_status:'pilot',listed:true,enabled:true};
  await assert.rejects(setup(owner,update),/below assigned seats/i);
  await setup(owner,{...update,seat_limit:25});
  assert.equal((await db.query('select login_slug from public.daybridge_courts where id=$1',[court])).rows[0].login_slug,'beta-court');
  await setup(owner,{action:'revoke_staff',court_id:court,user_id:staff});
  assert.equal((await db.query('select active from public.daybridge_court_staff where court_id=$1',[court])).rows[0].active,false);
  assert.equal((await db.query('select count(*)::int as n from public.daybridge_court_participants')).rows[0].n,2);
  await db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[owner]);
  await assert.rejects(setup(owner,{...update,seat_limit:25}),/Owner access required/);
 }finally{await db.close();}
});
