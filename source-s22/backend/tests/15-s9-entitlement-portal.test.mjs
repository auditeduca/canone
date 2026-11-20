/**
 * S9 — gate canônico de assinatura, sem banco/fixture sintética.
 * Esta suíte prova o roteamento e a recusa antecipada na API; NÃO substitui
 * os testes adversariais com PostgreSQL, RLS e papéis reais.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rotasApi } from '../dist/http/api.js';

const USER = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const paths = [
  ['GET', '/api/subscriber/provas', {}],
  ['GET', `/api/subscriber/provas/${ID}/questoes`, {}],
  ['POST', `/api/subscriber/provas/${ID}/tentativa`, {}],
  ['POST', `/api/subscriber/tentativas/${ID}/respostas`, { ordinal: 1, opcao: 'A' }],
  ['POST', `/api/subscriber/tentativas/${ID}/finalizar`, {}],
  ['POST', `/api/subscriber/tentativas/${ID}/revelar`, {}],
  ['GET', `/api/subscriber/tentativas/${ID}/caderno-erros`, {}],
];
function getRoute(method, path) {
  const r = rotasApi.find(x => x.metodo === method && x.caminho.test(path));
  assert.ok(r, `Rota não encontrada: ${method} ${path}`);
  const match = r.caminho.exec(path);
  return { r, parametros: Object.fromEntries((match?.slice(1) ?? []).map((x,i)=>[String(i+1),x])) };
}
function fakeDb(permitido) {
  const calls = [];
  const db = {
    calls,
    async transaction(fn) { calls.push('BEGIN'); try { const v = await fn(db); calls.push('COMMIT'); return v; } catch(e) { calls.push('ROLLBACK'); throw e; } },
    async exec(sql) { calls.push(sql); },
    async query(sql) {
      calls.push(sql);
      if (/FROM commerce\.subscription/.test(sql)) return { rows: [{n: permitido ? 1: 0},{n: 0}] };
      if (/learning\.answer_exam_attempt/.test(sql)) return { rows: [{ verdict:'correta' }] };
      if (/learning\.finish_exam_attempt/.test(sql)) return { rows: [{ id: ID, status:'concluida', answered_count:1, correct_count:1, wrong_count:0, annulled_count:0 }] };
      if (/learning\.reveal_exam_key/.test(sql)) return { rows: [{correct_option:'C'}] };
      if (/learning\.start_exam_attempt/.test(sql)) return { rows: [{id:ID}] };
      return { rows: [] };
    }
  };
  return db;
}
for (const [method,path,body] of paths) {
  const {r,parametros}=getRoute(method,path);
  test(`${method} ${path}: rota marcada autenticada e assinante`, () => {
    assert.equal(r.area,'assinante');assert.equal(r.autenticada,true);
  });
  test(`${method} ${path}: sem sessão nega sem SQL de domínio`, async () => {
    const db=fakeDb(true);
    await assert.rejects(r.tratar({db,parametros,corpo:body,sessao:null}),/Não autenticado/);
    assert.equal(db.calls.length,0);
  });
  test(`${method} ${path}: assinatura ausente nega e faz rollback antes do domínio`, async () => {
    const db=fakeDb(false);
    await assert.rejects(r.tratar({db,parametros,corpo:body,sessao:{userId:USER,token:'falso'}}),/Sem assinatura ativa/);
    assert.equal(db.calls.filter(q=>/FROM commerce\.subscription/.test(q)).length,1);
    assert.equal(db.calls.filter(q=>/FROM (?:learning|subscriber)\./.test(q)).length,0);
    assert.ok(db.calls.includes('ROLLBACK'));
  });
}
test('respondendo com assinatura, registra sem revelar veredito, em papel de assinante',async()=>{
  const [m,p,body]=paths[3];const {r,parametros}=getRoute(m,p);const db=fakeDb(true);
  const response=await r.tratar({db,parametros,corpo:body,sessao:{userId:USER,token:'session'}});
  assert.deepEqual(response,{registrada:true});
  assert.ok(db.calls.some(s=>s==='SET LOCAL ROLE canone_subscriber'));
  assert.ok(db.calls.includes('COMMIT'));
});
test('alternativa inválida falha antes de tocar o banco',async()=>{
  const [m,p]=paths[3];const {r,parametros}=getRoute(m,p);const db=fakeDb(true);
  await assert.rejects(r.tratar({db,parametros,corpo:{ordinal:1,opcao:'X'},sessao:{userId:USER,token:'session'}}),/Alternativa inválida/);
  assert.equal(db.calls.length,0);
});
test('posição inválida falha antes de tocar o banco',async()=>{
  const [m,p]=paths[3];const {r,parametros}=getRoute(m,p);const db=fakeDb(true);
  await assert.rejects(r.tratar({db,parametros,corpo:{ordinal:0,opcao:'A'},sessao:{userId:USER,token:'session'}}),/Posição inválida/);
  assert.equal(db.calls.length,0);
});
