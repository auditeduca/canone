import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGraph} from '../graph-gate.mjs';
const entity=(origin,origin_pk,draft={})=>({origin,origin_pk,draft,import_status:'HOLD_HUMAN',publication_eligible:false});
const good=()=>[
  entity('contabilidade_cfc.sources','S1'),
  entity('contabilidade_cfc.questions','Q1',{source_id:'S1',official_key_verified:false}),
  entity('public.regulatory_instruments','N1',{title:'Norma A',canonical_status:'DRAFT'}),
  entity('account_palm.regulatory_instruments','N1',{title:'Norma A',canonical_status:'DRAFT'}),
  entity('account_palm.normalized_units_v1','U1',{instrument_id:'N1'}),
  entity('contabilidade_cfc.audit_normative_scope_v1','N1',{instrument_id:'N1',publication_eligible:false}),
  entity('contabilidade_cfc.audit_normative_segment_drafts_v1','FR1',{parent_unit_id:'U1'}),
];
test('grafo íntegro sem promoção e release em HOLD',()=>{
  const r=inspectGraph(good());assert.equal(r.integrity_gate,'PASS');assert.equal(r.release_gate,'HOLD_HUMAN');assert.equal(r.critical_count,0);assert.equal(r.promotions,0);
});
test('questão órfã bloqueada quando fonte não existe',()=>{
  const a=good();a[1].draft.source_id='S2';const r=inspectGraph(a);assert.equal(r.integrity_gate,'FAIL');assert.ok(r.findings.some(x=>x.code==='ORPHAN_REFERENCE'&&x.field==='source_id'));
});
test('tabela parental omitida causa recusa explícita',()=>{
  const a=good().filter(x=>x.origin!=='contabilidade_cfc.sources');const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='REFERENCE_TABLE_NOT_EXPORTED'));
});
test('fragmento órfão e unidade com norma inexistente são bloqueados',()=>{
  const a=good();a[4].draft.instrument_id='N99';a[6].draft.parent_unit_id='U99';const r=inspectGraph(a);assert.equal(r.critical_count,2);
});
test('tentativa de autopromoção ou vazamento de gabarito é recusada',()=>{
  const a=good();a[1].publication_eligible=true;a[1].draft.answer_key='A';const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='AUTO_PROMOTION_ATTEMPT'));assert.ok(r.findings.some(x=>x.code==='EARLY_KEY_DISCLOSURE'));
});
test('conflito entre master data e catálogo público vira revisão explícita',()=>{
  const a=good();a[3].draft.canonical_status='REVOKED';const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='NORMATIVE_FIELD_CONFLICT'));assert.equal(r.release_gate,'HOLD_HUMAN');
});
test('duplicidade física bloqueia importação',()=>{
  const a=good();a.push({...a[0]});const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='DUPLICATE_ORIGIN'));assert.equal(r.integrity_gate,'FAIL');
});

test('instrumento entre afirmação e unidade divergente é rejeitado',()=>{
  const a=good();a.push(entity('account_palm.normative_extractions','N1',{instrument_id:'N1',raw_sha256:'a'.repeat(64),text_sha256:'b'.repeat(64)}));
  a.push(entity('account_palm.normative_assertion_candidates_v1','A1',{normalized_unit_id:'U1',instrument_id:'N9',assertion_text_sha256:'f'.repeat(64)}));
  const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='ASSERTION_INSTRUMENT_MISMATCH'));
});
test('discrepância de hash entre unidade e extração bloqueia lote',()=>{
  const a=good();a[4].draft.raw_sha256='a'.repeat(64);
  a.push(entity('account_palm.normative_extractions','N1',{instrument_id:'N1',raw_sha256:'b'.repeat(64),text_sha256:'c'.repeat(64)}));
  const r=inspectGraph(a);assert.ok(r.findings.some(x=>x.code==='EXTRACTION_RAW_HASH_MISMATCH'));assert.equal(r.integrity_gate,'FAIL');
});
test('assertiva com SHA inválido é bloqueada antes do dicionário',()=>{
  const a=good();a.push(entity('account_palm.normative_assertion_candidates_v1','A1',{normalized_unit_id:'U1',instrument_id:'N1',assertion_text_sha256:'notsha'}));
  assert.ok(inspectGraph(a).findings.some(x=>x.code==='ASSERTION_DIGEST_INVALID'));
});
test('referência de assertion para unidade inexistente é rejeitada',()=>{
  const a=good();a.push(entity('account_palm.normative_assertion_candidates_v1','A1',{normalized_unit_id:'U404',instrument_id:'N1'}));
  assert.ok(inspectGraph(a).findings.some(x=>x.code==='ORPHAN_REFERENCE'&&x.field==='normalized_unit_id'));
});
