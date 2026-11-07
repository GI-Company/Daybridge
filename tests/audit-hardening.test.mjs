import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';
const user='aa070000-0000-4000-8000-000000000001';

test('revoked JWT remains denied after password setup; new session and background entitlement work',async()=>{
 const {db}=await isolatedDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[user]);
  await asRole(db,'authenticated',user,async()=>{
   await db.query("select public.save_private_snapshot('{\"tasks\":[]}',0)");
   assert.equal((await db.query('select count(*)::int n from public.private_snapshots')).rows[0].n,1);
  });
  await db.query('delete from auth.sessions where user_id=$1',[user]);
  await db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[user,JSON.stringify({daybridge_must_change_password:true})]);
  await db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[user,JSON.stringify({daybridge_must_change_password:false})]);
  await asRole(db,'authenticated',user,async()=>{
   assert.equal((await db.query('select public.daybridge_workspace_access() allowed')).rows[0].allowed,false);
   assert.equal((await db.query('select count(*)::int n from public.private_snapshots')).rows[0].n,0);
   await assert.rejects(db.query("select public.save_private_snapshot('{\"tasks\":[1]}',1)"),/row-level security/);
  });
  const session=crypto.randomUUID();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
  await asRole(db,'authenticated',user,async()=>{
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session})]);
   assert.equal((await db.query('select public.daybridge_workspace_access() allowed')).rows[0].allowed,true);
  });
  await asRole(db,'service_role','',async()=>assert.equal((await db.query('select daybridge_private.workspace_access_for_user($1) allowed',[user])).rows[0].allowed,true));
 }finally{await db.close();}
});

test('snapshot direct writes and RPCs have size/rate budgets; new history is bounded and pre-policy copies survive',async()=>{
 const {db}=await isolatedDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query("insert into public.private_snapshot_history(user_id,revision,payload,recorded_at) values($1,0,'{\"preserve\":true}','2020-01-01')",[user]);
  await asRole(db,'authenticated',user,async()=>{
   const large=JSON.stringify({notes:'x'.repeat(2097152)});
   await assert.rejects(db.query('insert into public.private_snapshots(user_id,payload) values($1,$2)',[user,large]),/snapshot_too_large/);
   await assert.rejects(db.query('select public.save_private_snapshot($1,0)',[large]),/snapshot_too_large/);
   for(let i=0;i<65;i++)await db.query('select public.save_private_snapshot($1,$2)',[JSON.stringify({notes:'n'.repeat(190000),i}),i]);
   const history=(await db.query('select revision,payload from public.private_snapshot_history order by revision')).rows;
   assert.equal(history[0].payload.preserve,true);assert.ok(history.length<51);
   const bytes=(await db.query("select sum(octet_length(payload::text))::bigint bytes from public.private_snapshot_history where revision>0")).rows[0].bytes;
   assert.ok(Number(bytes)<=8388608);
   await assert.rejects(db.query('update public.private_snapshots set payload=$1 where user_id=$2',[large,user]),/snapshot_too_large/);
  });
  await db.query('update daybridge_private.snapshot_write_budget set window_start=date_trunc(\'minute\',clock_timestamp()),writes=120 where user_id=$1',[user]);
  await asRole(db,'authenticated',user,async()=>{
   await assert.rejects(db.query("update public.private_snapshots set payload='{\"blocked\":true}' where user_id=$1",[user]),/snapshot_rate_limited/);
   await assert.rejects(db.query("select public.save_private_snapshot('{\"blocked\":true}',65)"),/snapshot_rate_limited/);
   assert.equal((await db.query('select payload from public.private_snapshots')).rows[0].payload.i,64);
  });
 }finally{await db.close();}
});

test('travel work selects due plans before its cost cap and rotates past failed/unprocessed batches',async()=>{
 const {db}=await isolatedDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query("insert into public.private_snapshots(user_id,payload) values($1,'{\"events\":[]}')",[user]);
  await db.query("insert into public.travel_preferences(user_id,traffic_notifications,origin_kind,saved_origin_lat,saved_origin_lon) values($1,true,'saved',34,-83)",[user]);
  const now='2026-11-07T12:00:00Z';
  for(let n=0;n<130;n++)await db.query(`insert into public.travel_appointments(user_id,source_event_id,occurrence_start,destination_address,destination_lat,destination_lon,origin_lat,origin_lon,source_revision,last_checked_at)
   values($1,$2,$3::timestamptz+($4||' minutes')::interval,'Synthetic address',35,-84,34,-83,'1',case when $4::int<65 then $3::timestamptz else null end)`,[user,'event-'+n,now,n+1]);
  // First 64 chronologically earlier plans were just checked. Later work must still run.
  const due=()=>asRole(db,'service_role','',()=>db.query('select * from public.daybridge_due_travel_plans($1)',[now]));
  const first=(await due()).rows;assert.equal(first.length,60);assert.ok(first.every(p=>p.last_checked_at===null));
  for(const p of first)await db.query('update public.travel_appointments set last_attempted_at=$2 where id=$1',[p.id,now]);
  const second=(await due()).rows;assert.equal(second.length,6);assert.ok(second.every(p=>!first.some(x=>x.id===p.id)));
  for(const p of second)await db.query('update public.travel_appointments set last_attempted_at=$2 where id=$1',[p.id,now]);
  const next=(await asRole(db,'service_role','',()=>db.query('select * from public.daybridge_due_travel_plans($1)',['2026-11-07T12:02:00Z']))).rows;
  assert.equal(next.length,60);assert.ok(next.some(p=>p.last_checked_at!==null));
  for(const role of ['anon','authenticated'])await asRole(db,role,user,async()=>assert.rejects(db.query('select * from public.daybridge_due_travel_plans($1)',[now]),/permission denied/));
 }finally{await db.close();}
});
