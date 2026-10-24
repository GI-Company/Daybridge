import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
import {PGlite} from '@electric-sql/pglite';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
const payload=index=>({profile:{id:ids[index],fullName:'Synthetic participant '+index},events:[{id:'synthetic-event-'+index,title:'Synthetic appointment'}],medications:[{id:'synthetic-med-'+index,name:'Synthetic medication'}],medicationSchedules:[{id:'synthetic-schedule-'+index}],medicationLogs:[{id:'synthetic-log-'+index,action:'taken'}],accounts:[{id:'synthetic-budget-'+index,balanceCents:100}],bills:[{id:'synthetic-bill-'+index}],savedPlaces:[{id:'synthetic-place-'+index,lat:0,lon:0}]});
const checks=[];
async function check(name,work){await work();checks.push({name,status:'passed'});}
const denied=async promise=>assert.rejects(promise,error=>['42501','P0001','28000'].includes(error.code));
test('disposable PostgreSQL: three synthetic accounts, migration integrity, RLS, device ownership, CAS and recovery',async()=>{
 let beforeRows;
 const preserve=async db=>{const names=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;const result={};for(const {tablename} of names)result[tablename]=(await db.query('select to_jsonb(t) as row from public."'+tablename+'" t')).rows.map(x=>JSON.stringify(x.row)).sort();return result;};
 const {db,applied}=await isolatedDatabase({beforeSecurityMigration:async db=>{
  for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
  for(const [index,id] of ids.entries())await asRole(db,'authenticated',id,async()=>{
   const result=await db.query('select public.save_private_snapshot($1::jsonb,0) as revision',[JSON.stringify(payload(index))]);assert.equal(result.rows[0].revision,1);
   await db.query("insert into public.calendar_events(user_id,title,category,start_time,end_time) values($1,'Synthetic legacy event','personal',now(),now()+interval '1 hour')",[id]);
   await db.query("insert into public.medications(user_id,name) values($1,'Synthetic legacy medication')",[id]);
   await db.query("insert into public.budget_accounts(user_id,name,account_type,balance_cents) values($1,'Synthetic legacy budget','cash',1234)",[id]);
   await db.query('insert into public.travel_preferences(user_id) values($1)',[id]);
   await db.query("insert into public.travel_appointments(user_id,source_event_id,occurrence_start,destination_address,destination_lat,destination_lon,source_revision) values($1,$2,now()+interval '1 day','Synthetic location',0,0,'fixture')",[id,'synthetic-event-'+index]);
  });
  beforeRows=await preserve(db);
 }});
 try{
  await check('Security migration preserves every existing public-table row unchanged as normalized JSON',async()=>{const after=await preserve(db);for(const [name,rows] of Object.entries(beforeRows))assert.deepEqual(after[name],rows,name);});
  for(const [index,id] of ids.entries())await asRole(db,'authenticated',id,async()=>{
   await check('Account '+index+' sees only its own complete snapshot',async()=>{
    const result=await db.query('select user_id,payload from public.private_snapshots');assert.equal(result.rows.length,1);assert.equal(result.rows[0].user_id,id);assert.deepEqual(result.rows[0].payload,payload(index));
   });
   for(const other of ids.filter(value=>value!==id)){
    await check('Account '+index+' cannot read another account schedule/medications/doses/budget/location',async()=>{
     assert.equal((await db.query('select payload from public.private_snapshots where user_id=$1',[other])).rows.length,0);
     assert.equal((await db.query('select * from public.travel_appointments where user_id=$1',[other])).rows.length,0);
     assert.equal((await db.query('select * from public.travel_preferences where user_id=$1',[other])).rows.length,0);
     assert.equal((await db.query('select * from public.private_snapshot_history where user_id=$1',[other])).rows.length,0);
    });
    await check('Account '+index+' cannot modify/delete/reassign another account',async()=>{
     assert.equal((await db.query("update public.private_snapshots set payload='{}' where user_id=$1 returning user_id",[other])).rows.length,0);
     await denied(db.query('delete from public.private_snapshots where user_id=$1',[other]));
     await denied(db.query('update public.private_snapshots set user_id=$1 where user_id=$2',[other,id]));
     await denied(db.query("insert into public.private_snapshots(user_id,payload) values($1,'{}')",[other]));
    });
   }
   await check('Account '+index+' cannot access unused legacy tables or privileged RPCs',async()=>{
    for(const table of ['calendar_events','medications','medication_schedules','medication_logs','budget_accounts','money_transactions'])await denied(db.query('select * from public.'+table));
    await denied(db.query("select public.register_private_push_device($1,'https://fcm.googleapis.com/synthetic',repeat('B',87),repeat('a',22))",[id]));
    await denied(db.query("select public.daybridge_valid_cron_secret('synthetic')"));
    await denied(db.query("select public.take_scoped_travel_api_slot($1,now(),'device',12)",[id]));
    await denied(db.query("select setval('public.private_snapshot_history_id_seq',999999)"));
    await denied(db.query("select setval('public.private_security_audit_id_seq',999999)"));
    await denied(db.query('select keys_auth from public.push_subscriptions'));
    await denied(db.query("insert into public.private_security_audit(user_id,action) values($1,'device_registered')",[id]));
   });
  });
  await asRole(db,'anon',null,async()=>{
   await check('Anonymous identity cannot read/write snapshots, credentials, audit or privileged RPCs',async()=>{
    for(const table of ['private_snapshots','private_snapshot_history','push_subscriptions','private_security_audit','notification_device_receipts'])await denied(db.query('select * from public.'+table));
    await denied(db.query("select public.save_private_snapshot('{}',0)"));
    await denied(db.query("select public.disable_private_push_device($1,'https://fcm.googleapis.com/synthetic')",[ids[0]]));
   });
  });
  await asRole(db,'authenticated',null,async()=>{
   await check('Missing authoritative identity cannot read or save records',async()=>{
    assert.equal((await db.query('select * from public.private_snapshots')).rows.length,0);
    await denied(db.query("select public.save_private_snapshot('{}',0)"));
   });
  });
  await asRole(db,'authenticated',ids[0],async()=>{
   await check('Account switching cannot send an old owner save under the new identity',async()=>{
    await denied(db.query("select public.save_private_snapshot_for_user($1,'{}',1)",[ids[1]]));
   });
   await check('Forged ownership fields and role metadata do not grant another account access',async()=>{
    await db.query("select set_config('request.jwt.claim.role','service_role',false)");
    const fake={...payload(0),profile:{id:ids[1]},user_id:ids[1]};
    await db.query('select public.save_private_snapshot($1::jsonb,1)',[JSON.stringify(fake)]);
    const rows=(await db.query('select user_id from public.private_snapshots')).rows;assert.deepEqual(rows,[{user_id:ids[0]}]);
    await denied(db.query('select * from public.notification_device_receipts'));
    await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
   });
   await check('Concurrent stale revisions cannot overwrite a newer snapshot',async()=>{
    await db.query('select public.save_private_snapshot($1::jsonb,2)',[JSON.stringify({...payload(0),fixtureVersion:'new'})]);
    await denied(db.query('select public.save_private_snapshot($1::jsonb,2)',[JSON.stringify({...payload(0),fixtureVersion:'stale'})]));
    assert.equal((await db.query('select payload from public.private_snapshots')).rows[0].payload.fixtureVersion,'new');
   });
   await check('Earlier synthetic backup restores as a new revision and leaves history intact',async()=>{
    const earlier=(await db.query('select payload from public.private_snapshot_history where user_id=$1 and revision=1',[ids[0]])).rows[0].payload;
    assert.deepEqual(earlier,payload(0));
    const revision=(await db.query('select public.save_private_snapshot($1::jsonb,3) as revision',[JSON.stringify(earlier)])).rows[0].revision;assert.equal(revision,4);
    assert.deepEqual((await db.query('select payload from public.private_snapshots')).rows[0].payload,payload(0));
    const audit=(await db.query('select action,revision from public.private_security_audit')).rows;
    assert.ok(audit.some(x=>x.action==='snapshot_saved'&&x.revision===4));
   });
  });
  await asRole(db,'service_role',null,async()=>{
   await check('Device registration is atomic, requires prior keys before account switching, and is owner-scoped on disable',async()=>{
    const endpoint='https://fcm.googleapis.com/synthetic-device';
    const register=async(id,key='a')=>(await db.query("select public.register_private_push_device($1,$2,repeat('B',87),repeat($3,22)) as accepted",[id,endpoint,key])).rows[0].accepted;
    assert.equal(await register(ids[0]),true);
    assert.equal(await register(ids[1],'z'),false);
    assert.equal((await db.query('select user_id from public.push_subscriptions where disabled_at is null')).rows[0].user_id,ids[0]);
    assert.equal(await register(ids[1]),true);
    const rows=(await db.query('select user_id from public.push_subscriptions where disabled_at is null')).rows;assert.deepEqual(rows,[{user_id:ids[1]}]);
    await db.query('select public.disable_private_push_device($1,$2)',[ids[0],endpoint]);assert.equal((await db.query('select * from public.push_subscriptions where disabled_at is null')).rows.length,1);
    await db.query('select public.disable_private_push_device($1,$2)',[ids[1],endpoint]);assert.equal((await db.query('select * from public.push_subscriptions where disabled_at is null')).rows.length,0);
   });
   await check('Independent device rate limit accepts only its budget',async()=>{
    const query="select public.take_scoped_travel_api_slot($1,date_trunc('minute',now()),'device',2) as allowed";
    assert.equal((await db.query(query,[ids[0]])).rows[0].allowed,true);assert.equal((await db.query(query,[ids[0]])).rows[0].allowed,true);assert.equal((await db.query(query,[ids[0]])).rows[0].allowed,false);
   });
  });
  await check('Existing synthetic B/C records survive the security migration and attempted attacks unchanged',async()=>{
   for(const index of [1,2])assert.deepEqual((await db.query('select payload from public.private_snapshots where user_id=$1',[ids[index]])).rows[0].payload,payload(index));
  });
  await check('A full disposable database archive restores snapshots, history, audit, grants and RLS to a second database',async()=>{
   const archive=await db.dumpDataDir('none');
   const restored=new PGlite({extensions:{uuid_ossp},loadDataDir:archive});
   try{
    for(const [index,id] of ids.entries())await asRole(restored,'authenticated',id,async()=>{
     const rows=(await restored.query('select user_id,payload from public.private_snapshots')).rows;
     assert.equal(rows.length,1);assert.equal(rows[0].user_id,id);assert.deepEqual(rows[0].payload,payload(index));
     await denied(restored.query('select keys_auth from public.push_subscriptions'));
    });
    assert.ok((await restored.query('select count(*)::int as count from public.private_snapshot_history')).rows[0].count>=3);
    assert.ok((await restored.query('select count(*)::int as count from public.private_security_audit')).rows[0].count>=1);
   }finally{await restored.close();}
  });
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await writeFile(new URL('../test-results/rls-report.json',import.meta.url),JSON.stringify({engine:(await db.query('select version()')).rows[0].version,migrations:applied,syntheticAccounts:3,checks,limitations:['Auth/GoTrue JWT signature, expiry and refresh are not simulated by database role tests.','Cron and Vault schemas are isolated stubs; no external calls or production records are used.','PGlite has one connection; real multi-connection transaction contention needs staging Supabase validation.']},null,2));
 }finally{await db.close();}
});
