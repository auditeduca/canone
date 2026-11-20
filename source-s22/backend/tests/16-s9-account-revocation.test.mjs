/** S9 — prova isolada de revogação de sessão e não-reativação de contas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { acesso } from '../dist/areas/auth/conta.js';
const ID='11111111-1111-4111-8111-111111111111';
test('resolver sessão exige conta ativa, sem bloqueio, mesmo que token não esteja revogado', async()=>{
  let querySql='';
  const db={async query(sql){querySql=sql;return {rows:[]}}};
  assert.equal(await acesso.usuarioDaSessao(db,'token-quaisquer'),null);
  assert.match(querySql,/JOIN identity\.account a/);
  assert.match(querySql,/a\.status = 'ativo'/);
  assert.match(querySql,/a\.deleted_at IS NULL/);
  assert.match(querySql,/a\.locked_until/);
  assert.match(querySql,/s\.revoked_at IS NULL/);
});
for(const status of ['bloqueado','excluido','anonimizado']){
  test(`assegurarConta não reativa status ${status}`,async()=>{
    const queries=[];
    const db={async query(sql){queries.push(sql);if(sql.includes('SELECT id, status'))return {rows:[{id:ID,status}]};return {rows:[]}}};
    await assert.rejects(acesso.assegurarConta(db,`bloqueado-${status}@example.invalid`),/Acesso indisponível/);
    assert.equal(queries.length,2);
    assert.match(queries[1],/status IN \('pendente', 'ativo'\)/);
    assert.match(queries[1],/locked_until/);
    assert.match(queries[1],/deleted_at IS NULL/);
    assert.doesNotMatch(queries[1],/INSERT/);
  });
}
test('login de conta ativa não modifica papel nem cria novo usuário',async()=>{
  const queries=[];
  const db={async query(sql){queries.push(sql);if(sql.includes('SELECT id, status'))return {rows:[{id:ID,status:'ativo'}]};return {rows:[{id:ID}]}}};
  assert.equal(await acesso.assegurarConta(db,'ok@example.invalid'),ID);
  assert.equal(queries.length,2);
  assert.ok(queries[1].includes('UPDATE identity.account'));
  assert.ok(!queries.some(q=>q.includes('INSERT')));
});
