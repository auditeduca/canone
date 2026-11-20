#!/usr/bin/env node
// Valida integridade entre CANDIDATOS do mesmo snapshot, sem consultar dados pessoais e sem publicar.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const checks=[
  {from:'contabilidade_cfc.questions',field:'source_id',to:'contabilidade_cfc.sources',key:'source_id',mandatory:true},
  {from:'contabilidade_cfc.audit_normative_scope_v1',field:'instrument_id',to:'public.regulatory_instruments',key:'instrument_id',mandatory:true},
  {from:'contabilidade_cfc.audit_normative_segment_drafts_v1',field:'parent_unit_id',to:'account_palm.normalized_units_v1',key:'normalized_unit_id',mandatory:true},
  {from:'account_palm.normalized_units_v1',field:'instrument_id',to:'public.regulatory_instruments',key:'instrument_id',mandatory:true},
  {from:'account_palm.normative_extractions',field:'instrument_id',to:'public.regulatory_instruments',key:'instrument_id',mandatory:true},
  {from:'account_palm.normative_assertion_candidates_v1',field:'normalized_unit_id',to:'account_palm.normalized_units_v1',key:'normalized_unit_id',mandatory:true},
  {from:'account_palm.normative_claim_candidates_v1',field:'assertion_candidate_id',to:'account_palm.normative_assertion_candidates_v1',key:'assertion_candidate_id',mandatory:true},
];
const scalar=v => v===null||v===undefined?'':String(v);
export function inspectGraph(candidates,{requireAllTables=true}={}) {
  const index=new Map(), findings=[];
  const bySource=new Map();
  for(const c of candidates) {
    if(!c.origin||!c.origin_pk) {findings.push({severity:'P0',code:'ORIGIN_MISSING'});continue;}
    const key=`${c.origin}:${c.origin_pk}`;
    if(index.has(key)){findings.push({severity:'P0',code:'DUPLICATE_ORIGIN',ref:key});continue;}
    index.set(key,c);
    if(!bySource.has(c.origin))bySource.set(c.origin,[]);
    bySource.get(c.origin).push(c);
    if(c.import_status!=='HOLD_HUMAN'||c.publication_eligible!==false){
      findings.push({severity:'P0',code:'AUTO_PROMOTION_ATTEMPT',ref:key});
    }
    if(c.origin==='contabilidade_cfc.questions' && (c.draft?.official_key_verified!==false || Object.hasOwn(c.draft||{},'answer_key'))){
      findings.push({severity:'P0',code:'EARLY_KEY_DISCLOSURE',ref:key});
    }
  }
  for(const edge of checks) {
    const children=bySource.get(edge.from)||[];
    const parents=bySource.get(edge.to)||[];
    if(requireAllTables && children.length && !bySource.has(edge.to)) {
      findings.push({severity:'P0',code:'REFERENCE_TABLE_NOT_EXPORTED',ref:`${edge.from} -> ${edge.to}`});
      continue;
    }
    const found=new Set(parents.map(c=>c.origin_pk));
    for(const child of children) {
      const v=child.draft?.[edge.field];
      if(edge.mandatory && !scalar(v).trim()){
        findings.push({severity:'P0',code:'FK_VALUE_MISSING',ref:`${child.origin}:${child.origin_pk}`,field:edge.field});
      } else if(scalar(v).trim() && !found.has(scalar(v))){
        findings.push({severity:'P0',code:'ORPHAN_REFERENCE',ref:`${child.origin}:${child.origin_pk}`,field:edge.field,target:`${edge.to}:${v}`});
      }
    }
  }
  // Integridade TRANSVERSAL: referência existente não é suficiente se instrumento/hash divergem.
  const units=new Map((bySource.get('account_palm.normalized_units_v1')||[]).map(c=>[c.origin_pk,c]));
  const extractions=new Map((bySource.get('account_palm.normative_extractions')||[]).map(c=>[c.origin_pk,c]));
  for(const candidate of bySource.get('account_palm.normative_assertion_candidates_v1')||[]){
    const claim=candidate.draft||{},unit=units.get(String(claim.normalized_unit_id));
    if(unit&&scalar(claim.instrument_id).trim() && scalar(unit.draft?.instrument_id).trim() && String(claim.instrument_id)!==String(unit.draft.instrument_id))
      findings.push({severity:'P0',code:'ASSERTION_INSTRUMENT_MISMATCH',ref:candidate.origin_pk,unit_id:claim.normalized_unit_id});
    if(claim.assertion_text_sha256 && !/^[a-f0-9]{64}$/.test(claim.assertion_text_sha256))
      findings.push({severity:'P0',code:'ASSERTION_DIGEST_INVALID',ref:candidate.origin_pk});
  }
  for(const unit of units.values()){
    const source=extractions.get(String(unit.draft?.instrument_id));
    if(source && unit.draft?.raw_sha256 && source.draft?.raw_sha256 && unit.draft.raw_sha256!==source.draft.raw_sha256)
      findings.push({severity:'P0',code:'EXTRACTION_RAW_HASH_MISMATCH',ref:unit.origin_pk,instrument_id:unit.draft?.instrument_id});
  }
  for(const extraction of extractions.values()) {
    if(extraction.draft?.raw_sha256 && !/^[a-f0-9]{64}$/.test(extraction.draft.raw_sha256))
      findings.push({severity:'P0',code:'ORIGINAL_DIGEST_INVALID',ref:extraction.origin_pk});
    if(extraction.draft?.text_sha256 && !/^[a-f0-9]{64}$/.test(extraction.draft.text_sha256))
      findings.push({severity:'P0',code:'EXTRACTED_TEXT_DIGEST_INVALID',ref:extraction.origin_pk});
  }
  const palm=new Map((bySource.get('account_palm.regulatory_instruments')||[]).map(c=>[c.origin_pk,c]));
  const pub=new Map((bySource.get('public.regulatory_instruments')||[]).map(c=>[c.origin_pk,c]));
  const publicOnly=[...pub.keys()].filter(k=>!palm.has(k));
  const palmOnly=[...palm.keys()].filter(k=>!pub.has(k));
  for(const k of publicOnly)findings.push({severity:'P1',code:'PUBLIC_ONLY_INSTRUMENT',ref:k});
  for(const k of palmOnly)findings.push({severity:'P1',code:'MASTER_ONLY_INSTRUMENT',ref:k});
  for(const k of palm.keys())if(pub.has(k)){
    const p=palm.get(k).draft||{},q=pub.get(k).draft||{};
    for(const field of ['title','canonical_status']){
      if(p[field]!==undefined&&q[field]!==undefined && scalar(p[field]).trim()!==scalar(q[field]).trim())findings.push({severity:'P1',code:'NORMATIVE_FIELD_CONFLICT',ref:k,field});
    }
  }
  for(const c of bySource.get('contabilidade_cfc.questions')||[])if(c.draft?.official_key_verified!==true){
    findings.push({severity:'P1',code:'OFFICIAL_ANSWER_NOT_VERIFIED',ref:c.origin_pk});
  }
  for(const c of bySource.get('contabilidade_cfc.audit_normative_scope_v1')||[])if(c.draft?.publication_eligible!==true){
    findings.push({severity:'P1',code:'NORMATIVE_NOT_PUBLISHABLE',ref:c.origin_pk});
  }
  const critical=findings.filter(f=>f.severity==='P0');
  return {entity_count:index.size,checked_edges:checks.length,critical_count:critical.length,review_count:findings.length-critical.length,
    integrity_gate:critical.length?'FAIL':'PASS',release_gate:'HOLD_HUMAN',promotions:0,findings};
}

const entry=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(entry){
  const args=process.argv.slice(2);
  const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined};
  if(!args.includes('--execute')){console.log(JSON.stringify({status:'DRY_RUN',input:'--input path/candidates.ndjson',writes_to_database:0}));process.exit(0);}
  const input=value('--input');
  if(!input)throw Error('--input é obrigatório');
  const contents=await readFile(input,'utf8');
  const rows=contents.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
  const result=inspectGraph(rows);
  if(value('--report'))await writeFile(value('--report'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({entity_count:result.entity_count,integrity_gate:result.integrity_gate,release_gate:result.release_gate,critical:result.critical_count,review:result.review_count}));
  if(result.integrity_gate==='FAIL')process.exitCode=3;
  else if(args.includes('--strict-release'))process.exitCode=4;
}
