import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReviewQueues} from '../review-batches.mjs';
const H='f'.repeat(64),row=(origin,pk,draft={})=>({origin,origin_pk:pk,draft,import_status:'HOLD_HUMAN',publication_eligible:false});
const sample=()=>[
 row('account_palm.normative_extractions','CFC-NBC-1',{raw_sha256:H}),
 row('account_palm.normalized_units_v1','U1',{instrument_id:'CFC-NBC-1',locator:'p.1'}),
 row('account_palm.normalized_units_v1','U2',{instrument_id:'CFC-NBC-1',locator:'p.2'}),
 row('account_palm.normative_assertion_candidates_v1','A1',{instrument_id:'CFC-NBC-1',normalized_unit_id:'U1',assertion_text_sha256:H}),
 row('account_palm.normative_assertion_candidates_v1','A2',{instrument_id:'CFC-NBC-1',normalized_unit_id:'U2',assertion_text_sha256:H}),
 row('contabilidade_cfc.sources','S1'),
 row('contabilidade_cfc.questions','Q1',{source_id:'S1',question_number:1,statement:'material editorial privado',answer_key:'A'}),
];
test('gera lotes normativos e editoriais separados e em HOLD',()=>{
 const r=prepareReviewQueues(sample(),{batchSize:1,expected:{extractions:1,normalized_units:2,assertions:2,questions:1}});
 assert.equal(r.index_gate,'PASS');assert.equal(r.metrics.normative_batches,2);assert.equal(r.metrics.editorial_batches,1);
 assert.equal(r.auto_promotions,0);assert.equal(r.release_gate,'HOLD_HUMAN');
 assert.doesNotMatch(JSON.stringify(r),/material editorial privado|"answer_key"/);
});
test('lotes determinísticos independem de ordem da exportação',()=>{
 const a=sample();const r1=prepareReviewQueues(a,{batchSize:1});const r2=prepareReviewQueues([...a].reverse(),{batchSize:1});
 assert.deepEqual(r1.normative_batches,r2.normative_batches);assert.deepEqual(r1.editorial_batches,r2.editorial_batches);
});
test('não mistura fontes normativas em um lote',()=>{
 const a=sample();a.push(row('account_palm.normative_extractions','CFC-NBC-2',{raw_sha256:H}));
 a.push(row('account_palm.normalized_units_v1','U3',{instrument_id:'CFC-NBC-2'}));
 a.push(row('account_palm.normative_assertion_candidates_v1','A3',{instrument_id:'CFC-NBC-2',normalized_unit_id:'U3',assertion_text_sha256:H}));
 const q=prepareReviewQueues(a,{batchSize:5});assert.equal(q.normative_batches.length,2);
 assert.equal(q.normative_batches[0].items.length,2);assert.equal(q.normative_batches[1].items.length,1);
});
test('bloqueia afirmação sem unidade',()=>{
 const s=sample();s.find(x=>x.origin_pk==='A2').draft.normalized_unit_id='NOPE';
 assert.ok(prepareReviewQueues(s).findings.some(x=>x.code==='ASSERTION_WITHOUT_UNIT'));
});
test('bloqueia instrumento divergente',()=>{
 const s=sample();s.find(x=>x.origin_pk==='A2').draft.instrument_id='CFC-NBC-2';
 assert.ok(prepareReviewQueues(s).findings.some(x=>x.code==='ASSERTION_INSTRUMENT_CONFLICT'));
});
test('bloqueia hash inválido e evita publicação de candidatos',()=>{
 const s=sample();s.find(x=>x.origin_pk==='A1').draft.assertion_text_sha256='BAD';
 const r=prepareReviewQueues(s);assert.equal(r.index_gate,'FAIL');assert.equal(r.auto_promotions,0);
});
test('bloqueia origem editorial inexistente',()=>{
 const s=sample();s.find(x=>x.origin_pk==='Q1').draft.source_id='NOPE';
 assert.ok(prepareReviewQueues(s).findings.some(x=>x.code==='EDITORIAL_QUESTION_WITHOUT_SOURCE'));
});
test('drift de universo vira FINDING, nunca ajusta a baseline silenciosamente',()=>{
 const r=prepareReviewQueues(sample(),{expected:{extractions:249}});assert.equal(r.index_gate,'FAIL');
 assert.ok(r.findings.some(x=>x.code==='SOURCE_COUNT_DRIFT'));
});

test('bloqueia duas afirmações para mesma unidade ainda que contagens batam',()=>{
 const s=sample();s.find(x=>x.origin_pk==='A2').draft.normalized_unit_id='U1';
 assert.ok(prepareReviewQueues(s).findings.some(x=>x.code==='MULTIPLE_ASSERTIONS_FOR_UNIT'));
});
test('bloqueia duas unidades com mesmo identificador',()=>{
 const s=sample();s.push(structuredClone(s.find(x=>x.origin_pk==='U1')));
 assert.ok(prepareReviewQueues(s).findings.some(x=>x.code==='DUPLICATE_OR_MISSING_UNIT_ID'));
});
