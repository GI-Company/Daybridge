import {PGlite} from '@electric-sql/pglite';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {readFile,readdir} from 'node:fs/promises';
export async function isolatedDatabase({beforeSecurityMigration}={}){
 const db=new PGlite({extensions:{uuid_ossp}});
 await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create schema vault;
  create table vault.decrypted_secrets(name text,decrypted_secret text);
  create schema cron;
  create table cron.job(jobid bigint,jobname text,schedule text,active boolean,command text);
  create function cron.alter_job(job_id bigint,schedule text default null,command text default null) returns void language plpgsql as $$begin return;end$$;
  create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return;end$$;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 `);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 const applied=[];
 for(const name of (await readdir(folder)).filter(x=>x.endsWith('.sql')).sort()){
  const sql=await readFile(new URL(name,folder),'utf8');
  try{if(name.includes('personal_security_baseline')&&beforeSecurityMigration)await beforeSecurityMigration(db);await db.exec(sql);applied.push(name);}catch(error){await db.close();throw Error('Migration failed: '+name+': '+error.message);}
 }
 return {db,applied};
}
export async function asRole(db,role,id,work){
 if(!['anon','authenticated','service_role'].includes(role))throw Error('Invalid fixture role');
 await db.exec('set role '+role);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
 try{return await work();}finally{await db.exec('reset role');}
}
