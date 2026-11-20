/** Ephemeral S22 82-table DDL conversion smoke. No network/remote credentials. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for (const k of ['DATABASE_URL','PGHOST','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY']) {
  if(process.env[k]) throw Error('Refuse to run with remote DB environment: '+k);
}
const require=createRequire(resolve(ROOT,'source-s22/backend/package.json'));
const {PGlite}=await import(pathToFileURL(require.resolve('@electric-sql/pglite')));
const sql=readFileSync(resolve(ROOT,'staging/supabase/002_domain_tables_82.candidate.sql.txt'),'utf8');
const pilot=readFileSync(resolve(ROOT,'staging/supabase/001_identity_and_source_bridge.candidate.sql.txt'),'utf8');
const manifest=JSON.parse(readFileSync(resolve(ROOT,'staging/supabase/CANONE_DOMAIN_TABLES_CONVERSION_MANIFEST.json'),'utf8'));
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const db=new PGlite();
let checks=0;
const check=(cond,description)=>{assert.ok(cond,description);checks++};
const denies=async(statement)=>{let refused=false;try{await db.exec(statement)}catch(e){refused=true}check(refused,'Expected denied statement: '+statement)};
try{
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    INSERT INTO auth.users(id) VALUES ('${A}'), ('${B}');`);
  await db.exec(pilot);
  await db.exec(sql);
  const objects=await db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name, c.relrowsecurity AS rls,
      c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE n.nspname LIKE 'canone_%' AND c.relkind='r';`);
  check(objects.rows.length===89,`Expected 89 tables (82 + 7 pilot), got ${objects.rows.length}`);
  check(objects.rows.every(r=>r.rls&&r.force_rls),'RLS + FORCE on all app tables');
  for(const record of manifest.generated.filter(r=>r.strategy==='generated_candidate')){
    const [schema_name,table_name]=record.target.split('.');
    check(objects.rows.some(x=>x.schema_name===schema_name&&x.table_name===table_name),'Missing '+record.target);
  }
  const authConstraints=await db.query(`SELECT count(*)::integer n FROM pg_constraint co JOIN pg_class c ON c.oid=co.confrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE co.contype='f' AND n.nspname='auth' AND c.relname='users';`);
  check(authConstraints.rows[0].n>=38,'Expected >=38 managed Auth user FKs');
  const policies=await db.query(`SELECT count(*)::integer AS n FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname LIKE 'canone_%'`);
  check(policies.rows[0].n===3,'Only piloted owner policies may exist');
  const legacy=await db.query(`SELECT count(*)::integer n FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE n.nspname IN ('identity','learning','public') AND c.relname IN ('account','session','magic_link','exam_attempt')`);
  check(legacy.rows[0].n===0,'No legacy schemas/credential tables');
  await db.exec(`GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
  await denies(`SELECT * FROM canone_learning.exam_attempt`);
  await denies(`INSERT INTO canone_learning.exam_attempt(user_id,status) VALUES ('${B}','em_andamento')`);
  await denies(`SELECT * FROM canone_learning.answer_key`);
  await denies(`UPDATE canone_admin.feature_flag SET is_enabled = true`);
  await db.exec('RESET ROLE;');
  console.log('PASS_CANONE_82_TABLES_PGLITE',JSON.stringify({tables:objects.rows.length,generated:82,pilot:7,rls_forced:89,auth_fk_min:38,checks,policies:3,production_gate:'NO_GO',engine:'PGlite in-memory'}));
}finally{await db.close()}
