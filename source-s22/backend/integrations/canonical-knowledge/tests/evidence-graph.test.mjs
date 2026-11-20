import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateEvidenceGraph,deriveArtifacts,digest,canonicalJSON} from '../engine.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=join(dir,'..');
const cfg=JSON.parse(readFileSync(join(root,'contract.v1.json'),'utf8'));
const baseline=JSON.parse(readFileSync(join(root,'graph.v1.json'),'utf8'));
const clone=x=>structuredClone(x);
const mkSource=(id,kind,content)=>{
  const bytes=Buffer.from(content,'utf8');
  return {id,kind,title:id,version:'v1',publisher:'Instituição de teste',uri:'https://example.org/'+id,author:kind==='EDITORIAL'?'Autor de teste':undefined,published_on:kind==='EDITORIAL'?'2026-01-01':undefined,authority:kind==='NORMATIVE'?'Autoridade de teste':undefined,effective_from:kind==='NORMATIVE'?'2026-01-01':undefined,sha256:digest(bytes),raw_bytes_base64:bytes.toString('base64'),rights_status:'CLEARED',rights_evidence_ref:'TEST-ONLY',verification_status:'VERIFIED'};
};
const mkAtom=(id,s,kind='DEFINITION')=>{const b=Buffer.from(s.raw_bytes_base64,'base64');return {id,source_id:s.id,kind,start_byte:0,end_byte:b.length,quote:b.toString('utf8'),slice_sha256:digest(b),review_status:'REVIEWED'};};
function example(){
  const norm=mkSource('NORM','NORMATIVE','Texto normativo original de teste.');
  const edit=mkSource('EDITORIAL','EDITORIAL','Nota editorial original de teste.');
  return { ...clone(baseline),source_documents:[norm,edit],atoms:[mkAtom('N1',norm),mkAtom('E1',edit,'INTERPRETATION')],claims:[
    {id:'C1',kind:'NORMATIVE',text:'Regra de teste sem pretensão oficial',atom_ids:['N1'],review_status:'REVIEWED'},
    {id:'C2',kind:'EDITORIAL',text:'Comentário de teste sem pretensão oficial',atom_ids:['E1'],review_status:'REVIEWED'},
    {id:'C3',kind:'MIXED',text:'Interpretação de teste',atom_ids:['N1','E1'],review_status:'REVIEWED'}
  ],concepts:[{id:'K1',key:'conceito-de-teste',label:'Conceito de teste',claim_ids:['C1','C2','C3'],review_status:'REVIEWED'}],relations:[{kind:'EXPLAINS',from:'C2',to:'C1',evidence_atom_ids:['E1']}],content_projections:[{id:'P1',target_table:'editorial.content_item',claim_ids:['C1','C3'],review_status:'REVIEWED',publication_state:'HOLD_HUMAN'}],field_definitions:[{target_table:'editorial.field_definition',key:'campo-de-teste',data_kind:'texto',claim_ids:['C1']}],technical_decisions:[]};
}
const errs=g=>validateEvidenceGraph(g,cfg).findings.map(f=>f.code);
test('corpus vazio não inventa norma nem editorial e bloqueia release',()=>{
  const v=validateEvidenceGraph(baseline,cfg);assert.equal(v.integrity_gate,'PASS');assert.equal(v.release_gate,'HOLD_HUMAN');assert.ok(errs(baseline).includes('CANONICAL_CORPUS_EMPTY'));
  assert.equal(deriveArtifacts(baseline,cfg)['canonical.dictionary.generated.csv'].split('\n').length,2);
});
test('aceita cadeia completa de norma + editorial preservados em bytes',()=>{
  const graph=example();const report=validateEvidenceGraph(graph,cfg);
  assert.equal(report.integrity_gate,'PASS');assert.equal(report.release_gate,'HOLD_HUMAN');assert.deepEqual(report.findings,[]);
  const outputs=deriveArtifacts(graph,cfg);
  assert.match(outputs['canonical.dictionary.generated.csv'],/conceito-de-teste/);
  assert.match(outputs['canonical.lineage.generated.mmd'],/flowchart LR/);
  assert.match(outputs['canonical.fields.generated.csv'],/campo-de-teste/);
  assert.match(outputs['canonical.vocabulary.generated.json'],/conceito-de-teste/);
  assert.doesNotMatch(outputs['canonical.graph.generated.json'],/raw_bytes_base64|quote_literal|Nota editorial original de teste/);
  assert.match(outputs['canonical.graph.generated.json'],/raw_archived/);
  assert.equal(canonicalJSON(outputs),canonicalJSON(deriveArtifacts(graph,cfg)));
});
test('proíbe afirmação normativa baseada apenas em editorial',()=>{
  const g=example();g.claims[0].atom_ids=['E1'];assert.ok(errs(g).includes('NORMATIVE_CLAIM_WITHOUT_NORMATIVE_ROOT'));
  assert.throws(()=>deriveArtifacts(g,cfg),/CANONICAL_GRAPH_INVALID/);
});
test('proíbe editorial usado para fabricar exigência normativa',()=>{
  const g=example();g.claims[1].asserts_normative_requirement=true;assert.ok(errs(g).includes('EDITORIAL_CANNOT_CREATE_NORM'));
});
test('misto exige norma e fonte editorial simultaneamente',()=>{
  const g=example();g.claims[2].atom_ids=['N1'];assert.ok(errs(g).includes('EDITORIAL_CLAIM_WITHOUT_EDITORIAL_ROOT'));
});
test('átomo deve corresponder byte a byte ao documento preservado',()=>{
  const g=example();g.atoms[0].quote='Citação parafraseada';assert.ok(errs(g).includes('ATOM_QUOTE_NOT_LITERAL'));
  const h=example();h.atoms[0].slice_sha256='0'.repeat(64);assert.ok(errs(h).includes('ATOM_SLICE_HASH_MISMATCH'));
});
test('integridade do arquivo original não pode ser simulada apenas por SHA declarado',()=>{
  const g=example();g.source_documents[0].raw_bytes_base64='YWR1bHRlcmFkbw==';assert.ok(errs(g).includes('SOURCE_HASH_MISMATCH'));
  const h=example();delete h.source_documents[0].raw_bytes_base64;assert.ok(errs(h).includes('SOURCE_BYTES_NOT_PRESERVED'));
});
test('referências órfãs entre átomos, afirmações, conceitos e projeções são barradas',()=>{
  const g=example();g.atoms[0].source_id='UNKNOWN';assert.ok(errs(g).includes('ATOM_SOURCE_ORPHAN'));
  const h=example();h.concepts[0].claim_ids=['NADA'];assert.ok(errs(h).includes('CONCEPT_CLAIM_ORPHAN'));
  const i=example();i.content_projections[0].claim_ids=['NADA'];assert.ok(errs(i).includes('PROJECTION_CLAIM_ORPHAN'));
});
test('não publica antes de comprovar revisão, direitos e evidência',()=>{
  const g=example();g.content_projections[0].publication_state='PUBLISHED';assert.ok(errs(g).includes('UNREVIEWED_PUBLICATION'));
  g.content_projections[0].approval_ref='HUMAN-QA-1';g.source_documents[0].rights_status='UNKNOWN';
  assert.ok(errs(g).includes('PUBLICATION_UNVERIFIED_EVIDENCE'));
});
test('nova versão que suplanta a antiga deve retirar conteúdo baseado na antiga',()=>{
  const g=example();g.relations.push({kind:'SUPERSEDES',from:'C3',to:'C1',evidence_atom_ids:['N1']});
  g.content_projections[0].publication_state='PUBLISHED';g.content_projections[0].approval_ref='HUMAN-QA-1';
  assert.ok(errs(g).includes('PUBLICATION_FROM_SUPERSEDED_CLAIM'));
  g.relations.push({kind:'SUPERSEDES',from:'C1',to:'C3',evidence_atom_ids:['N1']});
  assert.ok(errs(g).includes('SUPERSESSION_CYCLE'));
});
test('contradição editorial ou normativa deve ser resolvida antes de release',()=>{
  const g=example();g.relations.push({kind:'CONTRADICTS',from:'C1',to:'C2',evidence_atom_ids:['N1','E1']});
  assert.ok(errs(g).includes('CONTRADICTION_UNRESOLVED'));
});
test('dicionário e campos não existem sem linhagem de claim ou ADR técnica',()=>{
  const g=example();g.field_definitions[0].claim_ids=[];assert.ok(errs(g).includes('FIELD_WITHOUT_PROVENANCE'));
  g.field_definitions[0].technical_decision_id='ADR-X';assert.ok(errs(g).includes('FIELD_DECISION_ORPHAN'));
});
test('impede duplicação de conceito canônico e relações autocontraditórias',()=>{
  const g=example();g.concepts.push({...g.concepts[0],id:'K2'});
  assert.ok(errs(g).includes('DUPLICATE_CANONICAL_CONCEPT_KEY'));
  g.relations.push({kind:'SUPPORTS',from:'C1',to:'C1',evidence_atom_ids:['N1']});
  assert.ok(errs(g).includes('RELATION_SELF'));
});
test('sem data de revisão de vigência norma publicada é recusada',()=>{
  const g=example();g.content_projections[0].publication_state='PUBLISHED';g.content_projections[0].approval_ref='APROVACAO-TESTE';
  assert.ok(errs(g).includes('PUBLICATION_WITHOUT_VALIDITY_REVIEW_DATE'));
  assert.ok(errs(g).includes('PUBLICATION_WITHOUT_TARGET_VERSION'));
  g.content_projections[0].validity_checked_on='2026-01-02';g.source_documents[0].effective_to='2026-01-01';
  assert.ok(errs(g).includes('PUBLICATION_OUTSIDE_NORMATIVE_VALIDITY'));
});
test('gate de release recusa corpus vazio mesmo com artefatos atualizados',()=>{
  const r=spawnSync(process.execPath,[join(root,'generate.mjs'),'--check','--strict-release'],{encoding:'utf8'});
  assert.equal(r.status,5);assert.match(r.stderr,/BLOCK_CANONICAL_RELEASE/);
});
test('geração local reprodutível e nenhuma dependência de Supabase ou produção',()=>{
  const r=spawnSync(process.execPath,[join(root,'generate.mjs'),'--check'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/PASS_NO_DRIFT/);
});
test('DDL offline está isolada, relacional, sem publicação e com RLS forçado',()=>{
  const ddl=readFileSync(join(root,'ddl/001_evidence_first_staging_only.sql'),'utf8');
  assert.match(ddl,/CREATE TABLE canone_evidence\.source_document/);
  assert.match(ddl,/CREATE TABLE canone_evidence\.source_atom/);
  assert.match(ddl,/CREATE TABLE canone_evidence\.canonical_claim/);
  assert.match(ddl,/CREATE CONSTRAINT TRIGGER canonical_claim_grounding_check/);
  assert.match(ddl,/REFERENCES canone_evidence\.source_document\(id\)/);
  assert.match(ddl,/REFERENCES editorial\.content_item_version\(id\)/);
  assert.match(ddl,/FORCE ROW LEVEL SECURITY/);
  assert.match(ddl,/CHECK\(release_status = 'HOLD_HUMAN'\)/);
  assert.match(ddl,/REVOKE ALL ON ALL TABLES IN SCHEMA canone_evidence FROM PUBLIC, anon, authenticated/);
});
