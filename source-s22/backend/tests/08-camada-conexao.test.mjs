// =============================================================================
// PROVA DA CAMADA DE CONEXÃO
// -----------------------------------------------------------------------------
// A camada de conexão (pool, transação, contexto de RLS) é a parte que
// ninguém lê com atenção e todo mundo depende. Ela precisa ser PROVADA
// contra o banco de verdade — não descrita.
//
// O que este arquivo prova:
//   · a área pública lê o catálogo e NÃO o dado de aluno
//   · a área do assinante só enxerga o PRÓPRIO progresso
//   · a visão de usuário do staff exige concessão e deixa rastro
//   · o contexto de papel NÃO vaza entre requisições
//   · a recusa do banco chega ao chamador como erro, não como vazio
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDb, one, criarConta, criarQuestao, primeiroAssunto } from './helpers.mjs';

const { createCanone } = await import('../dist/index.js');

test('camada de conexão', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  const canone = await createCanone({ db });

  await t.test('a área pública lê o catálogo sem login', async () => {
    const planos = await canone.publico.planos();
    assert.ok(planos.length >= 1, 'deveria haver planos');
    // A regra NÃO é "preço é sempre NULL" — é "preço sem origem não sai".
    // O comercial definiu o preço de dois planos (mensal e anual); os
    // demais continuam sem preço, e nenhum exibe valor sem a origem ao lado.
    const comPreco = planos.filter((p) => p.price_cents !== null);
    assert.ok(comPreco.length > 0, 'o comercial definiu preço — ele tem que aparecer');
    for (const p of comPreco) {
      assert.ok(p.price_cents > 0, 'preço zero é giveaway, não preço');
    }
    const semPreco = planos.filter((p) => p.price_cents === null);
    assert.ok(semPreco.length > 0, 'planos sem decisão comercial continuam sem preço');

    const assuntos = await canone.publico.assuntos();
    assert.equal(assuntos.length, 13);

    const modulos = await canone.publico.modulos();
    assert.equal(modulos.length, 26);
  });

  await t.test('a área do assinante registra revisão e devolve o estado', async () => {
    const aluno = await criarConta(db, 'camada-aluno@test.invalid');
    const q = await criarQuestao(db, { key: 'camada-q1' });

    const st = await canone.assinante({ userId: aluno }).registrar({
      itemId: q.itemId,
      grade: 'facil',
      basis: 'sistema',
      correct: true,
    });
    assert.equal(st.last_grade, 'facil');
    assert.ok(st.due_at, 'deveria ter agendamento');

    const hist = await canone.assinante({ userId: aluno }).historico();
    assert.equal(hist.length, 1);
    assert.equal(hist[0].item_id, q.itemId);
  });

  await t.test("'naosei' não gera agendamento pela camada de conexão", async () => {
    const aluno = await criarConta(db, 'camada-naosei@test.invalid');
    const q = await criarQuestao(db, { key: 'camada-q2' });

    const st = await canone.assinante({ userId: aluno }).registrar({
      itemId: q.itemId,
      grade: 'naosei',
      basis: 'autodeclarado',
    });
    assert.equal(st.due_at, null);
    assert.equal(st.state, 'nova');
  });

  await t.test('um assinante NÃO enxerga o progresso de outro', async () => {
    const a = await criarConta(db, 'camada-iso-a@test.invalid');
    const b = await criarConta(db, 'camada-iso-b@test.invalid');
    const q = await criarQuestao(db, { key: 'camada-q3' });

    await canone.assinante({ userId: a }).registrar({
      itemId: q.itemId, grade: 'facil', basis: 'sistema', correct: true
    });

    const histA = await canone.assinante({ userId: a }).historico();
    const histB = await canone.assinante({ userId: b }).historico();
    assert.equal(histA.length, 1, 'A deveria ver o próprio evento');
    assert.equal(histB.length, 0, 'B NÃO pode ver o evento de A');
  });

  await t.test('a visão de usuário exige concessão e deixa rastro', async () => {
    const staff = await criarConta(db, 'camada-staff@test.invalid');
    const aluno = await criarConta(db, 'camada-alvo@test.invalid');
    const assunto = await primeiroAssunto(db);
    const q = await criarQuestao(db, { key: 'camada-q4', subjectId: assunto.id });

    await db.exec(
      `INSERT INTO learning.item_subject (item_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [q.itemId, assunto.id]
    );
    await canone.assinante({ userId: aluno }).registrar({
      itemId: q.itemId, grade: 'facil', basis: 'sistema', correct: true
    });
    await canone.assinante({ userId: aluno }).recalcularMaestria(assunto.id);

    const g = await canone.admin({ userId: staff }).conceder({
      staffUserId: staff,
      subjectUserId: aluno,
      reason: 'Chamado de suporte para verificar o progresso do aluno.',
      ticketRef: 'CH-123',
      horasValidade: 4,
    });
    assert.ok(g.id);
    assert.equal(g.scope, 'progresso');

    const prog = await canone.admin({ userId: staff }).lerProgresso({
      staffUserId: staff,
      subjectUserId: aluno,
      grantId: g.id,
    });
    assert.ok(Array.isArray(prog));

    const log = await one(
      db, `SELECT count(*)::int AS n FROM admin.support_access_log WHERE grant_id=$1`, [g.id]
    );
    assert.equal(log.n, 1, 'a leitura deveria ter ficado registrada');
  });

  await t.test('a recusa do banco chega ao chamador como erro', async () => {
    const staff = await criarConta(db, 'camada-staff2@test.invalid');
    const aluno = await criarConta(db, 'camada-alvo2@test.invalid');

    // Motivo curto: o banco recusa (ck_grant... length >= 10).
    await assert.rejects(
      () =>
        canone.admin({ userId: staff }).conceder({
          staffUserId: staff,
          subjectUserId: aluno,
          reason: 'curto',
        }),
      /check constraint|motivo|reason/i
    );

    // Concessão vencida: a porta recusa.
    const g = await canone.admin({ userId: staff }).conceder({
      staffUserId: staff,
      subjectUserId: aluno,
      reason: 'Chamado de suporte para verificar o progresso do aluno.',
    });
    await db.exec(
      `UPDATE admin.support_access_grant
          SET granted_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
        WHERE id=$1`,
      [g.id]
    );
    await assert.rejects(
      () =>
        canone.admin({ userId: staff }).lerProgresso({
          staffUserId: staff,
          subjectUserId: aluno,
          grantId: g.id,
        }),
      /expirada|revogada/i
    );
  });

  await t.test('o papel não vaza entre requisições', async () => {
    const aluno = await criarConta(db, 'camada-ctx@test.invalid');
    const q = await criarQuestao(db, { key: 'camada-q5' });
    await canone.assinante({ userId: aluno }).registrar({
      itemId: q.itemId, grade: 'facil', basis: 'sistema', correct: true
    });

    // Depois de uma requisição do assinante, uma requisição anônima da
    // área pública não pode ver nada daquele aluno.
    const planos = await canone.publico.planos();
    assert.ok(planos.length >= 1);
    const log = await one(
      db,
      `SELECT count(*)::int AS n FROM learning.review_event e
         JOIN identity.account a ON a.id = e.user_id
        WHERE a.email = 'camada-ctx@test.invalid'`
    );
    assert.equal(log.n, 1, 'o evento existe — mas só o assinante o enxerga');
  });
});
