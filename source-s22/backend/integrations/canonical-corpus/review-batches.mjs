#!/usr/bin/env node
// Fila determinística de revisão: nenhuma heurística converte extração em afirmação canônica.
// O item de revisão contém IDs, hashes e localizadores, NÃO texto integral nem gabarito.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=x=>createHash('sha256').update(x).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
const group=(rows,origin)=>rows.filter(r=>r.origin===origin);
const id=x=>typeof x==='string'?x.trim():'';
const byId=arr=>new Map(arr.map(r=>[r.origin_pk,r]));
const safe=v=>v===undefined||v===null?null:String(v);
function batches(items,{kind,batchSize}) {
 const out=[];
 for(let i=0;i<items.length;i+=batchSize){
   const slice=items.slice(i,i+batchSize);
   const key=`${kind}:${slice[0]?.instrument_id||slice[0]?.source_id||'UNKNOWN'}:${i}:${slice.map(x=>x.unit_id||x.question_id).join('|')}`;
   out.push({id:`CBATCH-${hash(key).slice(0,20)}`,kind,count:slice.length,status:kind==='NORMATIVE'?'HOLD_SOURCE_AND_SEMANTIC_REVIEW':'HOLD_EDITORIAL_AND_FINAL_KEY',items:slice});
 }
 return out;
}
export function prepareReviewQueues(candidates,{batchSize=100,expected=null}={}) {
 if(!Array.isArray(candidates)||!Number.isInteger(batchSize)||batchSize<1||batchSize>1000)throw Error('REVIEW_INPUT_OR_BATCH_INVALID');
 const errors=[];
 const originalDocs=group(candidates,'account_palm.normative_extractions');
 const originalUnits=group(candidates,'account_palm.normalized_units_v1');
 const doc=byId(originalDocs);
 const units=byId(originalUnits);
 if(originalDocs.length!==doc.size)errors.push({code:'DUPLICATE_OR_MISSING_EXTRACTION_ID'});
 if(originalUnits.length!==units.size)errors.push({code:'DUPLICATE_OR_MISSING_UNIT_ID'});
 const assertions=group(candidates,'account_palm.normative_assertion_candidates_v1');
 const sources=byId(group(candidates,'contabilidade_cfc.sources'));
 const questions=group(candidates,'contabilidade_cfc.questions');
 const claims=group(candidates,'account_palm.normative_claim_candidates_v1');
 const seenA=new Set(),seenUnitForAssertion=new Set(),normItems=[];
 if(expected){for(const [name,count] of Object.entries(expected)){
   const actual={extractions:doc.size,normalized_units:units.size,assertions:assertions.length,questions:questions.length}[name];
   if(actual!==undefined && actual!==count)errors.push({code:'SOURCE_COUNT_DRIFT',origin:name,expected:count,actual});
 }}
 for(const u of units.values()){
  if(!doc.has(u.draft?.instrument_id))errors.push({code:'UNIT_WITHOUT_DOCUMENT',ref:u.origin_pk});
 }
 for(const a of assertions){
  const key=id(a.origin_pk),d=a.draft||{},unit=units.get(id(d.normalized_unit_id));
  if(!key || seenA.has(key))errors.push({code:'DUPLICATE_OR_MISSING_ASSERTION',ref:key});
  seenA.add(key);
  if(!unit){errors.push({code:'ASSERTION_WITHOUT_UNIT',ref:key});continue;}
  if(seenUnitForAssertion.has(unit.origin_pk))errors.push({code:'MULTIPLE_ASSERTIONS_FOR_UNIT',ref:unit.origin_pk});
  seenUnitForAssertion.add(unit.origin_pk);
  if(d.instrument_id!==unit.draft?.instrument_id)errors.push({code:'ASSERTION_INSTRUMENT_CONFLICT',ref:key});
  if(!SHA.test(d.assertion_text_sha256||''))errors.push({code:'ASSERTION_HASH_INVALID',ref:key});
  const instrument_id=id(d.instrument_id),extraction=doc.get(instrument_id);
  if(!extraction){errors.push({code:'ASSERTION_WITHOUT_EXTRACTION',ref:key});continue;}
  normItems.push({instrument_id,unit_id:unit.origin_pk,assertion_id:key,
   locator:safe(unit.draft?.locator),assertion_sha256:d.assertion_text_sha256,
   source_original_sha256:extraction.draft?.raw_sha256||null,
   source_version_status:'PENDING_VERIFICATION',
   normative_status:'CANDIDATE_ONLY',semantic_review:'PENDING',
   editorial_explanation_review:'NOT_STARTED',publication_eligible:false});
 }
 if(assertions.length!==units.size)errors.push({code:'ASSERTION_UNIT_COVERAGE_NOT_ONE_TO_ONE',assertions:assertions.length,units:units.size});
 // Claims existentes podem ser candidatos, mas NUNCA contam como revisão realizada.
 for(const c of claims){if(!seenA.has(id(c.draft?.assertion_candidate_id)))errors.push({code:'CLAIM_WITHOUT_ASSERTION',ref:c.origin_pk});}
 const editorial=[];
 for(const q of questions){
  const source_id=id(q.draft?.source_id);
  if(!sources.has(source_id))errors.push({code:'EDITORIAL_QUESTION_WITHOUT_SOURCE',ref:q.origin_pk});
  editorial.push({source_id,question_id:q.origin_pk,question_number:q.draft?.question_number||null,
   source_kind:'EDITORIAL',key_provenance:'HOLD_OFFICIAL_FINAL_KEY',rights:'PENDING',
   editorial_review:'PENDING',publication_eligible:false});
 }
 normItems.sort((a,b)=>a.instrument_id.localeCompare(b.instrument_id)||a.unit_id.localeCompare(b.unit_id)||a.assertion_id.localeCompare(b.assertion_id));
 editorial.sort((a,b)=>a.source_id.localeCompare(b.source_id)||Number(a.question_number)-Number(b.question_number));
 // Subdividir por instrumento, evitando lotes que misturem normas.
 const normBatches=[];
 const perNorm=new Map();for(const i of normItems){if(!perNorm.has(i.instrument_id))perNorm.set(i.instrument_id,[]);perNorm.get(i.instrument_id).push(i);}
 for(const [inst,rows] of perNorm)normBatches.push(...batches(rows,{kind:'NORMATIVE',batchSize}));
 const editorialBatches=[];
 const perSource=new Map();for(const i of editorial){if(!perSource.has(i.source_id))perSource.set(i.source_id,[]);perSource.get(i.source_id).push(i);}
 for(const [source,rows] of perSource)editorialBatches.push(...batches(rows,{kind:'EDITORIAL',batchSize}));
 return {schema:'canone.normative-editorial-review-queue.v1',source_authority:'EVIDENCE_FIRST',
  metrics:{normative_documents:doc.size,normalized_units:units.size,assertion_candidates:assertions.length,
   semantic_claim_candidates:claims.length,normative_batches:normBatches.length,editorial_sources:sources.size,
   editorial_questions:questions.length,editorial_batches:editorialBatches.length,human_approved_claims:0},
  index_gate:errors.length?'FAIL':'PASS',critical_count:errors.length,findings:errors,
  normative_batches:normBatches,editorial_batches:editorialBatches,
  release_gate:'HOLD_HUMAN',auto_promotions:0};
}
const isEntry=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntry){
 const args=process.argv.slice(2),value=k=>{const n=args.indexOf(k);return n<0?null:args[n+1]};
 if(!args.includes('--execute')){console.log('DRY_RUN: --execute --input <private-candidates.ndjson> [--output <private-dir>] [--batch-size 100]');process.exit(0);}
 if(!value('--input'))throw Error('CANDIDATE_FILE_REQUIRED');
 const raw=await readFile(value('--input'),'utf8');const list=raw.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
 const size=Number(value('--batch-size')||100),r=prepareReviewQueues(list,{batchSize:size});
 const root=resolve(value('--output')||join(dirname(fileURLToPath(import.meta.url)),'../../.local-bridge/review-queue'));
 await mkdir(root,{recursive:true,mode:0o700});
 // Nunca publicar uma fila aparentemente pronta em caso de integridade inconsistente.
 if(r.index_gate!=='PASS'){
  await writeFile(join(root,'review-failed.private.json'),JSON.stringify({metrics:r.metrics,findings:r.findings},null,2)+'\n',{mode:0o600});
  console.error('REVIEW_QUEUE_BLOCKED:',r.critical_count);process.exitCode=3;
 } else {
  await writeFile(join(root,'review-queue.private.json'),JSON.stringify(r,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({...r.metrics,index_gate:r.index_gate,release_gate:'HOLD_HUMAN'}));process.exitCode=4;
 }
}
