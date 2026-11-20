import test from 'node:test';
import assert from 'node:assert/strict';
import { rotasApi } from '../dist/http/api.js';
import { provas } from '../dist/areas/subscriber/provas.js';

const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const path = `/api/subscriber/tentativas/${id}/caderno-erros`;
const route = rotasApi.find(r => r.metodo === 'GET' && r.caminho.test(path));
assert.ok(route, 'S10 deve reutilizar superfície /api/subscriber/ existente');
const params = { 1: id };
function dbFixture({ active=true, finished=true, foreign=false, responses=[] }={}) {
  const calls=[];
  const db = {
    calls,
    async transaction(fn) { calls.push('BEGIN');try{const r=await fn(db);calls.push('COMMIT');return r;}catch(e){calls.push('ROLLBACK');throw e;} },
    async exec(sql) { calls.push(sql); },
    async query(sql, args) {
      calls.push({sql,args});
      if (/FROM commerce\.subscription/.test(sql)) return {rows:[{n:active?1:0},{n:0}]};
      if (/learning\.reveal_exam_key/.test(sql)) {
        if (foreign) throw Error('Tentativa não é do usuário do contexto');
        if (!finished) throw Error('O gabarito só é revelado depois de terminar a tentativa');
        return {rows:responses};
      }
      throw Error('Consulta inesperada: '+sql);
    }
  };
  return db;
}
function ctx(db,sessao={userId:user,token:'teste'}) {return {db,corpo:{},parametros:params,sessao};}
test('rota é do assinante e nunca calcula nota separadamente',()=>{
  assert.equal(route.area,'assinante');assert.equal(route.autenticada,true);
  assert.equal(route.caminho.test('/api/public/caderno-erros'),false);
});
test('sem sessão não executa nenhuma query',async()=>{
  const db=dbFixture();await assert.rejects(route.tratar(ctx(db,null)),/Não autenticado/);assert.equal(db.calls.length,0);
});
test('assinatura revogada bloqueia ANTES de revelar gabarito',async()=>{
  const db=dbFixture({active:false});await assert.rejects(route.tratar(ctx(db)),/Sem assinatura ativa/);
  assert.equal(db.calls.filter(x=>typeof x==='object'&&/reveal_exam_key/.test(x.sql)).length,0);
  assert.ok(db.calls.includes('ROLLBACK'));
});
test('tentativa aberta não expõe gabarito nem erros',async()=>{
  const db=dbFixture({finished:false});await assert.rejects(route.tratar(ctx(db)),/só é revelado depois/);
});
test('outro assinante não pode ler tentativa alheia',async()=>{
  const db=dbFixture({foreign:true});await assert.rejects(route.tratar(ctx(db)),/não é do usuário/);
});
test('caderno DERIVA exclusivamente da revelação canônica e não duplica queries de gabarito',async()=>{
  const db=dbFixture({responses:[
    {ordinal:1,chosen_option:'A',correct_option:'C',verdict:'errada',is_annulled:false,stem:'Enunciado validado'},
    {ordinal:2,chosen_option:'D',correct_option:'D',verdict:'correta',is_annulled:false,stem:'Acerto'},
    {ordinal:3,chosen_option:'A',correct_option:null,verdict:'anulada',is_annulled:true,stem:'Anulada'},
    {ordinal:4,chosen_option:'B',correct_option:'E',verdict:'errada',is_annulled:false,stem:'Erro 2'}
  ]});
  const r=await route.tratar(ctx(db));
  assert.equal(r.total_erros,2);assert.deepEqual(r.erros.map(x=>x.ordinal),[1,4]);
  assert.equal(db.calls.filter(x=>typeof x==='object'&&/reveal_exam_key/.test(x.sql)).length,1);
  assert.ok(db.calls.includes('SET LOCAL ROLE canone_subscriber'));assert.ok(db.calls.includes('COMMIT'));
});
test('serviço não acessa tabela de alternativas e não implementa segunda correção',async()=>{
  const src=provas.cadernoDeErros.toString();assert.doesNotMatch(src,/query\(|is_correct|grade_answer|item_option/);
});
