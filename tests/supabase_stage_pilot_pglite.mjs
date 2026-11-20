/** Ephemeral PGlite smoke test for Cânone Supabase Identity candidate.
 * ONLY in-memory, artificial auth.users and auth.uid() fixture; NO network/keys.
 * PGlite differs from managed Supabase PG17; does not certify remote promotion.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (['DATABASE_URL','PGHOST','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY'].some(k => process.env[k])) {
  throw Error('REFUSE: external DB env is set; disposable-only test');
}
const req = createRequire(resolve(ROOT,'source-s22/backend/package.json'));
const pglitePath = req.resolve('@electric-sql/pglite');
const { PGlite } = await import(pathToFileURL(pglitePath));
const sql = readFileSync(resolve(ROOT,'staging/supabase/001_identity_and_source_bridge.candidate.sql.txt'),'utf8');
const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let assertions = 0;
const check = (condition,msg) => { assert.ok(condition,msg); assertions++; };
const denied = async (sqlText) => {
  try { await db.exec(sqlText); } catch (e) { assertions++; return; }
  throw Error('EXPECTED_PERMISSION_OR_RLS_DENIAL: '+sqlText);
};
try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    INSERT INTO auth.users(id) VALUES ('${A}'),('${B}');
  `);
  await db.exec(sql);
  const tables = await db.query(`SELECT count(*)::integer AS n FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('canone_identity','canone_bridge') AND c.relkind='r'`);
  check(tables.rows[0].n===7,'expected seven pilot tables');
  const rls = await db.query(`SELECT count(*)::integer AS n FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('canone_identity','canone_bridge') AND c.relkind='r'
       AND c.relrowsecurity AND c.relforcerowsecurity`);
  check(rls.rows[0].n===7,'RLS and FORCE required on all tables');
  const policies = await db.query(`SELECT count(*)::integer AS n FROM pg_policy p
      JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('canone_identity','canone_bridge')`);
  check(policies.rows[0].n===3,'three profile policies expected');
  const source = await db.query(`SELECT count(*)::integer AS n FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('identity','public')
      AND c.relname IN ('account','session','magic_link')`);
  check(source.rows[0].n===0,'no custom credential/session tables');
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
  await db.exec(`INSERT INTO canone_identity.user_profile(user_id,display_name)
      VALUES ('${A}','Aluno A');`);
  await denied(`INSERT INTO canone_identity.user_profile(user_id,display_name)
      VALUES ('${B}','Wrong owner');`);
  const visible = await db.query('SELECT user_id FROM canone_identity.user_profile');
  check(visible.rows.length===1 && visible.rows[0].user_id===A,'A reads own profile only');
  await denied(`INSERT INTO canone_identity.user_role(user_id,role_key) VALUES ('${A}','admin');`);
  await denied(`INSERT INTO canone_bridge.source_binding(source_system,source_kind,external_object_id,source_version)
      VALUES ('other','normative','x','v1');`);
  await denied(`SELECT * FROM canone_identity.private_profile`);
  await denied(`UPDATE canone_identity.user_profile SET user_id='${B}' WHERE user_id='${A}';`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${B}',false);`);
  const hidden = await db.query('SELECT user_id FROM canone_identity.user_profile');
  check(hidden.rows.length===0,'B cannot read A profile');
  const changed = await db.query(`UPDATE canone_identity.user_profile SET display_name='Hijacked' WHERE user_id='${A}' RETURNING user_id`);
  check(changed.rows.length===0,'B cannot update A profile');
  await db.exec('RESET ROLE;');
  const unchanged = await db.query(`SELECT display_name FROM canone_identity.user_profile WHERE user_id='${A}'`);
  check(unchanged.rows[0].display_name==='Aluno A','cross-tenant update denied');
  // Guard rejects source shared project when governance catalog is present.
  const isolated = new PGlite();
  try {
    await isolated.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
       CREATE SCHEMA canone_control; CREATE TABLE canone_control.migration_catalog(id integer);`);
    let guarded=false;
    try { await isolated.exec(sql); } catch (e) { guarded=String(e).includes('CANONE_REFUSE_SHARED_SOURCE'); }
    check(guarded,'shared-source guard must reject governance catalog');
  } finally { await isolated.close(); }
  console.log('PASS_S22_TO_SUPABASE_PGLITE_SMOKE',JSON.stringify({tables:7,rls:7,policies:3,checks:assertions,gate:'NO_GO',engine:'PGlite in-memory'}));
} finally { await db.close(); }
