import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcilePageObservations,outputs} from '../source-backed-review.mjs';

const catalog=JSON.parse(await readFile(new URL('../catalog.v1.json',import.meta.url),'utf8'));
const obs=JSON.parse(await readFile(new URL('../source-observations.v1.json',import.meta.url),'utf8'));
function edited(fn){const o=structuredClone(obs);fn(o);return o;}

test('V9 reconcilia os 26 candidatos da V8 sem substituí-los nem alterar IDs',()=>{
  const r=reconcilePageObservations(catalog,obs);
  assert.equal(r.length,28);
  assert.equal(new Set(r.map(x=>x.candidate_id)).size,28);
  const old=JSON.parse(JSON.stringify(catalog));
  assert.equal(old.device_scope_candidates.reduce((n,s)=>n+s.target_units.length,0),26);
  assert.equal(r.filter(x=>x.source_id==='BR-FED-LEI-11638-2007').length,18);
  assert.equal(r.filter(x=>x.source_id==='BR-FED-LEI-12249-2010').length,8);
  assert.equal(r.filter(x=>x.source_id==='BR-FED-LEI-14039-2020').length,2);
});
test('V9 cria duas novas pendências por acréscimos de 2020 sem afirmar texto vigente',()=>{
  const r=reconcilePageObservations(catalog,obs).filter(x=>x.source_id==='BR-FED-LEI-14039-2020');
  assert.deepEqual(r.map(x=>x.target_unit),['art.25.par1','art.25.par2']);
  assert.ok(r.every(x=>x.status==='HOLD_NEW_ACT_ENROLLMENT_AND_TEMPORAL_REVIEW'));
  assert.ok(r.every(x=>!x.atom_verified&&!x.source_bytes_verified&&!x.publication_eligible));
});
test('V9 prioriza os dispositivos do exame sem promover interpretação editorial',()=>{
  const r=reconcilePageObservations(catalog,obs);
  assert.deepEqual(r.filter(x=>x.review_priority==='P0').map(x=>x.target_unit),['art.12','art.6']);
  assert.ok(r.every(x=>x.editorial_review==='HOLD_HUMAN'&&x.legal_review==='HOLD_HUMAN'&&x.source_temporal_validity==='UNVERIFIED'));
});
test('V9 preserva a distinção ADDS para art.77 e AMENDS para art.76',()=>{
  const r=reconcilePageObservations(catalog,obs);
  assert.equal(r.find(x=>x.source_locator==='art.77').relation_kind,'ADDS');
  assert.ok(r.filter(x=>x.source_locator==='art.76').every(x=>x.relation_kind==='AMENDS'));
});
test('Não é possível alterar silenciosamente o universo de 26 candidatos anteriores',()=>{
  const bad=edited(o=>{o.observations[0].target_units.pop()});
  assert.throws(()=>reconcilePageObservations(catalog,bad),/V8_SCOPE_EVIDENCE_DRIFT/);
});
test('Aprovação indevida é bloqueada pelo gerador e por sua validação',()=>{
  for (const field of ['atom_verified','source_bytes_verified','publication_eligible']){
    const bad=edited(o=>{o.observations[1][field]=true});
    assert.throws(()=>reconcilePageObservations(catalog,bad),/UNVERIFIED_PAGE_METADATA/);
  }
});
test('Mudança arbitrária do endereço oficial ou da procedência bloqueia a emissão',()=>{
  const malicious=edited(o=>{o.observations[0].source_url='https://evil.example.com/redirect'});
  assert.throws(()=>reconcilePageObservations(catalog,malicious),/UNVERIFIED_PAGE_METADATA/);
  const shifted=edited(o=>{o.observations[1].source_url='https://legis.senado.leg.br/norma/548280'});
  assert.throws(()=>reconcilePageObservations(catalog,shifted),/V8_SCOPE_EVIDENCE_DRIFT/);
});
test('Lei 14.039/2020 não pode ganhar artigos inferidos ou origem diferente',()=>{
  const wrongArticle=edited(o=>{o.observations[3].target_units.push('art.12')});
  assert.throws(()=>reconcilePageObservations(catalog,wrongArticle),/UNVERIFIED_POSTERIOR_CHANGE/);
  const wrongSource=edited(o=>{o.observations[3].source_id='BR-FED-LEI-99999-2020'});
  assert.throws(()=>reconcilePageObservations(catalog,wrongSource),/V8_SCOPE_EVIDENCE_DRIFT/);
});
test('Rejeita duplicação de grupos e edição de observações preexistentes',()=>{
  const bad=edited(o=>{o.observations[1].group_id=o.observations[0].group_id});
  assert.throws(()=>reconcilePageObservations(catalog,bad),/DUPLICATE_OR_INVALID_OBSERVATION_GROUP/);
  const changed=edited(o=>{o.observations[2].relationship_type='AMENDS'});
  assert.throws(()=>reconcilePageObservations(catalog,changed),/V8_SCOPE_EVIDENCE_DRIFT/);
});
test('CSV e manifesto V9 são determinísticos, versionados e permanecem em HOLD',async()=>{
  const a=outputs(catalog,obs),b=outputs(catalog,obs);
  assert.equal(a.csv,b.csv);assert.equal(a.report,b.report);
  assert.equal(a.csv,await readFile(new URL('../generated/source-backed-review.csv',import.meta.url),'utf8'));
  assert.equal(a.report,await readFile(new URL('../generated/source-backed-report.json',import.meta.url),'utf8'));
  const s=JSON.parse(a.report);
  assert.equal(s.canonical_claims,0);assert.equal(s.backed_by_preserved_source_bytes,0);
  assert.equal(s.v8_reconciled,26);assert.equal(s.posterior_change_candidates,2);
  assert.equal(s.publication_eligible,false);
});
