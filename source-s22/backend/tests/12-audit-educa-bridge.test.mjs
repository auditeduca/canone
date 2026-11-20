import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeKey, mapCandidate, mapRows, sha256} from '../integrations/audit-educa/map-candidates.mjs';
import {reconcileRegulatory} from '../integrations/audit-educa/reconcile-regulatory.mjs';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../integrations/audit-educa');
const contract=JSON.parse(await readFile(path.join(dir,'contract.v1.json'),'utf8'));
const find=source=>contract.tables.find(t=>t.source===source);

test('allowlist só contém fontes CFC e master data contábil, nunca Enfermagem',()=>{
  assert.equal(contract.tables.length,13);
  assert.ok(contract.tables.every(t=>t.source.startsWith('contabilidade_cfc.') || t.source.startsWith('account_palm.') || t.source==='public.regulatory_instruments'));
  assert.equal(contract.no_auto_promotion,true);
  assert.equal(contract.no_remote_mutation,true);
});

test('chaves estáveis garantem idempotência por tabela e chave origem',()=>{
  assert.equal(makeKey('contabilidade_cfc.questions','Q01'),makeKey('contabilidade_cfc.questions','Q01'));
  assert.notEqual(makeKey('contabilidade_cfc.questions','Q01'),makeKey('contabilidade_cfc.sources','Q01'));
  assert.match(makeKey('contabilidade_cfc.questions','Q01'),/^[a-f0-9]{64}$/);
});

test('questão com 4 alternativas entra em HOLD sem gabarito publicável',()=>{
  const row={question_id:'CFC-Q01',source_id:'SRC-1',question_number:1,statement:'Exemplo sintético',
    options:{A:'Um',B:'Dois',C:'Três',D:'Quatro'}, answer_key:'B',answer_status:'PENDING_OFFICIAL_KEY',
    extraction_status:'PARSED_PENDING_EDITORIAL_QA'};
  const c=mapCandidate(find('contabilidade_cfc.questions'),row);
  assert.equal(c.import_status,'HOLD_HUMAN');
  assert.equal(c.publication_eligible,false);
  assert.equal(c.draft.official_key_verified,false);
  assert.equal(c.draft.answer_key,undefined);
  assert.equal(c.draft.options.B,'Dois');
  assert.equal(c.origin_pk,'CFC-Q01');
  assert.match(c.provenance.record_sha256,/^[a-f0-9]{64}$/);
});

test('alternativa faltante é recusada sem inventar resposta',()=>{
  const c=mapCandidate(find('contabilidade_cfc.questions'),{question_id:'Q2',options:{A:'x',B:'y',C:'z'}});
  assert.equal(c.gate,'INVALID_OPTIONS');
  assert.equal(c.publication_eligible,false);
  assert.equal(c.draft.statement,undefined);
});

test('master data não é autopromovido mesmo que fonte diga verdadeiro',()=>{
  const c=mapCandidate(find('account_palm.master_register'),{register_id:'R1',object_id:'N-1',
    canonical_promotion:true, canonical_status:'CONTROLLED_ACTIVE_CORPUS'});
  assert.equal(c.draft.source_canonical_promotion,true);
  assert.equal(c.publication_eligible,false);
  assert.equal(c.import_status,'HOLD_HUMAN');
});

test('identidade vazia e duplicidade abortam lote',()=>{
  assert.throws(()=>mapRows(find('contabilidade_cfc.sources'),[{title:'sem chave'}]),/IDENTITY_MISSING/);
  assert.throws(()=>mapRows(find('contabilidade_cfc.sources'),[{source_id:'A'},{source_id:'A'}]),/DUPLICATE_ID/);
});

test('conciliação master x catálogo público detecta exclusivos e conflitos sem promover',()=>{
  const result=reconcileRegulatory([{instrument_id:'A',canonical_status:'ACTIVE',title:'Alpha'},
    {instrument_id:'B',canonical_status:'CANDIDATE',title:'Beta'}],
    [{instrument_id:'A',canonical_status:'ACTIVE',title:'Alpha'},
    {instrument_id:'B',canonical_status:'REVOKED',title:'Beta'},{instrument_id:'C',canonical_status:'CANDIDATE',title:'Gamma'}]);
  assert.equal(result.common,2);
  assert.equal(result.public_only,1);
  assert.equal(result.conflicts,1);
  assert.equal(result.auto_promoted,0);
});

test('exportador não conecta sem --execute; transforma snapshot sintético conferido',async()=>{
  const no=spawnSync('node',[path.join(dir,'export-readonly.mjs')],{encoding:'utf8',env:{...process.env,CANONE_SOURCE_DATABASE_URL:''}});
  assert.equal(no.status,0); assert.match(no.stdout,/DRY_RUN/);
  const root=await mkdtemp(path.join(tmpdir(),'canone-bridge-'));
  try {
    const from=path.join(root,'export'),to=path.join(root,'candidate');
    await mkdir(from);
    const manifest={contract:contract.contract_id,source_project_ref:contract.source_project_ref,tables:[]};
    for(const t of contract.tables) {
      let rows=[];
      if(t.type==='QUESTION') rows=[{question_id:'Q-1',source_id:'SRC-1',question_number:1,statement:'Enunciado de teste',options:{A:'a',B:'b',C:'c',D:'d'},answer_status:'PENDING_OFFICIAL_KEY'}];
      if(t.type==='MASTER_REGISTER') rows=[{register_id:'R-1',canonical_promotion:false,canonical_status:'CONTROLLED_CANDIDATE'}];
      if(t.type==='SOURCE') rows=[{source_id:'SRC-1',title:'Fonte de teste'}];
      const data=rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':'');
      const file=t.source.replaceAll('.','__')+'.ndjson';
      await writeFile(path.join(from,file),data);
      manifest.tables.push({source:t.source,file,rows:rows.length,sha256:sha256(data)});
    }
    await writeFile(path.join(from,'manifest.json'),JSON.stringify(manifest));
    const env={...process.env,CANONE_BRIDGE_EXPORT_DIR:from,CANONE_BRIDGE_CANDIDATE_DIR:to};
    const actual=spawnSync('node',[path.join(dir,'intake-candidates.mjs'),'--execute'],{env,encoding:'utf8'});
    assert.equal(actual.status,0,actual.stderr);
    const result=JSON.parse(await readFile(path.join(to,'intake-report.json'),'utf8'));
    assert.equal(result.candidate_count,3);
    assert.equal(result.promotions,0);
    assert.equal(result.remote_writes,0);
    assert.equal(result.semantic_readiness.corpus_release_status,'HOLD_HUMAN');
    assert.equal(result.semantic_readiness.metrics.exam_questions,1);
    assert.equal(result.semantic_readiness.metrics.semantic_claim_candidates,0);
    assert.equal(JSON.parse(await readFile(path.join(to,'evidence-queue.json'),'utf8')).content_or_answers_exposed,false);
    const candidates=(await readFile(path.join(to,'candidates.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(candidates.every(c=>c.import_status==='HOLD_HUMAN'&&c.publication_eligible===false));
    // Uma mudança de bytes invalida SHA, sem persistir candidatos novos.
    await writeFile(path.join(from,'contabilidade_cfc__questions.ndjson'),'{}\n');
    const tampered=spawnSync('node',[path.join(dir,'intake-candidates.mjs'),'--execute'],{env,encoding:'utf8'});
    assert.notEqual(tampered.status,0);
    assert.match(tampered.stderr,/SOURCE_HASH_MISMATCH/);
    await assert.rejects(readFile(path.join(to,'candidates.ndjson'))); // impede reaproveitar lote antigo após falha
  } finally {await rm(root,{recursive:true,force:true});}
});

test('intake inteiro barra relação órfã mesmo com SHA/contagens corretos',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'canone-orphan-'));
  try{
    const from=path.join(root,'export'),to=path.join(root,'candidate');
    await mkdir(from);const manifest={contract:contract.contract_id,source_project_ref:contract.source_project_ref,tables:[]};
    for(const entry of contract.tables){
      let rows=[];
      if(entry.source==='contabilidade_cfc.questions')rows=[{question_id:'Q-ORPHAN',source_id:'SOURCE-NOT-EXPORTED',question_number:1,statement:'Teste',options:{A:'a',B:'b',C:'c',D:'d'},answer_status:'PENDING_OFFICIAL_KEY'}];
      const raw=rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':'');
      const file=entry.source.replaceAll('.','__')+'.ndjson';
      await writeFile(path.join(from,file),raw);manifest.tables.push({source:entry.source,file,rows:rows.length,sha256:sha256(raw)});
    }
    await writeFile(path.join(from,'manifest.json'),JSON.stringify(manifest));
    const cmd=spawnSync('node',[path.join(dir,'intake-candidates.mjs'),'--execute'],{encoding:'utf8',env:{...process.env,CANONE_BRIDGE_EXPORT_DIR:from,CANONE_BRIDGE_CANDIDATE_DIR:to}});
    assert.equal(cmd.status,3,cmd.stderr);
    assert.match(cmd.stderr,/CROSS_TABLE_INTEGRITY_FAIL/);
    const report=JSON.parse(await readFile(path.join(to,'graph-findings.json'),'utf8'));
    assert.equal(report.integrity_gate,'FAIL');
    assert.ok(report.findings.some(x=>x.code==='REFERENCE_TABLE_NOT_EXPORTED'||x.code==='ORPHAN_REFERENCE'));
    await assert.rejects(readFile(path.join(to,'candidates.ndjson')));
  } finally{await rm(root,{recursive:true,force:true});}
});
