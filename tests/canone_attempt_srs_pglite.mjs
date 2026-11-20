/** Alpha.8 PGlite: private exam service + exactly-once SRS, synthetic fixtures. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const name of ['DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_DB_PASSWORD',
                    'PGHOST','PGPORT','SUPABASE_DB_URL']){
 if(process.env[name])throw Error('REFUSE_REMOTE_ENV '+name);
}
const req=createRequire(resolve(root,'source-s22/backend/package.json'));
const {PGlite}=await import(pathToFileURL(req.resolve('@electric-sql/pglite')));
const db=new PGlite();const read=(p)=>readFileSync(resolve(root,p),'utf8');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
let checks=0;
const q=(sql)=>db.query(sql);
const run=(sql)=>db.exec(sql);
function ok(expr,label){assert.ok(expr,label);checks++}
async function fails(sql,code,label){let e;try{await run(sql)}catch(err){e=err}
 ok(e?.code===code,`${label}: expected ${code}, got ${e?.code} ${e?.message}`)}
const one=async(sql)=>{const r=await q(sql);return r.rows[0];};
try{
 await run(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  INSERT INTO auth.users(id) VALUES ('${A}'),('${B}');
  GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;`);
 const scripts=['001_identity_and_source_bridge','002_domain_tables_82',
  '003_indexes_constraints','004_invoker_views','005_owner_policies',
  '006_auth_user_id_compat','007_integrity_triggers','008_audit_chain_and_seal',
  '009_attempt_grade_srs'];
 for(const name of scripts){const sql=read(`staging/supabase/${name}.candidate.sql.txt`);
  try{await run(sql)}catch(e){const p=+(e.position||0);throw Error(name+': '+e.message+
     ' SQLSTATE '+e.code+' pos '+p+' near '+sql.slice(Math.max(0,p-100),p+100));}}
 const fn=await q(`SELECT proname,prosecdef FROM pg_proc p JOIN pg_namespace n
   ON n.oid=p.pronamespace WHERE n.nspname='canone_ops' AND proname LIKE 'exam_%'`);
 ok(fn.rows.length===5&&fn.rows.every(x=>x.prosecdef),'five private definer service methods');
 const rls=await one(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
   WHERE oid='canone_learning.exam_review_receipt'::regclass`);
 ok(rls.relrowsecurity&&rls.relforcerowsecurity,'receipt deny-by-default and FORCE RLS');
 for(const [sig,desc] of [
  ['canone_ops.exam_start(uuid)','start'],
  ['canone_ops.exam_answer(uuid,integer,text)','answer'],
  ['canone_ops.exam_finish(uuid)','finish'],
  ['canone_ops.exam_reveal(uuid)','reveal'],
  ['canone_ops.exam_to_srs(uuid,integer)','srs']]){
  const p=await one(`SELECT has_function_privilege('authenticated','${sig}','EXECUTE') allowed`);
  ok(!p.allowed,desc+' not directly executable by browser');
 }
 const source=(await one(`INSERT INTO canone_editorial.source(key,kind,title)
     VALUES ('alpha8-synthetic','edital','SYNTHETIC - NO REAL EXAM') RETURNING id`)).id;
 const ed=(await one(`INSERT INTO canone_taxonomy.exam_edition
   (code,label,edition_number,year,application_date,question_count,status)
   VALUES ('AL8.1','Synthetic edition',1,2026,'2026-10-01',2,'realizada') RETURNING id`)).id;
 const track=(await one(`INSERT INTO canone_taxonomy.exam_track
   (exam_edition_id,track_code,label,question_count)
   VALUES ('${ed}','suficiencia','Synthetic track',2) RETURNING id`)).id;
 const form=(await one(`INSERT INTO canone_learning.exam_form(exam_track_id,form_code,form_label)
   VALUES ('${track}','T01','Synthetic form') RETURNING id`)).id;
 const key=(await one(`INSERT INTO canone_learning.answer_key(exam_form_id,status,source_id)
   VALUES ('${form}','preliminar','${source}') RETURNING id`)).id;
 const type=(await one(`INSERT INTO canone_editorial.content_type(key,label,family)
   VALUES ('alpha8_type','Synthetic type','avaliacao') RETURNING id`)).id;
 const typever=(await one(`INSERT INTO canone_editorial.content_type_version(content_type_id,version)
    VALUES ('${type}',1) RETURNING id`)).id;
 const items=[];
 for(let n=1;n<=2;n++){
  const ct=(await one(`INSERT INTO canone_editorial.content_item
    (content_type_id,content_type_version_id,key,state,title)
    VALUES ('${type}','${typever}','alpha8-item-${n}','rascunho','Synthetic ${n}') RETURNING id`)).id;
  const item=(await one(`INSERT INTO canone_learning.item(content_item_id,content_type_key,kind)
    VALUES ('${ct}','alpha8_type','questao') RETURNING id`)).id;
  items.push(item);
  await run(`INSERT INTO canone_learning.exam_form_item(exam_form_id,ordinal,item_id)
    VALUES ('${form}',${n},'${item}')`);
 }
 await run(`INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option,is_annulled)
    VALUES ('${key}',1,'A',false),('${key}',2,NULL,true);`);
 await run(`SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
 await fails(`SELECT canone_ops.exam_start('${form}')`,'23514','cannot start unsealed form');
 await run('RESET ROLE');
 await run(`UPDATE canone_learning.answer_key SET status='definitivo' WHERE id='${key}'`);
 await run(`SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
 const attempt=(await one(`SELECT canone_ops.exam_start('${form}') id`)).id;
 ok(!!attempt,'owner can start published/definitive exam');
 await fails(`SELECT * FROM canone_ops.exam_reveal('${attempt}')`,'42501','no key before finishing');
 await fails(`SELECT canone_ops.exam_to_srs('${attempt}',1)`,'23514','no SRS before finishing');
 await fails(`SELECT canone_ops.exam_answer('${attempt}',1,'F')`,'23514','invalid answer');
 await fails(`SELECT canone_ops.exam_answer('${attempt}',9,'A')`,'23514','unknown exam position');
 await run(`SELECT canone_ops.exam_answer('${attempt}',1,'B')`);
 await run(`SELECT canone_ops.exam_answer('${attempt}',1,'a')`);
 await run(`SELECT canone_ops.exam_answer('${attempt}',2,'C')`);
 await run('RESET ROLE');
 const counts=await one(`SELECT answered_count,correct_count,wrong_count,annulled_count
   FROM canone_learning.exam_attempt WHERE id='${attempt}'`);
 ok(counts.answered_count===2&&counts.correct_count===1&&counts.wrong_count===0&&counts.annulled_count===1,
   'answer upsert recalculates counts and annulled not wrong');
 const raw=await one(`SELECT chosen_option,verdict FROM canone_learning.exam_attempt_answer
    WHERE attempt_id='${attempt}' AND ordinal=1`);
 ok(raw.chosen_option==='A'&&raw.verdict==='correta','server verdict not caller-provided');
 await run(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
 await fails(`SELECT canone_ops.exam_start('${form}')`,'42501','browser cannot invoke private service');
 await fails(`SELECT * FROM canone_learning.exam_attempt_answer`,'42501','browser cannot read in-progress answer');
 await fails(`SELECT correct_count FROM canone_learning.exam_attempt`,'42501','browser cannot see in-progress correct count');
 await run('RESET ROLE');
 await run(`SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','${B}',false);`);
 await fails(`SELECT canone_ops.exam_answer('${attempt}',1,'A')`,'42501','other user cannot answer');
 await fails(`SELECT * FROM canone_ops.exam_finish('${attempt}')`,'42501','other user cannot finish');
 await fails(`SELECT * FROM canone_ops.exam_reveal('${attempt}')`,'42501','other user cannot reveal');
 await run(`SELECT set_config('request.jwt.claim.sub','${A}',false)`);
 const completed=await one(`SELECT * FROM canone_ops.exam_finish('${attempt}')`);
 ok(completed.correct_count===1&&completed.annulled_count===1&&completed.answered_count===2,'finish returns only factual counters');
 const again=await one(`SELECT * FROM canone_ops.exam_finish('${attempt}')`);
 ok(again.correct_count===1&&again.answered_count===2,'repeat finish idempotent');
 await fails(`SELECT canone_ops.exam_answer('${attempt}',1,'B')`,'23514','cannot rewrite finished answer');
 const revealed=await q(`SELECT * FROM canone_ops.exam_reveal('${attempt}')`);
 ok(revealed.rows.length===2&&revealed.rows[0].correct_option==='A'&&
    revealed.rows[1].is_annulled,'reveal correct key only after finish');
 const srs1=(await one(`SELECT canone_ops.exam_to_srs('${attempt}',1) id`)).id;
 const srsAgain=(await one(`SELECT canone_ops.exam_to_srs('${attempt}',1) id`)).id;
 ok(srs1===srsAgain,'duplicate SRS import idempotent');
 const ann=(await one(`SELECT canone_ops.exam_to_srs('${attempt}',2) id`)).id;
 ok(ann===null,'annulled question never added to SRS');
 await run('RESET ROLE');
 const event=await one(`SELECT basis,correct,grade,algorithm_version FROM canone_learning.review_event
    WHERE id='${srs1}'`);
 ok(event.basis==='sistema'&&event.correct===true&&event.grade==='facil'&&
    event.algorithm_version==='canone-srs-exam-v1','server-derived SRS event');
 const state=await one(`SELECT repetitions,lapses,last_grade FROM canone_learning.user_item_state
    WHERE user_id='${A}' AND item_id='${items[0]}'`);
 ok(state.repetitions===1&&state.lapses===0&&state.last_grade==='facil',
   'SRS idempotent state persisted once');
 const n=await one(`SELECT count(*)::integer n FROM canone_learning.exam_review_receipt`);
 ok(n.n===1,'one receipt despite retry and annulment');
 await run(`SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','${B}',false);`);
 await fails(`SELECT canone_ops.exam_to_srs('${attempt}',1)`,'42501','other user cannot convert SRS');
 await run(`SELECT set_config('request.jwt.claim.sub','',false)`);
 await fails(`SELECT canone_ops.exam_start('${form}')`,'42501','no JWT cannot start');
 await run('RESET ROLE');
 console.log('PASS_CANONE_ALPHA8_ATTEMPT_SRS_PGLITE',JSON.stringify({checks,
  methods:5,receipt_tables:1,answers:2,completed:true,duplicate_srs_events:0,
  browser_verdict_access:'DENIED',other_user_access:'DENIED',gate:'NO_GO'}));
}finally{await db.close()}
