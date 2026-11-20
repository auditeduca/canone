import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile as readFileAgain} from 'node:fs/promises';
import {collectSenado,buildSenadoListUrl,inspectIdentityCandidate,requestSenadoJson,validateCatalog} from '../client.mjs';
const catalog=JSON.parse(await readFileAgain(new URL('../catalog.v1.json',import.meta.url),'utf8'));
const mocked = ({status=200,type='application/json',data={},customResponse}={})=>async(url,opts)=>{
  if(customResponse)return customResponse(url,opts);
  return new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers:{'content-type':type}});
};

test('Catálogo conhecido exige quatro fontes e exatamente duas relações explícitas',()=>{
  assert.equal(validateCatalog(catalog),true);
  assert.equal(catalog.acts.length,4);
  assert.equal(catalog.relationship_candidates.length,2);
  assert.equal(catalog.acts.every(x=>x.canonical_promotion===false),true);
});
test('Não aceita relação com entidade inexistente',()=>{
  const x=structuredClone(catalog);x.relationship_candidates[0].to='BR-FED-LEI-0000-1900';
  assert.throws(()=>validateCatalog(x),/ORPHAN_RELATION/);
});
test('Não aceita promoção automática',()=>{
  const x=structuredClone(catalog);x.acts[0].canonical_promotion=true;
  assert.throws(()=>validateCatalog(x),/INVALID_ACT/);
});
test('Constrói endpoint restrito com parâmetros número+ano',()=>{
  assert.equal(buildSenadoListUrl({number:6404,year:1976}),'https://legis.senado.leg.br/dadosabertos/legislacao/lista.json?numero=6404&ano=1976');
  assert.throws(()=>buildSenadoListUrl({number:'6404',year:1976}),/INVALID_NORMA_IDENTITY/);
});
test('Bloqueia endpoints de terceiros e caminhos fora da API',async()=>{
  for(const url of ['https://example.com/legislacao/lista.json','http://legis.senado.leg.br/dadosabertos/legislacao/lista.json','https://legis.senado.leg.br/admin'])
    await assert.rejects(requestSenadoJson(url,{fetchImpl:mocked()}),/BLOCK_UNTRUSTED_ENDPOINT/);
});
test('HTTP 404 e HTML não podem virar fonte canônica',async()=>{
  await assert.rejects(requestSenadoJson(buildSenadoListUrl({number:6404,year:1976}),{fetchImpl:mocked({status:404})}),/SENADO_HTTP_404/);
  await assert.rejects(requestSenadoJson(buildSenadoListUrl({number:6404,year:1976}),{fetchImpl:mocked({type:'text/html',data:'<html>Forbidden</html>'})}),/SENADO_NON_JSON_RESPONSE/);
});
test('JSON inválido e payload desmedido falham',async()=>{
  const url=buildSenadoListUrl({number:6404,year:1976});
  await assert.rejects(requestSenadoJson(url,{fetchImpl:mocked({data:'not json'})}),/SENADO_INVALID_JSON/);
  await assert.rejects(requestSenadoJson(url,{fetchImpl:mocked({data:{text:'x'.repeat(2_000_100)}})}),/SENADO_PAYLOAD_TOO_LARGE/);
});
test('Detecção semântica de identidade não equivale a aprovação',()=>{
  const matched=inspectIdentityCandidate({ListaLegislacao:{Norma:[{NumeroNorma:'6.404',AnoNorma:1976}]}},{number:6404,year:1976});
  assert.equal(matched.status,'API_IDENTITY_CANDIDATE__HOLD_HUMAN');
  assert.equal(matched.matched_field_pairs,1);
  const unknown=inspectIdentityCandidate({Lista:[]},{number:6404,year:1976});
  assert.equal(unknown.status,'HOLD_SCHEMA_OR_IDENTITY');
});
test('Modo padrão não usa rede nem gera arquivos',async()=>{
  let fetched=false;
  const result=await collectSenado(catalog,{fetchImpl:async()=>{fetched=true;throw new Error('NETWORK');}});
  assert.equal(result.state,'DRY_RUN_NOT_FETCHED');assert.equal(result.planned.length,4);assert.equal(fetched,false);
});
test('Piloto simulado grava manifestação privada sem liberar publicação',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-'));
  try {
    const result=await collectSenado(catalog,{execute:true,dir,fetchImpl:async(url)=>{
      const u=new URL(url);return new Response(JSON.stringify({ListaLegislacao:{Norma:[{NumeroNorma:u.searchParams.get('numero'),AnoNorma:u.searchParams.get('ano')}]}}),{headers:{'content-type':'application/json'}});
    }});
    assert.equal(result.observations.length,4);assert.equal(result.publication_eligible,false);
    assert.equal(result.observations.every(x=>x.fulltext_atomized===false && x.canonical_promotion===false),true);
    const raw=JSON.parse(await readFile(join(dir,'responses.private.json')));
    const intake=JSON.parse(await readFile(join(dir,'intake.private.json')));
    assert.equal(raw.length,4);assert.equal(intake.candidate_relationships.length,2);
    assert.equal((await stat(join(dir,'intake.private.json'))).mode & 0o777,0o600);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('Uma falha na API não produz manifesto de sucesso',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-fail-'));
  let call=0;
  try {
    await assert.rejects(collectSenado(catalog,{execute:true,dir,fetchImpl:async()=>{
      call++;if(call===2)throw new Error('OFFLINE');
      return new Response(JSON.stringify({NumeroNorma:6404,AnoNorma:1976}),{headers:{'content-type':'application/json'}});
    }}),/OFFLINE/);
    await assert.rejects(stat(join(dir,'intake.private.json')),{code:'ENOENT'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('IDs desconhecidos não podem disparar consultas arbitrárias',async()=>{
  await assert.rejects(collectSenado(catalog,{requestedKeys:['BR-FED-LEI-9999-1999']}),/UNKNOWN_OR_DUPLICATE_ACT/);
});

test('Importação mal-sucedida invalida manifesto antigo da mesma pasta',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'canone-senado-stale-'));
  try {
    await writeFile(join(dir,'intake.private.json'),JSON.stringify({state:'OLD_SUCCESS'}));
    await assert.rejects(collectSenado(catalog,{execute:true,dir,fetchImpl:async()=>{throw new Error('NO_CONNECTION');}}),/NO_CONNECTION/);
    await assert.rejects(stat(join(dir,'intake.private.json')),{code:'ENOENT'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('Não permite identidade inconsistentes no catálogo',()=>{
  const x=structuredClone(catalog);x.acts[0].number=9999;
  assert.throws(()=>validateCatalog(x),/CATALOG_IDENTITY_MISMATCH/);
});
