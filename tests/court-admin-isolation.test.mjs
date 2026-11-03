import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,asRole} from './rls-harness.mjs';

const ids=[
 'd0000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000003',
 'd0000000-0000-4000-8000-000000000004',
 'd0000000-0000-4000-8000-000000000005',
];
const [staffOne,staffTwo,userOne,userTwo,userThree]=ids;
const denial=async work=>assert.rejects(work(),err=>
 ['42501','P0001','23505'].includes(err.code)||
 /not an authorized|permission denied|duplicate/i.test(err.message));

test('court hierarchy enforces database tenancy and seat limits',async()=>{
 const {db}=await isolatedDatabase();
 try {
  const sample=(await db.query(
   "select c.id,c.court_name,c.login_slug as court_slug,j.id as circuit_id,j.name as circuit,j.login_slug as circuit_slug,s.name as state,c.seat_limit,c.is_demo from public.daybridge_courts c join public.daybridge_judicial_circuits j on j.id=c.circuit_id join public.daybridge_states s on s.code=j.state_code where c.court_name='Sample Court' and s.code='ZZ'"
  )).rows;
  assert.equal(sample.length,1);
  assert.equal(sample[0].state,'Sample State');
  assert.equal(sample[0].circuit,'Sample Judicial Circuit');
  assert.equal(sample[0].is_demo,true);
  assert.equal(sample[0].seat_limit,25);
  assert.equal(sample[0].circuit_slug,'samplecircuit');
  assert.equal(sample[0].court_slug,'samplecourt');

  const courtOne=sample[0].id;
  const circuit=sample[0].circuit_id;
  const courtTwo=(await db.query(
   "insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit,listed) values($1,'Another Sample Court','anothercourt',25,true) returning id",[circuit]
  )).rows[0].id;
  const otherCircuit=(await db.query(
   "insert into public.daybridge_judicial_circuits(state_code,name,login_slug) values('ZZ','Second Sample Circuit','secondcircuit') returning id"
  )).rows[0].id;
  const courtThree=(await db.query(
   "insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit,listed) values($1,'Sample Court','samplecourt',25,true) returning id",[otherCircuit]
  )).rows[0].id;

  assert.notEqual(courtOne,courtTwo);
  assert.notEqual(courtOne,courtThree);
  await denial(()=>db.query(
   "insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit) values($1,'Sample Court','samplecourt',25)",[circuit]));
  for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
  // Trusted project owner (postgres), not a browser or service_role,
  // maps already-provisioned Auth users to court membership.
  await db.query(
    "insert into public.daybridge_court_staff(court_id,user_id,role) values ($1,$3,'case_manager'),($2,$4,'coordinator')",
    [courtOne,courtTwo,staffOne,staffTwo]);
  assert.equal((await db.query('select count(*)::int as n from public.daybridge_court_staff')).rows[0].n,2);

  await asRole(db,'authenticated',staffOne,async()=>{
   await denial(()=>db.query('select * from public.daybridge_court_participants'));
   await denial(()=>db.query('select * from public.daybridge_court_staff'));
   await denial(()=>db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtOne,userOne,'sample-one',staffOne]));
  });
  await asRole(db,'anon','',async()=>{
   await denial(()=>db.query('select * from public.daybridge_courts'));
  });

  await asRole(db,'service_role',staffOne,async()=>{
   await db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtOne,userOne,'sample-one',staffOne]);
   await denial(()=>db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtTwo,userTwo,'sample-two',staffOne]));
   await denial(()=>db.query(
    'select public.daybridge_transition_participant($1,$2,$3,$4)',
    [courtTwo,userOne,staffOne,'remove']));
  });
  assert.deepEqual((await db.query(
   'select court_id,username from public.daybridge_court_participants where user_id=$1',
   [userOne])).rows,[{court_id:courtOne,username:'sample-one'}]);

  await db.query('update public.daybridge_courts set seat_limit=1 where id=$1',[courtOne]);
  await asRole(db,'service_role',staffOne,async()=>{
   await denial(()=>db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtOne,userTwo,'sample-two',staffOne]));
   const status=(await db.query(
    'select public.daybridge_transition_participant($1,$2,$3,$4) as status',
    [courtOne,userOne,staffOne,'remove'])).rows[0].status;
   assert.equal(status,'removed');
   await db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtOne,userTwo,'sample-two',staffOne]);
  });
  assert.equal((await db.query(
   "select count(*)::int as n from public.daybridge_court_participants where court_id=$1 and status='active'",
   [courtOne])).rows[0].n,1);
  assert.equal((await db.query(
   'select count(*)::int as n from auth.users where id=$1',[userOne])).rows[0].n,1);

  await asRole(db,'service_role',staffTwo,async()=>{
   await db.query(
    'select public.daybridge_assign_participant($1,$2,$3,$4)',
    [courtTwo,userThree,'sample-three',staffTwo]);
  });
  assert.equal((await db.query(
   'select count(*)::int as n from public.daybridge_court_participants where court_id=$1',
   [courtThree])).rows[0].n,0);
 }finally{await db.close();}
});
