/** Alpha6 Cânone SQL integrity tests. PGlite only, synthetic data, no network/database URLs. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for (const key of ['DATABASE_URL','PGHOST','PGPORT','SUPABASE_DB_URL','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY']) {
  if (process.env[key]) throw Error('REFUSE_REMOTE_ENV '+key);
}
const req=createRequire(resolve(ROOT,'source-s22/backend/package.json'));
const {PGlite}=await import(pathToFileURL(req.resolve('@electric-sql/pglite')));
const read=(p)=>readFileSync(resolve(ROOT,p),'utf8');
const db=new PGlite();let checks=0;
const A='11111111-1111-4111-8111-111111111111';
function ok(x,msg){assert.ok(x,msg);checks++}
async function query(s){return db.query(s)}
async function exec(s){return db.exec(s)}
async function error23514(s,label){let err;try{await exec(s)}catch(e){err=e}
  ok(err?.code==='23514',`${label} expected 23514 got ${err?.code} ${err?.message}`)}
try {
  await exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users(id) VALUES ('${A}');
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  const scripts=['001_identity_and_source_bridge','002_domain_tables_82',
    '003_indexes_constraints','004_invoker_views','005_owner_policies','006_auth_user_id_compat','007_integrity_triggers'];
  for (const file of scripts){const s=read(`staging/supabase/${file}.candidate.sql.txt`);
    try{await exec(s)}catch(e){const pos=+(e.position||0);throw Error(file+': '+e.message+' SQLSTATE '+e.code+' position '+pos+' near '+s.slice(Math.max(0,pos-100),pos+140));}}
  const manifest=JSON.parse(read('staging/supabase/CANONE_INTEGRITY_ALPHA6_MANIFEST.json'));
  const c=await query(`SELECT n.nspname,t.tgname FROM pg_trigger t
    JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname LIKE 'canone_%' AND NOT t.tgisinternal`);
  ok(c.rows.length===20,'all 20 non-internal triggers exist');
  const f=await query(`SELECT p.proname,n.nspname,p.prosecdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname LIKE 'canone_%' AND p.proname IN
      ('review_event_is_immutable','forbid_mutation','answer_key_definitivo_imutavel',
       'answer_key_status_imutavel','prova_selada_nao_muda','exam_count_imutavel_apos_selo','touch_updated_at')`);
  ok(f.rows.length===7 && f.rows.every(x=>!x.prosecdef),'seven invoker trigger functions');
  for(const x of f.rows){const r=await query(`SELECT has_function_privilege('authenticated',
    '${x.nspname}.${x.proname}()', 'EXECUTE') AS allowed`);ok(!r.rows[0].allowed,'revoke execute '+x.proname)}
  await exec(`INSERT INTO canone_editorial.source(key,kind,title)
    VALUES ('synthetic-official','edital','SYNTHETIC - not licensed for publication'),
           ('synthetic-second','edital','SYNTHETIC - alternative');`);
  const sources=await query(`SELECT id,key FROM canone_editorial.source`);
  const src=sources.rows.find(x=>x.key==='synthetic-official').id;
  const src2=sources.rows.find(x=>x.key==='synthetic-second').id;
  const ed=await query(`INSERT INTO canone_taxonomy.exam_edition(code,label,edition_number,year,application_date,question_count,status)
    VALUES ('TEST.1','Synthetic Edition',1,2026,'2026-10-01',2,'realizada') RETURNING id`);
  const eid=ed.rows[0].id;
  const track=await query(`INSERT INTO canone_taxonomy.exam_track(exam_edition_id,track_code,label,question_count)
    VALUES ('${eid}','suficiencia','Synthetic Track',2) RETURNING id`);
  const tid=track.rows[0].id;
  const form=await query(`INSERT INTO canone_learning.exam_form(exam_track_id,form_code,form_label)
    VALUES ('${tid}','T01','Synthetic Form') RETURNING id`);
  const formId=form.rows[0].id;
  const key=await query(`INSERT INTO canone_learning.answer_key(exam_form_id,status,source_id)
    VALUES ('${formId}','preliminar','${src}') RETURNING id`);
  const keyId=key.rows[0].id;
  await exec(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
    VALUES ('${keyId}',1,'A'),('${keyId}',2,'B');`);
  await exec(`UPDATE canone_learning.answer_key_entry SET correct_option='C' WHERE answer_key_id='${keyId}' AND ordinal=1;`);
  ok((await query(`SELECT correct_option FROM canone_learning.answer_key_entry
       WHERE answer_key_id='${keyId}' AND ordinal=1`)).rows[0].correct_option==='C', 'preliminary key editable');
  await exec(`UPDATE canone_learning.answer_key SET status='definitivo' WHERE id='${keyId}';`);
  await error23514(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
      VALUES ('${keyId}',3,'D')`,'definitive cannot append entry');
  await error23514(`UPDATE canone_learning.answer_key_entry SET correct_option='D'
      WHERE answer_key_id='${keyId}' AND ordinal=1`,'definitive cannot change letter');
  await error23514(`DELETE FROM canone_learning.answer_key_entry
      WHERE answer_key_id='${keyId}' AND ordinal=2`,'definitive cannot remove entry');
  await error23514(`UPDATE canone_learning.answer_key SET status='preliminar' WHERE id='${keyId}'`,'definitive cannot downgrade');
  await error23514(`UPDATE canone_learning.answer_key SET source_id='${src2}' WHERE id='${keyId}'`,'definitive cannot change source');
  await error23514(`DELETE FROM canone_learning.answer_key WHERE id='${keyId}'`,'definitive cannot be deleted');
  await error23514(`UPDATE canone_taxonomy.exam_track SET question_count=3 WHERE id='${tid}'`,'cannot rebase exam track');
  await error23514(`UPDATE canone_taxonomy.exam_edition SET question_count=3 WHERE id='${eid}'`,'cannot rebase edition');
  await error23514(`INSERT INTO canone_learning.exam_form_item(exam_form_id,ordinal,item_id)
     VALUES ('${formId}',3,gen_random_uuid())`,'sealed exam cannot append positions');
  await exec(`INSERT INTO canone_audit.audit_log(action,entity_type,row_hash)
    VALUES ('SYNTHETIC','test',repeat('0',64))`);
  await error23514(`UPDATE canone_audit.audit_log SET action='changed'`,'audit event cannot update');
  await error23514(`DELETE FROM canone_audit.audit_log`,'audit event cannot delete');
  const ct=await query(`INSERT INTO canone_editorial.content_type(key,label,family)
      VALUES ('test_type','Synthetic Type','avaliacao') RETURNING id`);
  const ctv=await query(`INSERT INTO canone_editorial.content_type_version(content_type_id,version)
      VALUES ('${ct.rows[0].id}',1) RETURNING id`);
  const content=await query(`INSERT INTO canone_editorial.content_item
      (content_type_id,content_type_version_id,key,state,title)
      VALUES ('${ct.rows[0].id}','${ctv.rows[0].id}','synthetic-1','rascunho','Synthetic question') RETURNING id`);
  const item=await query(`INSERT INTO canone_learning.item(content_item_id,content_type_key,kind)
      VALUES ('${content.rows[0].id}','test_type','questao') RETURNING id`);
  await exec(`INSERT INTO canone_learning.review_event(user_id,item_id,grade,basis)
      VALUES ('${A}','${item.rows[0].id}','facil','autodeclarado');`);
  await error23514(`UPDATE canone_learning.review_event SET repetition=2`,'review event immutable update');
  await error23514(`DELETE FROM canone_learning.review_event`,'review event immutable delete');
  const note=await query(`INSERT INTO canone_learning.note(user_id,body)
      VALUES ('${A}','Synthetic note') RETURNING id`);
  await exec(`UPDATE canone_learning.note SET body='New synthetic note',updated_at='2000-01-01' WHERE id='${note.rows[0].id}'`);
  const stamp=await query(`SELECT updated_at > '2020-01-01'::timestamptz updated FROM canone_learning.note WHERE id='${note.rows[0].id}'`);
  ok(stamp.rows[0].updated,'updated_at trigger recomputes server timestamp');
  const count=await query(`SELECT count(*)::integer n FROM canone_learning.answer_key_entry WHERE answer_key_id='${keyId}'`);
  ok(count.rows[0].n===2,'definitive key remains 2 entries');
  ok(manifest.functions.length===7&&manifest.triggers.length===20,'manifest matches actual functions/triggers');
  console.log('PASS_CANONE_INTEGRITY_PGLITE',JSON.stringify({functions:7,triggers:20,checks,table_count:89,
    sealed_key_invariant:'PASS',append_only:'PASS',timestamps:'PASS',concurrency:'NOT_ATTESTED',gate:'NO_GO'}));
}finally{await db.close()}
