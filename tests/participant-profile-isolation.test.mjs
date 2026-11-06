import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';

test('participant profiles stay court-private, allow matching names and enforce atomic unique assignments',async()=>{
 const {db}=await isolatedDatabase();
 const ids=Array.from({length:6},(_,i)=>'a9000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
 const [staff,otherStaff,one,two,three,four]=ids;
 try{
  for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
  const {id:court,circuit_id:circuit}=(await db.query("select id,circuit_id from public.daybridge_courts where court_name='Sample Court'")).rows[0];
  const other=(await db.query("insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit) values($1,'Other Court','other',25) returning id",[circuit])).rows[0].id;
  await db.query("insert into public.daybridge_court_staff(court_id,user_id,role) values($1,$2,'case_manager'),($3,$4,'coordinator')",[court,staff,other,otherStaff]);
  const assign=(user,username,birth='1990-01-15',actor=staff,courtId=court)=>asRole(db,'service_role',actor,()=>db.query('select public.daybridge_assign_participant_profile($1,$2,$3,$4,$5,$6)',[courtId,user,username,actor,'Alex Sample',birth]));
  for(const role of ['anon','authenticated'])await asRole(db,role,staff,async()=>{
   await assert.rejects(db.query('select participant_name,birth_date from public.daybridge_court_participants'),/permission denied/i);
   await assert.rejects(db.query('select public.daybridge_assign_participant_profile($1,$2,$3,$4,$5,$6)',[court,one,'aaaa0001',staff,'Alex Sample','1990-01-15']),/permission denied/i);
  });
  await assert.rejects(assign(one,'aaaa0001','1990-01-15',otherStaff),/Not an authorized/i);
  await assert.rejects(assign(one,'aaaa0001','2999-01-01'),/valid date of birth/i);
  await assign(one,'aaaa0001');await assign(two,'bbbb0002','1993-07-21');await assign(three,'cccc0003');
  assert.deepEqual((await db.query('select participant_name,birth_date::text from public.daybridge_court_participants order by username')).rows,[{participant_name:'Alex Sample',birth_date:'1990-01-15'},{participant_name:'Alex Sample',birth_date:'1993-07-21'},{participant_name:'Alex Sample',birth_date:'1990-01-15'}]);
  await assert.rejects(assign(four,'aaaa0001','1990-01-15',otherStaff,other),/duplicate/i);
  assert.equal((await db.query('select * from public.daybridge_court_participants where user_id=$1',[four])).rows.length,0);
  await db.query('update public.daybridge_courts set seat_limit=3 where id=$1',[court]);
  await assert.rejects(assign(four,'dddd0004'),/seat limit/i);
  assert.equal((await db.query("select count(*)::int as n from public.daybridge_court_audit where action='participant_created'")).rows[0].n,3);
  await db.query('update public.daybridge_court_staff set password_change_required=true where user_id=$1',[staff]);
  await assert.rejects(assign(four,'dddd0004'),/Not an authorized/i);
 }finally{await db.close();}
});
