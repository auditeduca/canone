import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareEvidencePair,archiveEvidencePair} from '../archive.mjs';
import {inspectReadiness,buildEvidenceQueue} from '../readiness.mjs';
import {validateEvidenceGraph} from '../../canonical-knowledge/engine.mjs';
const root=resolve(dirname(new URL(import.meta.url).pathname),'../../canonical-knowledge');
const contract=JSON.parse(await readFile(join(root,'contract.v1.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const c=(origin,id,draft={})=>({origin,origin_pk:id,draft,import_status:'HOLD_HUMAN',publication_eligible:false});
async function sandbox(fn){const d=await mkdtemp(join(tmpdir(),'canone-real-'));try{return await fn(d);}finally{await rm(d,{recursive:true,force:true});}}
function metadata(){const H='a'.repeat(64);return [
 c('account_palm.normative_extractions','NORM-01',{raw_sha256:H,text_sha256:H,mask_sha256:H,source_url:'https://example.org/norm.pdf'}),
 c('account_palm.normalized_units_v1','U-01',{instrument_id:'NORM-01',structural_status:'PASS',publication_mode:'INTERNAL_ONLY'}),
 c('account_palm.normative_assertion_candidates_v1','A-01',{normalized_unit_id:'U-01',instrument_id:'NORM-01'}),
 c('contabilidade_cfc.sources','EXAM-01',{source_url:'https://example.org/exam.pdf'}),
 c('contabilidade_cfc.questions','Q-01',{source_id:'EXAM-01',official_key_verified:false}),
 c('contabilidade_cfc.audit_normative_scope_v1','NORM-01',{publication_eligible:false}),
 c('contabilidade_cfc.audit_normative_segment_drafts_v1','F-01',{parent_unit_id:'U-01',editorial_validation_status:'PENDING'})
 ];}
function input(files){return {source_id:'CFC-NBC-EXAMPLE',source_kind:'NORMATIVE',source_uri:'https://example.org/norm.pdf',source_version:'v1',
 title:'Norma de teste',publisher:'CFC',authority:'CFC',original_format:'application/pdf',extractor:'pdftotext',extractor_version:'1.0',
 original_path:files.orig,extracted_text_path:files.text,spans:[{start_byte:0,end_byte:13,kind:'DEFINITION',locator:'p.1',expected_quote:'Definição é ok'}]};}
async function inputs(d){const orig=join(d,'orig.pdf'),text=join(d,'ext.txt');await writeFile(orig,Buffer.from('%PDF-1.7 fake synthetic fixture'));await writeFile(text,'Definição é ok. Resto da norma.');return {orig,text};}
test('report real não confunde inventário com claims canônicos',()=>{
 const report=inspectReadiness(metadata());assert.equal(report.metrics.extraction_metadata,1);
 assert.equal(report.metrics.normalized_units,1);assert.equal(report.metrics.assertion_feature_candidates,1);
 assert.equal(report.metrics.semantic_claim_candidates,0);assert.equal(report.corpus_release_status,'HOLD_HUMAN');
 assert.ok(report.blockers.some(b=>b.code==='SEMANTIC_CLAIMS_NOT_MATERIALIZED'));
 assert.equal(report.auto_promotions,0);
});
test('fila contém apenas IDs e hashes, sem conteúdo ou gabaritos',()=>{
 const q=buildEvidenceQueue(metadata());assert.equal(q.total,4);
 assert.equal(q.content_or_answers_exposed,false);assert.doesNotMatch(JSON.stringify(q),/Definição é ok|answer_key/);
});
test('corpus sem exportação é HOLD e nunca PASS de release',()=>{
 const r=inspectReadiness([]);assert.equal(r.corpus_release_status,'HOLD_HUMAN');assert.ok(r.blockers.some(x=>x.code==='NO_CANDIDATE_EXPORT'));
});
test('autopromoção nos dados da origem falha',()=>{
 const a=metadata();a[0].publication_eligible=true;const r=inspectReadiness(a);assert.equal(r.integrity_gate,'FAIL');
});
test('identidade PDF e extrato UTF8 são verificáveis com hashes distintos',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=Buffer.byteLength('Definição é ok');
 const r=await prepareEvidencePair(i);assert.match(r.report.original_sha256,/^[a-f0-9]{64}$/);
 assert.equal(r.document.sha256,hash(r.derived));assert.notEqual(r.document.sha256,r.report.original_sha256);
 assert.equal(r.atoms[0].quote,'Definição é ok');assert.equal(r.atoms[0].slice_sha256,hash(Buffer.from('Definição é ok')));
 const graph={schema_version:contract.schema_version,source_documents:[r.document],atoms:r.atoms,claims:[],concepts:[],relations:[],content_projections:[],field_definitions:[],technical_decisions:[]};
 const status=validateEvidenceGraph(graph,contract);assert.equal(status.integrity_gate,'PASS');assert.equal(status.release_gate,'HOLD_HUMAN');
}));
test('atomização recusa intervalo cortando caractere multibyte',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=7;
 await assert.rejects(prepareEvidencePair(i),/ATOM_SPLITS_UTF8/);
}));
test('atomização recusa paráfrase em vez do trecho literal',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=Buffer.byteLength('Definição é ok');i.spans[0].expected_quote='paráfrase';
 await assert.rejects(prepareEvidencePair(i),/ATOM_QUOTE_MISMATCH/);
}));
test('PDF com identidade equivocada falha em vez de aplicar OCR inventado',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);await writeFile(f.orig,'não é pdf');
 await assert.rejects(prepareEvidencePair(i),/INVALID_PDF_MAGIC/);
}));
test('não permite confundir hash de extração com o hash de origem',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.expected_original_sha256='f'.repeat(64);
 await assert.rejects(prepareEvidencePair(i),/ORIGINAL_SHA_MISMATCH/);
}));
test('origem editorial precisa de autoria comprovável na identidade',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.source_kind='EDITORIAL';delete i.author;
 await assert.rejects(prepareEvidencePair(i),/EDITORIAL_AUTHOR_REQUIRED/);
}));
test('arquivamento usa diretório protegido e mantém grafo privado, idempotente',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=Buffer.byteLength('Definição é ok');
 const a=await archiveEvidencePair(i,join(d,'archive'));const b=await archiveEvidencePair(i,join(d,'archive'));
 assert.equal(a.original_sha256,b.original_sha256);assert.equal(a.claim_count,0);
 const raw=await readFile(a.graph_path,'utf8');assert.match(raw,/raw_bytes_base64/);
 assert.equal((await readFile(a.archive_paths.original)).length,Buffer.byteLength('%PDF-1.7 fake synthetic fixture'));
}));
test('engine rejeita extração sem hash e ferramenta vinculados ao original',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=Buffer.byteLength('Definição é ok');
 const v=await prepareEvidencePair(i);delete v.document.original_source_sha256;
 const graph={schema_version:contract.schema_version,source_documents:[v.document],atoms:v.atoms,claims:[],concepts:[],relations:[],content_projections:[],field_definitions:[],technical_decisions:[]};
 assert.ok(validateEvidenceGraph(graph,contract).findings.some(x=>x.code==='EXTRACTED_TEXT_WITHOUT_ORIGINAL_LINEAGE'));
}));
test('a extração validada nunca promove claim ou conteúdo automaticamente',()=>sandbox(async d=>{
 const f=await inputs(d),i=input(f);i.spans[0].end_byte=Buffer.byteLength('Definição é ok');
 const r=await prepareEvidencePair(i);assert.equal(r.report.claim_count,0);assert.equal(r.report.rights_verified,false);
 assert.equal(r.report.semantic_reviewed,false);assert.equal(r.atoms[0].review_status,'PENDING');
}));
