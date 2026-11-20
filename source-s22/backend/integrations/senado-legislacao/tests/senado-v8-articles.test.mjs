import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildArticleQueue,queueCsv} from '../article-queue.mjs';
const catalog=JSON.parse(await readFile(new URL('../catalog.v1.json',import.meta.url),'utf8'));

test('Escopo Senado V8 produz 26 unidades legais candidatas e nenhum claim aprovado',()=>{
  const rows=buildArticleQueue(catalog);
  assert.equal(rows.length,26);
  assert.equal(new Set(rows.map(r=>r.candidate_id)).size,26);
  assert.equal(rows.filter(r=>r.source_id==='BR-FED-LEI-11638-2007').length,18);
  assert.equal(rows.filter(r=>r.source_locator==='art.76').length,7);
  assert.equal(rows.filter(r=>r.source_locator==='art.77').length,1);
  assert.ok(rows.every(r=>r.atom_verified===false&&r.source_bytes_verified===false&&r.canonical_promotion===false&&r.status==='HOLD_SOURCE_ATOMIZATION'));
  assert.ok(rows.every(r=>r.legal_temporal_review==='HOLD_HUMAN'&&r.editorial_review==='HOLD_HUMAN'));
});

test('Arquivo CSV de revisão deve corresponder exatamente ao gerador (sem drift)',async()=>{
  const expected=queueCsv(catalog);
  const observed=await readFile(new URL('../generated/article-review-queue.csv',import.meta.url),'utf8');
  assert.equal(observed,expected);
});
