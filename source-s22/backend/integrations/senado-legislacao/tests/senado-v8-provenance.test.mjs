import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {collectSenado,verifySenadoArchive,validateCatalog,inspectIdentityCandidate,PRIVATE_SENADO_DIR,sha256} from '../client.mjs';
const catalog=JSON.parse(readFileSync(new URL('../catalog.v1.json',import.meta.url),'utf8'));

function respondWithOriginalJson() {
  const payloads = new Map();
  return {
    payloads,
    fetchImpl:async url=>{
      const u=new URL(url);
      const n=u.searchParams.get('numero'), y=u.searchParams.get('ano');
      const body=Buffer.from(`  { "ListaLegislacao": { "Norma": [ { "NumeroNorma": "${n}", "AnoNorma": ${y} } ] } }\n`);
      payloads.set(`${n}-${y}`,body);
      return new Response(body,{headers:{'content-type':'application/json'}});
    }
  };
}

test('V8 preserva bytes reais, verifica SHA256 do original e não promove',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-v8-')); const mock=respondWithOriginalJson();
  try {
    const run=await collectSenado(catalog,{execute:true,dir,fetchImpl:mock.fetchImpl});
    assert.equal(run.publication_eligible,false);
    const archive=JSON.parse(await readFile(join(dir,'intake.private.json'),'utf8'));
    assert.equal(archive.schema,'canone.senado.readonly.intake.v2');
    assert.equal(archive.observations.length,4);
    const replay=await verifySenadoArchive(catalog,{dir});
    assert.equal(replay.count,4);
    assert.equal(replay.publication_eligible,false);
    for(const act of catalog.acts){
      const entry=archive.observations.find(x=>x.source_id===act.key);
      const orig=mock.payloads.get(`${act.number}-${act.year}`);
      const raw=await readFile(join(dir,entry.raw_artifact_path));
      assert.deepEqual(raw,orig);
      assert.equal(entry.response_sha256,sha256(orig));
      assert.equal((await stat(join(dir,entry.raw_artifact_path))).mode & 0o777,0o600);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('V8 detecta qualquer adulteração dos bytes de uma resposta arquivada',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-tamper-'));
  try {
    await collectSenado(catalog,{execute:true,dir,requestedKeys:[catalog.acts[0].key],fetchImpl:respondWithOriginalJson().fetchImpl});
    const manifest=JSON.parse(await readFile(join(dir,'intake.private.json'),'utf8'));
    const f=join(dir,manifest.observations[0].raw_artifact_path);
    const bytes=await readFile(f);bytes[2]=bytes[2]===32?33:32;await writeFile(f,bytes);
    await assert.rejects(verifySenadoArchive(catalog,{dir}),/ARCHIVE_SHA256_MISMATCH/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('V8 bloqueia path traversal e substituição do hash no manifesto',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-path-'));
  try {
    await collectSenado(catalog,{execute:true,dir,requestedKeys:[catalog.acts[0].key],fetchImpl:respondWithOriginalJson().fetchImpl});
    const f=join(dir,'intake.private.json');const old=JSON.parse(await readFile(f,'utf8'));
    const shifted=structuredClone(old);shifted.observations[0].raw_artifact_path='../not-my-file.json';
    await writeFile(f,JSON.stringify(shifted));await assert.rejects(verifySenadoArchive(catalog,{dir}),/UNSAFE_ARCHIVE_PATH/);
    const changed=structuredClone(old);changed.observations[0].response_sha256='0'.repeat(64);
    await writeFile(f,JSON.stringify(changed));await assert.rejects(verifySenadoArchive(catalog,{dir}),/UNSAFE_ARCHIVE_PATH/);
    const changedProvenance=structuredClone(old);changedProvenance.observations[0].expected_year=2020;
    await writeFile(f,JSON.stringify(changedProvenance));await assert.rejects(verifySenadoArchive(catalog,{dir}),/INVALID_ARCHIVE_CANDIDATE/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('V8 bloqueia manifests v1 sem referência reproduzível aos bytes brutos',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-old-'));
  try {
    await writeFile(join(dir,'intake.private.json'),JSON.stringify({schema:'canone.senado.readonly.intake.v1',state:'FETCHED_CANDIDATES__HOLD_HUMAN',publication_eligible:false,observations:[{}]}));
    await assert.rejects(verifySenadoArchive(catalog,{dir}),/INVALID_ARCHIVE_MANIFEST/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('V8 considera resultados com identidades múltiplas ambíguos',()=>{
  const a=inspectIdentityCandidate({items:[{numeroNorma:'6404',anoNorma:'1976'},{numeroNorma:'9999',anoNorma:'1976'}]},{number:6404,year:1976});
  assert.equal(a.status,'HOLD_AMBIGUOUS_RECORDS');
  const b=inspectIdentityCandidate({items:[{numeroNorma:'6404',anoNorma:'1976'},{numeroNorma:'6404',anoNorma:'1976'}]},{number:6404,year:1976});
  assert.equal(b.status,'HOLD_AMBIGUOUS_RECORDS');
});

test('V8 controla os dispositivos de relação somente como escopo de revisão',()=>{
  assert.equal(validateCatalog(catalog),true);
  assert.equal(catalog.device_scope_candidates.length,3);
  assert.equal(catalog.device_scope_candidates.every(x=>x.atom_verified===false&&x.status==='HOLD_SOURCE_ATOMIZATION'),true);
  assert.deepEqual(catalog.device_scope_candidates.filter(x=>x.from==='BR-FED-LEI-12249-2010').map(x=>x.source_locator),['art.76','art.77']);
  const wrong=structuredClone(catalog);wrong.device_scope_candidates[0].target_units[0]='norma.tecnica.fake';
  assert.throws(()=>validateCatalog(wrong),/INVALID_ARTICLE_SCOPE_CANDIDATE/);
  const published=structuredClone(catalog);published.device_scope_candidates[0].atom_verified=true;
  assert.throws(()=>validateCatalog(published),/INVALID_ARTICLE_SCOPE_CANDIDATE/);
});

test('Caminho privado usa backend/.local-bridge, ignorado pelo git',()=>{
  assert.match(PRIVATE_SENADO_DIR,/\/backend\/\.local-bridge\/senado\/?$/);
  assert.ok(!PRIVATE_SENADO_DIR.includes('/backend/backend/'));
});

test('A falha de rede da V8 remove os dois manifests de um lote anterior',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-stale-v8-'));
  try {
    await writeFile(join(dir,'responses.private.json'),'{"state":"OLD_SUCCESS"}');
    await writeFile(join(dir,'intake.private.json'),'{"state":"OLD_SUCCESS"}');
    await assert.rejects(collectSenado(catalog,{execute:true,dir,fetchImpl:async()=>{throw new Error('NETWORK_DENIED');}}),/NETWORK_DENIED/);
    await assert.rejects(stat(join(dir,'intake.private.json')),{code:'ENOENT'});
    await assert.rejects(stat(join(dir,'responses.private.json')),{code:'ENOENT'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
