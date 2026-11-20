import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog, renderModuloTs, renderCapabilityCsv, renderEngineMarkdown, validateTemplate, renderAcceptanceCsv } from '../generate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const catalog=JSON.parse(readFileSync(resolve(root,'backend/contracts/product/catalog.v1.json'),'utf8'));
const clone=() => structuredClone(catalog);
const identity=cat => cat.modules.map(m=>`${m.n}:${m.id}`).sort().join('|');
const BASELINE_HASH='61f38b1aaa9d5cdf37d825d7b177dc977bcd8797a2c27cbefa6ba19370d2a901';

test('one canonical registry, exactly 26 modules, 15 reusable engines',()=>{
  assert.deepEqual(validateCatalog(catalog),{moduleCount:26,engineCount:15});
});
test('immutable S5 IDs and ordinal mapping until explicit migration review',()=>{
  assert.equal(createHash('sha256').update(identity(catalog)).digest('hex'), BASELINE_HASH);
});
test('the frontend is a deterministic projection, not a competing edited catalog',()=>{
  assert.equal(readFileSync(resolve(root,'app/src/content/modulos.ts'),'utf8'),renderModuloTs(catalog));
});
test('capability matrix is generated, 26 rows, no orphan modules',()=>{
  const csv=renderCapabilityCsv(catalog);
  assert.equal(csv.trimEnd().split('\n').length,27);
  assert.equal(readFileSync(resolve(root,'docs/generated/canone-modulos-capacidades.csv'),'utf8'),csv);
  assert.equal(readFileSync(resolve(root,'docs/generated/canone-motores-reutilizaveis.md'),'utf8'),renderEngineMarkdown(catalog));
});
test('duplicate or competing product/module identities fail closed',()=>{
  const x=clone();x.modules[1].id=x.modules[0].id;
  assert.throws(()=>validateCatalog(x),/duplicate\/invalid module ID/);
});
test('unknown engine fails closed instead of inventing an engine',()=>{
  const x=clone();x.modules[0].engine_ids.push('other-mock-exam-service');
  assert.throws(()=>validateCatalog(x),/unknown engine/);
});
test('duplicate engine bindings fail closed',()=>{
  const x=clone();x.modules[0].engine_ids.push(x.modules[0].engine_ids[0]);
  assert.throws(()=>validateCatalog(x),/duplicate engine binding/);
});
test('engine cannot claim implementation without an owned source file',()=>{
  const x=clone();x.engines.find(e=>e.id==='offline-sync').implementation_state='PARTIAL_BACKEND';
  assert.throws(()=>validateCatalog(x),/unowned implementation/);
});
test('marketing cannot silently promote non-homologated catalog module',()=>{
  const x=clone();x.modules[0].review_state='READY';
  assert.throws(()=>validateCatalog(x),/unapproved product claim/);
});
test('a release without preserved normative evidence cannot be enabled by catalog edits',()=>{
  const x=clone();x.canonical_ownership.semantic_provenance_status='PUBLISHED';
  assert.throws(()=>validateCatalog(x),/semantic provenance gate/);
});
test('database status remains NOT_MIGRATED until executable migrations pass real tests',()=>{
  const x=clone();x.canonical_ownership.database_status='READY';
  assert.throws(()=>validateCatalog(x),/migrations cannot be marked complete/);
});
test('UI source retains all phase and icon mappings without inventing components',()=>{
  const s=renderModuloTs(catalog);
  for(const m of catalog.modules){assert.ok(s.includes(`id: ${JSON.stringify(m.id)}`));assert.ok(s.includes(`icone: ${m.icon}`));}
  assert.equal((s.match(/\{ n: \d+, id:/g)||[]).length,26);
});


test('182 reuse-driven module acceptance gates are generated, not claimed completed',()=>{
  const t=validateTemplate(JSON.parse(readFileSync(resolve(root,'backend/contracts/product/feature-template.v1.json'),'utf8')));
  const csv=renderAcceptanceCsv(catalog,t);
  assert.equal(csv.trimEnd().split('\n').length,1+26*7);
  assert.equal(readFileSync(resolve(root,'docs/generated/canone-aceite-26-modulos.csv'),'utf8'),csv);
  assert.ok(csv.includes('CAN-S6-01-UI_REAL'));
  assert.ok(!csv.includes(';PASS;'));
});
test('duplicate gate definition fails closed',()=>{
  const t=JSON.parse(readFileSync(resolve(root,'backend/contracts/product/feature-template.v1.json'),'utf8'));
  t.gates[1].key=t.gates[0].key;
  assert.throws(()=>validateTemplate(t),/duplicate gate/);
});

test('all icon imports resolve to existing Design System exports, not a duplicate icon pack',()=>{
  for(const m of catalog.modules){
    const file=resolve(root,'app/src/content',m.icon_source+(m.icon_source.endsWith('icones-internos') ? '.tsx' : '.tsx'));
    // Both icon-source paths are relative to the generated TS file.
    const content=readFileSync(file,'utf8');
    assert.match(content,new RegExp(`export const ${m.icon}\\b`), `source mismatch for ${m.id}/${m.icon}`);
  }
});

test('there is only one published MODULOS registry in frontend source',()=>{
  const dirs=[resolve(root,'app/src')], matches=[];
  while(dirs.length){
    const dir=dirs.pop();
    for(const name of readdirSync(dir)){
      const file=resolve(dir,name);
      if(statSync(file).isDirectory()) dirs.push(file);
      else if(/\.tsx?$/.test(name) && /export\s+const\s+MODULOS\b/.test(readFileSync(file,'utf8'))) matches.push(file);
    }
  }
  assert.deepEqual(matches,[resolve(root,'app/src/content/modulos.ts')]);
});
