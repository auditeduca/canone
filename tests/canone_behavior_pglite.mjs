/** S22 behaviour SQL smoke, isolated PGlite. No credentials, no DB connection, no deployment. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const k of ['DATABASE_URL','PGHOST','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_DB_PASSWORD']){
  if(process.env[k])throw Error('REFUSE_REMOTE_ENV '+k);
}
const require=createRequire(resolve(ROOT,'source-s22/backend/package.json'));
const {PGlite}=await import(pathToFileURL(require.resolve('@electric-sql/pglite')));
const sql=(p)=>readFileSync(resolve(ROOT,p),'utf8');
const pilot=sql('staging/supabase/001_identity_and_source_bridge.candidate.sql.txt');
const tables=sql('staging/supabase/002_domain_tables_82.candidate.sql.txt');
const indexes=sql('staging/supabase/003_indexes_constraints.candidate.sql.txt');
const views=sql('staging/supabase/004_invoker_views.candidate.sql.txt');
const policies=sql('staging/supabase/005_owner_policies.candidate.sql.txt');
const authBridge=sql('staging/supabase/006_auth_user_id_compat.candidate.sql.txt');
const manifest=JSON.parse(sql('staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json'));
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const db=new PGlite();let checks=0;
function check(x,msg){assert.ok(x,msg);checks++}
async function denies(stmt,label){let rejected=false;try{await db.exec(stmt)}catch(e){rejected=true}check(rejected,'Expected denied: '+label)}
try{
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    INSERT INTO auth.users(id) VALUES ('${A}'),('${B}');
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  for(const [path,s] of [['001 PILOT',pilot],['002 TABLES',tables],['003 INDEXES',indexes],
                          ['004 VIEWS',views],['005 OWNER POLICIES',policies],['006 AUTH COMPAT',authBridge]]){
    try{await db.exec(s)}catch(e){const pos=+(e.position??0);throw Error(path+': '+e.message+' position='+pos+' nearby='+s.slice(Math.max(pos-120,0),pos+160));}
  }
  const rels=await db.query(`SELECT n.nspname,c.relkind,c.relname,c.reloptions,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'canone_%'`);
  const tb=rels.rows.filter(x=>x.relkind==='r');const vw=rels.rows.filter(x=>x.relkind==='v');
  check(tb.length===89,'89 tables from 001 + 002');
  check(tb.every(x=>x.relrowsecurity&&x.relforcerowsecurity),'deny-by-default 89 tables');
  check(vw.length===16,'16 views created');
  check(vw.every(x=>(x.reloptions??[]).includes('security_invoker=true')),'every view is security_invoker');
  const pol=await db.query(`SELECT n.nspname,c.relname,p.polname,p.polcmd FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname LIKE 'canone_%'`);
  check(pol.rows.length===21,'18 new owner policies + 3 identity pilot policies');
  check(!pol.rows.some(x=>x.relname==='answer_key'||x.relname==='answer_key_entry'||x.relname==='item_option'),'no answer key policies');
  const account=await db.query(`SELECT count(*)::integer n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='canone_identity' AND c.relname IN ('account','session','magic_link')`);
  check(account.rows[0].n===0,'no legacy credentials');
  await db.exec(`SET ROLE anon;`);
  await denies(`SELECT id FROM canone_learning.note`,'anonymous note denied');
  await denies(`SELECT id FROM canone_learning.answer_key`,'anonymous answer key denied');
  await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
  const who=await db.query('SELECT canone_ops.current_user_id() AS uid');
  check(who.rows[0].uid===A,'compat function uses authenticated identity');
  await db.exec("SELECT set_config('app.current_user_id','22222222-2222-4222-8222-222222222222',false)");
  const immutable=await db.query('SELECT canone_ops.current_user_id() AS uid');
  check(immutable.rows[0].uid===A,'legacy app.current_user_id cannot override Auth');
  const own=await db.query(`INSERT INTO canone_learning.note(user_id,body)
    VALUES ('${A}','my synthetic note') RETURNING id;`);
  check(own.rows.length===1,'A creates own note');
  const ownId=own.rows[0].id;
  await denies(`INSERT INTO canone_learning.note(user_id,body) VALUES ('${B}','forged note')`,'A cannot insert as B');
  const q=await db.query('SELECT id,user_id,body FROM canone_learning.note');
  check(q.rows.length===1&&q.rows[0].user_id===A,'A sees own note');
  await db.query(`UPDATE canone_learning.note SET body='updated' WHERE id='${ownId}'`);
  const changed=await db.query(`SELECT body FROM canone_learning.note WHERE id='${ownId}'`);
  check(changed.rows[0].body==='updated','A may update own note');
  await denies(`UPDATE canone_learning.note SET user_id='${B}' WHERE id='${ownId}'`,'A may not reassign owner');
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${B}',false);`);
  const other=await db.query('SELECT id FROM canone_learning.note');
  check(other.rows.length===0,'B cannot read A note');
  const modify=await db.query(`UPDATE canone_learning.note SET body='B writing' WHERE id='${ownId}' RETURNING id`);
  check(modify.rows.length===0,'B cannot edit A note');
  const del=await db.query(`DELETE FROM canone_learning.note WHERE id='${ownId}' RETURNING id`);
  check(del.rows.length===0,'B cannot delete A note');
  await denies(`SELECT * FROM canone_learning.answer_key`,'no direct answer key for authenticated');
  await denies(`SELECT * FROM canone_subscriber.v_item_options`,'view is invoker and has no raw item_option grant');
  await denies(`SELECT * FROM canone_admin.v_exam_form_status`,'admin-only data no grants');
  await db.exec('RESET ROLE;');
  const after=await db.query(`SELECT count(*)::integer AS n FROM canone_learning.note`);
  check(after.rows[0].n===1,'B was unable to delete A note');
  console.log('PASS_CANONE_BEHAVIOUR_PGLITE',JSON.stringify({tables:tb.length,views:vw.length,
    security_invoker:vw.length,policies:pol.rows.length,owner_operations:manifest.owner_policy_operations,
    checks,unported_functions:manifest.unported_functions,unported_triggers:manifest.unported_triggers,
    production_gate:'NO_GO',database:'PGlite synthetic'}));
}finally{await db.close()}
