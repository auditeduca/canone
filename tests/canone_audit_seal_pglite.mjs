/** Cânone v0.23.0-alpha.7: isolated PostgreSQL engine tests; synthetic data only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const k of ['DATABASE_URL','PGHOST','PGPORT','SUPABASE_DB_URL','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY']){
  if(process.env[k])throw Error('REFUSE_REMOTE_ENV '+k);
}
const require=createRequire(resolve(ROOT,'source-s22/backend/package.json'));
const {PGlite}=await import(pathToFileURL(require.resolve('@electric-sql/pglite')));
const read=(p)=>readFileSync(resolve(ROOT,p),'utf8');
const db=new PGlite();let checks=0;
const A='11111111-1111-4111-8111-111111111111';
function ok(v,msg){assert.ok(v,msg);checks++}
async function exec(sql){return db.exec(sql)}
async function query(sql){return db.query(sql)}
async function denied(sql,label,expected='23514'){
  let error;try{await exec(sql)}catch(e){error=e}
  ok(error?.code===expected,`${label}: expected ${expected}, got ${error?.code}: ${error?.message}`);
}
try{
  await exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users(id) VALUES ('${A}');
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  for(const name of ['001_identity_and_source_bridge','002_domain_tables_82',
    '003_indexes_constraints','004_invoker_views','005_owner_policies',
    '006_auth_user_id_compat','007_integrity_triggers','008_audit_chain_and_seal']){
    const sql=read(`staging/supabase/${name}.candidate.sql.txt`);
    try{await exec(sql)}catch(e){const p=+(e.position??0);throw Error(name+': '+e.message+
      ' SQLSTATE='+e.code+' position='+p+' nearby='+sql.slice(Math.max(0,p-100),p+160))}
  }
  const auditFns=await query(`SELECT proname,prosecdef FROM pg_proc p JOIN pg_namespace n
    ON n.oid=p.pronamespace WHERE n.nspname='canone_audit' AND
    proname IN ('audit_payload','compute_row_hash','set_row_hash','verify_chain')`);
  ok(auditFns.rows.length===4&&auditFns.rows.every(x=>!x.prosecdef),'audit functions are invoker');
  const trigger=await query(`SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='canone_audit' AND c.relname='audit_log' AND NOT tgisinternal`);
  ok(trigger.rows.length===3,'append, immutable, and truncate guards');
  const perms=await query(`SELECT has_function_privilege('authenticated',
    'canone_audit.verify_chain(bigint)','EXECUTE') AS allowed`);
  ok(!perms.rows[0].allowed,'no browser execute on verify_chain');
  // Caller-supplied hashes and seq are always overwritten.
  await exec(`INSERT INTO canone_audit.audit_log(seq,prev_hash,row_hash,actor_role,
    action,entity_type,request_id,metadata) VALUES
    (999,repeat('f',64),repeat('0',64),'system','SYNTH-A','attempt','R1','{"k":"v1"}');`);
  await exec(`INSERT INTO canone_audit.audit_log(action,entity_type,actor_id,subject_user_id,
    user_agent,ip_address,metadata) VALUES
    ('SYNTH-B','support','${A}','${A}','test-agent','192.0.2.10','{"p":true}');`);
  const logs=await query(`SELECT seq,prev_hash,row_hash,action FROM canone_audit.audit_log ORDER BY seq`);
  ok(logs.rows.length===2&&logs.rows[0].seq===1&&logs.rows[1].seq===2,'server-assigned monotonic seq');
  ok(logs.rows[0].prev_hash===null&&logs.rows[0].row_hash!==('0'.repeat(64)),'cannot forge first hash');
  ok(logs.rows[1].prev_hash===logs.rows[0].row_hash,'second hash chained');
  const valid=await query(`SELECT count(*)::integer n FROM canone_audit.verify_chain()`);
  ok(valid.rows[0].n===0,'complete chain validates');
  const partial=await query(`SELECT count(*)::integer n FROM canone_audit.verify_chain(2)`);
  ok(partial.rows[0].n===0,'partial verification computes window over all rows');
  await denied(`UPDATE canone_audit.audit_log SET metadata='{"tampered":true}' WHERE seq=2`, 'audit immutable');
  await denied('DELETE FROM canone_audit.audit_log WHERE seq=2','audit cannot delete');
  await denied('TRUNCATE canone_audit.audit_log','audit cannot truncate');
  // Administrative corruption simulation only: superuser disables the immutable
  // guard, verifier must detect even an unprotected metadata column alteration.
  await exec(`ALTER TABLE canone_audit.audit_log DISABLE TRIGGER trg_audit_no_update;
    UPDATE canone_audit.audit_log SET actor_role='forged' WHERE seq=1;
    ALTER TABLE canone_audit.audit_log ENABLE TRIGGER trg_audit_no_update;`);
  const invalid=await query(`SELECT seq,ok FROM canone_audit.verify_chain()`);
  ok(invalid.rows.length===1&&invalid.rows[0].seq===1&&!invalid.rows[0].ok,'tampering detected by recompute');
  // This test does not assert superuser-resistant integrity; external anchoring needed.
  await exec(`INSERT INTO canone_editorial.source(key,kind,title)
     VALUES ('alpha7-official','edital','SYNTHETIC - no official text');`);
  const source=(await query(`SELECT id FROM canone_editorial.source WHERE key='alpha7-official'`)).rows[0].id;
  const ed=(await query(`INSERT INTO canone_taxonomy.exam_edition
     (code,label,edition_number,year,application_date,question_count,status)
     VALUES ('AL7.1','Synthetic',1,2026,'2026-10-01',2,'realizada') RETURNING id`)).rows[0].id;
  const track=(await query(`INSERT INTO canone_taxonomy.exam_track(exam_edition_id,track_code,label,question_count)
     VALUES ('${ed}','suficiencia','Test track',2) RETURNING id`)).rows[0].id;
  const form=(await query(`INSERT INTO canone_learning.exam_form(exam_track_id,form_code,form_label)
     VALUES ('${track}','T01','Synthetic Form') RETURNING id`)).rows[0].id;
  await denied(`INSERT INTO canone_learning.answer_key(exam_form_id,status,source_id)
     VALUES ('${form}','definitivo','${source}')`,'direct definitive insert prohibited');
  const key=(await query(`INSERT INTO canone_learning.answer_key(exam_form_id,status,source_id)
     VALUES ('${form}','preliminar','${source}') RETURNING id`)).rows[0].id;
  await denied(`UPDATE canone_learning.answer_key SET status='definitivo' WHERE id='${key}'`,
    'cannot seal empty form or answers');
  await exec(`INSERT INTO canone_editorial.content_type(key,label,family)
      VALUES ('alpha7_type','Synthetic Type','avaliacao');`);
  const ct=(await query(`SELECT id FROM canone_editorial.content_type WHERE key='alpha7_type'`)).rows[0].id;
  const ctv=(await query(`INSERT INTO canone_editorial.content_type_version(content_type_id,version)
      VALUES ('${ct}',1) RETURNING id`)).rows[0].id;
  for(let n=1;n<=2;n++){
    const c=(await query(`INSERT INTO canone_editorial.content_item
      (content_type_id,content_type_version_id,key,state,title)
      VALUES ('${ct}','${ctv}','alpha7-item-${n}','rascunho','Synthetic Item ${n}') RETURNING id`)).rows[0].id;
    const item=(await query(`INSERT INTO canone_learning.item(content_item_id,content_type_key,kind)
      VALUES ('${c}','alpha7_type','questao') RETURNING id`)).rows[0].id;
    await exec(`INSERT INTO canone_learning.exam_form_item(exam_form_id,ordinal,item_id)
      VALUES ('${form}',${n},'${item}');`);
    if(n===1)await denied(`UPDATE canone_learning.answer_key SET status='definitivo'
       WHERE id='${key}'`,'cannot seal incomplete form');
  }
  await exec(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
    VALUES ('${key}',1,'A');`);
  await denied(`UPDATE canone_learning.answer_key SET status='definitivo' WHERE id='${key}'`,
      'cannot seal incomplete answer key');
  await exec(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
    VALUES ('${key}',2,'B');`);
  await exec(`UPDATE canone_learning.answer_key SET status='definitivo' WHERE id='${key}';`);
  ok((await query(`SELECT status FROM canone_learning.answer_key WHERE id='${key}'`)).rows[0].status==='definitivo',
    'complete contiguous form+key can seal');
  await denied(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
    VALUES ('${key}',3,'C')`,'cannot append after seal');
  await denied(`DELETE FROM canone_learning.exam_form_item WHERE exam_form_id='${form}' AND ordinal=2`,
    'cannot delete form position after seal');
  await denied(`UPDATE canone_learning.answer_key SET status='preliminar' WHERE id='${key}'`,
    'cannot reopen definitive key');
  await exec('SET ROLE authenticated');
  const q=await query(`SELECT has_table_privilege('authenticated','canone_audit.audit_log','SELECT') AS allowed`);
  ok(!q.rows[0].allowed,'audit log remains unavailable to client');
  await exec('RESET ROLE');
  console.log('PASS_CANONE_ALPHA7_AUDIT_SEAL_PGLITE',JSON.stringify({checks,audit_events:logs.rows.length,
    audit_hash_version:'canone-audit-v2',sealed_key_test:'PASS',
    tamper_detection:'PASS',multi_connection_concurrency:'NOT_ATTESTED',gate:'NO_GO'}));
}finally{await db.close()}
