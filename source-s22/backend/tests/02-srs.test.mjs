// =============================================================================
// PROVAS DE RECUSA — MOTOR DE REPETIÇÃO ESPAÇADA (SRS)
// -----------------------------------------------------------------------------
// O SRS do Cânone tem duas decisões de produto:
//   1. GRADE DE 4 ESTADOS, não acerto/erro binário.
//   2. O FUNDIMENTO: base='sistema' (gabarito conhecido → estado DERIVADO)
//      vs base='autodeclarado' (flashcard → estado DECLARADO).
// E uma regra: 'naosei' NÃO entra no agendamento.
//
// E uma propriedade: learning.review_event é a VERDADE (append-only);
// learning.user_item_state é cache reconstruível.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona,
  criarConta, criarQuestao, primeiroAssunto
} from './helpers.mjs';

test('motor SRS', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test("'naosei' NÃO entra no agendamento", async () => {
    const aluno = await criarConta(db, 'aluno-naosei@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-naosei' });

    const st = await one(
      db,
      `SELECT * FROM learning.apply_review_event($1,$2,'naosei','autodeclarado',NULL)`,
      [aluno, q.itemId]
    );
    assert.equal(st.state, 'nova', "'naosei' deveria manter o item em 'nova'");
    assert.equal(st.due_at, null, "'naosei' NÃO pode gerar due_at — não é revisão");
    assert.equal(st.last_grade, 'naosei');
  });

  await t.test('base=sistema deriva o grade do gabarito (facil/errei)', async () => {
    const aluno = await criarConta(db, 'aluno-sistema@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-sistema' });

    const ok = await one(
      db,
      `SELECT * FROM learning.apply_review_event($1,$2,'facil','sistema',true)`,
      [aluno, q.itemId]
    );
    assert.equal(ok.last_grade, 'facil');
    assert.ok(ok.due_at, 'deveria ter agendamento');
    assert.equal(ok.state, 'aprendendo');

    const err = await one(
      db,
      `SELECT * FROM learning.apply_review_event($1,$2,'errei','sistema',false)`,
      [aluno, q.itemId]
    );
    assert.equal(err.last_grade, 'errei');
    assert.equal(err.state, 'reaprendendo');
  });

  await t.test('base=sistema com correct NULL é recusado', async () => {
    const aluno = await criarConta(db, 'aluno-null@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-null' });
    const err = await recusa(db, () =>
      db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',NULL)`, [aluno, q.itemId])
    );
    assert.ok(err, 'base=sistema sem correct deveria ser recusado');
    assert.ok(menciona(err, 'exige correct'), `mensagem: ${err.message}`);
  });

  await t.test("base=autodeclarado com grade NULL é recusado", async () => {
    const aluno = await criarConta(db, 'aluno-decl@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-decl' });
    const err = await recusa(db, () =>
      db.exec(`SELECT learning.apply_review_event($1,$2,NULL,'autodeclarado',NULL)`, [aluno, q.itemId])
    );
    assert.ok(err, 'base=autodeclarado sem grade deveria ser recusado');
  });

  await t.test('base=autodeclarado preserva o grade declarado (esforço ≠ erro)', async () => {
    const aluno = await criarConta(db, 'aluno-esforco@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-esforco' });
    const st = await one(
      db,
      `SELECT * FROM learning.apply_review_event($1,$2,'esforco','autodeclarado',NULL)`,
      [aluno, q.itemId]
    );
    assert.equal(st.last_grade, 'esforco');
    assert.equal(st.state, 'aprendendo');
    assert.equal(st.stability_days < 15, true, 'esforço deve dar estabilidade curta');
  });

  await t.test('review_event é APPEND-ONLY: UPDATE é recusado', async () => {
    const aluno = await criarConta(db, 'aluno-imutavel@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-imutavel' });
    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [aluno, q.itemId]);

    const ev = await one(
      db,
      `SELECT id FROM learning.review_event WHERE user_id=$1 AND item_id=$2`,
      [aluno, q.itemId]
    );
    const err = await recusa(db, () =>
      db.exec(`UPDATE learning.review_event SET duration_ms = 1 WHERE id=$1`, [ev.id])
    );
    assert.ok(err, 'editar o log de revisão deveria ser recusado');
    assert.ok(menciona(err, 'append-only'), `mensagem: ${err.message}`);
  });

  await t.test('review_event é APPEND-ONLY: DELETE é recusado', async () => {
    const aluno = await criarConta(db, 'aluno-delete@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-delete' });
    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [aluno, q.itemId]);
    const ev = await one(
      db,
      `SELECT id FROM learning.review_event WHERE user_id=$1 AND item_id=$2`,
      [aluno, q.itemId]
    );
    const err = await recusa(db, () => db.exec(`DELETE FROM learning.review_event WHERE id=$1`, [ev.id]));
    assert.ok(err, 'apagar o log de revisão deveria ser recusado');
  });

  await t.test('o estado é RECONSTRUÍVEL a partir do log', async () => {
    const aluno = await criarConta(db, 'aluno-rebuild@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-rebuild' });

    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [aluno, q.itemId]);
    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [aluno, q.itemId]);
    await db.exec(`SELECT learning.apply_review_event($1,$2,'errei','sistema',false)`, [aluno, q.itemId]);

    const antes = await one(
      db,
      `SELECT state, stability_days, due_at, repetitions, lapses
         FROM learning.user_item_state WHERE user_id=$1 AND item_id=$2`,
      [aluno, q.itemId]
    );
    assert.equal(antes.repetitions, 3);

    // Apaga o cache e reconstrói a partir do log.
    const n = await one(
      db,
      `SELECT learning.rebuild_user_state($1) AS n`,
      [aluno]
    );
    assert.equal(n.n, 3, 'deveria reprocessar os 3 eventos');

    const depois = await one(
      db,
      `SELECT state, stability_days, due_at, repetitions, lapses
         FROM learning.user_item_state WHERE user_id=$1 AND item_id=$2`,
      [aluno, q.itemId]
    );
    assert.equal(depois.state, antes.state);
    assert.equal(depois.stability_days, antes.stability_days);
    assert.equal(depois.repetitions, antes.repetitions);
    assert.equal(depois.lapses, antes.lapses);
  });

  await t.test('a maestria é agregada POR ASSUNTO, não por item', async () => {
    const aluno = await criarConta(db, 'aluno-mestria@test.invalid');
    const assunto = await primeiroAssunto(db);
    const q1 = await criarQuestao(db, { key: 'mst-1', subjectId: assunto.id });
    const q2 = await criarQuestao(db, { key: 'mst-2', subjectId: assunto.id });

    // Vincula os itens ao assunto (o trigger de item_subject é por
    // content_relation; aqui vinculamos direto).
    await db.exec(
      `INSERT INTO learning.item_subject (item_id, subject_id) VALUES ($1,$2),($3,$4)
       ON CONFLICT DO NOTHING`,
      [q1.itemId, assunto.id, q2.itemId, assunto.id]
    );

    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [aluno, q1.itemId]);
    await db.exec(`SELECT learning.apply_review_event($1,$2,'errei','sistema',false)`, [aluno, q2.itemId]);
    await db.exec(`SELECT learning.refresh_mastery($1,$2)`, [aluno, assunto.id]);

    const m = await one(
      db,
      `SELECT items_seen, items_mastered, items_unseen, total_answers, correct_answers, confidence
         FROM learning.mastery WHERE user_id=$1 AND subject_id=$2`,
      [aluno, assunto.id]
    );
    assert.ok(m, 'a mestria deveria existir');
    assert.equal(m.items_seen, 2, 'deveria ver os 2 itens do assunto, não 1');
    assert.equal(m.total_answers, 2, 'deveria contar as 2 respostas');
    assert.equal(m.correct_answers, 1);
    assert.ok(m.confidence >= 0 && m.confidence <= 1, 'confiança precisa estar em [0,1]');
  });

  await t.test("'naosei' não aparece na lista de devidos", async () => {
    const aluno = await criarConta(db, 'aluno-due@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-due' });
    await db.exec(`SELECT learning.apply_review_event($1,$2,'naosei','autodeclarado',NULL)`, [aluno, q.itemId]);

    const due = await rows(db, `SELECT * FROM learning.due_items($1)`, [aluno]);
    assert.equal(due.length, 0, "'naosei' não pode entrar na fila de revisão");
  });

  await t.test('a constraint de base x correct é imposta pelo banco', async () => {
    const aluno = await criarConta(db, 'aluno-ck@test.invalid');
    const q = await criarQuestao(db, { key: 'srs-ck' });
    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO learning.review_event (user_id, item_id, grade, basis, correct)
         VALUES ($1,$2,'facil','sistema',NULL)`,
        [aluno, q.itemId]
      )
    );
    assert.ok(err, 'base=sistema com correct NULL deveria violar a constraint');
  });
});
