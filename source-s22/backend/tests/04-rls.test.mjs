// =============================================================================
// PROVAS DE RECUSA — AS TRÊS ÁREAS NO BANCO (RLS + PRIVILÉGIO)
// -----------------------------------------------------------------------------
// A tese: o BANCO é a fronteira. Um bug de autorização no backend vaza, no
// máximo, entre áreas — e o teste existe para provar que nem isso acontece.
//
// Aqui rodamos com SET ROLE de verdade: o papel público, o assinante e o
// staff. Sem trocar de papel, o RLS não é exercitado (superuser ignora RLS),
// e o teste passaria sem provar nada.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDb, one, rows, recusa, menciona, criarConta, criarQuestao, criarFonte, criarVerificacao, primeiroAssunto } from './helpers.mjs';

/**
 * Executa `fn` com um papel e (opcionalmente) um usuário da requisição.
 * `commit: true` é necessário quando o teste precisa verificar um registro
 * que a própria requisição escreveu (o log de acesso do staff) — com
 * ROLLBACK o registro seria descartado e o teste mediria o harness, não o
 * banco.
 */
async function comoPapel(db, { role, userId, commit = false }, fn) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET ROLE ${role}`);
    if (userId) await db.exec(`SET LOCAL app.current_user_id = '${userId}'`);
    const r = await fn();
    if (commit) await db.exec('COMMIT');
    return r;
  } finally {
    try { await db.exec('ROLLBACK'); } catch { /* transação abortada ou já commitada */ }
    try { await db.exec('RESET ROLE'); } catch { /* */ }
  }
}

test('fronteira do banco por área', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  // Cenário: um conteúdo publicado e um em rascunho.
  const autor = await criarConta(db, 'autor-rls@test.invalid');
  const fonte = await criarFonte(db, { key: 'fonte-rls' });
  const publicado = await criarQuestao(db, { key: 'rls-publicado', autor });
  const rascunho = await criarQuestao(db, { key: 'rls-rascunho', autor });

  for (const q of [publicado, rascunho]) {
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [q.contentItemId]);
  }
  await criarVerificacao(db, {
    contentItemId: publicado.contentItemId, sourceId: fonte.id, quote: 'Trecho.', autor
  });
  await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [publicado.contentItemId]);
  await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [publicado.contentItemId]);

  await t.test('o papel público vê o publicado e NÃO vê o rascunho', async () => {
    const vistos = await comoPapel(db, { role: 'canone_public' }, async () => {
      const r = await db.query(`SELECT key FROM public.v_public_content ORDER BY key`);
      return r.rows.map((x) => x.key);
    });
    assert.ok(vistos.includes('rls-publicado'), 'o público deveria ver o publicado');
    assert.ok(!vistos.includes('rls-rascunho'), 'o público NÃO pode ver o rascunho');
  });

  await t.test('o papel público NÃO lê o gabarito (learning.item_option)', async () => {
    const err = await comoPapel(db, { role: 'canone_public' }, () =>
      recusa(db, () => db.query(`SELECT * FROM learning.item_option`))
    );
    assert.ok(err, 'o público não pode ler as alternativas');
    assert.ok(
      menciona(err, 'permission denied') || menciona(err, 'violates row-level security'),
      `mensagem: ${err?.message}`
    );
  });

  await t.test('o papel público não lê dado de usuário', async () => {
    const err = await comoPapel(db, { role: 'canone_public' }, () =>
      recusa(db, () => db.query(`SELECT * FROM identity.user_profile`))
    );
    assert.ok(err, 'o público não pode ler perfil de usuário');
  });

  await t.test('o assinante vê o PRÓPRIO histórico e não o de outro', async () => {
    const alunoA = await criarConta(db, 'aluno-a-rls@test.invalid');
    const alunoB = await criarConta(db, 'aluno-b-rls@test.invalid');
    await db.exec(`SELECT learning.apply_review_event($1,$2,'facil','sistema',true)`, [alunoA, publicado.itemId]);
    await db.exec(`SELECT learning.apply_review_event($1,$2,'errei','sistema',false)`, [alunoB, publicado.itemId]);

    const idDeA = await one(
      db, `SELECT id FROM learning.review_event WHERE user_id=$1`, [alunoA]
    );
    const idDeB = await one(
      db, `SELECT id FROM learning.review_event WHERE user_id=$1`, [alunoB]
    );

    const deA = await comoPapel(db, { role: 'canone_subscriber', userId: alunoA }, async () => {
      const r = await db.query(`SELECT id FROM subscriber.v_my_history`);
      return r.rows.map((x) => x.id);
    });
    assert.ok(deA.includes(idDeA.id), 'o assinante deveria ver o próprio histórico');
    assert.ok(!deA.includes(idDeB.id), 'o assinante NÃO pode ver o histórico de outro');

    const deB = await comoPapel(db, { role: 'canone_subscriber', userId: alunoB }, async () => {
      const r = await db.query(`SELECT id FROM subscriber.v_my_history`);
      return r.rows.map((x) => x.id);
    });
    assert.ok(deB.includes(idDeB.id));
    assert.ok(!deB.includes(idDeA.id));
  });

  await t.test('o assinante NÃO lê o gabarito, mas o servidor corrige a resposta', async () => {
    const aluno = await criarConta(db, 'aluno-gabarito@test.invalid');
    const q = await criarQuestao(db, { key: 'rls-gabarito' });

    // A tabela crua com is_correct: proibida para o assinante.
    const err = await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, () =>
      recusa(db, () => db.query(`SELECT * FROM learning.item_option`))
    );
    assert.ok(err, 'o assinante não pode ler a tabela de alternativas');

    // A view entrega as alternativas SEM o gabarito.
    const opts = await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, async () => {
      const r = await db.query(
        `SELECT ordinal, body FROM subscriber.v_item_options WHERE item_id = $1 ORDER BY ordinal_pos`,
        [q.itemId]
      );
      return r.rows;
    });
    assert.equal(opts.length, 4);
    assert.ok(opts.every((o) => !('is_correct' in o)), 'a view não pode expor o gabarito');

    // A correção é do servidor: o assinante manda a alternativa, recebe o veredito.
    // O VEREDITO é texto ('correta' | 'errada' | 'anulada'), não booleano:
    // uma questão anulada pelo CFC não é 'errada' — ninguém pode errá-la.
    const [certo, errado] = await comoPapel(
      db,
      { role: 'canone_subscriber', userId: aluno },
      async () => {
        const a = await db.query(`SELECT learning.grade_answer($1,'A') AS ok`, [q.itemId]);
        const b = await db.query(`SELECT learning.grade_answer($1,'B') AS ok`, [q.itemId]);
        return [a.rows[0].ok, b.rows[0].ok];
      }
    );
    assert.equal(certo, 'correta', 'A é a alternativa correta');
    assert.equal(errado, 'errada', 'B não é');
  });

  await t.test('o assinante NÃO escreve em nome de outro (RLS no INSERT)', async () => {
    const alunoA = await criarConta(db, 'aluno-a-write@test.invalid');
    const alunoB = await criarConta(db, 'aluno-b-write@test.invalid');
    const err = await comoPapel(db, { role: 'canone_subscriber', userId: alunoA }, () =>
      recusa(db, () =>
        db.query(
          `INSERT INTO learning.review_event (user_id, item_id, grade, basis, correct)
           VALUES ($1,$2,'facil','sistema',true)`,
          [alunoB, publicado.itemId]
        )
      )
    );
    assert.ok(err, 'o assinante não pode registrar revisão em nome de outro');
  });

  await t.test('o staff NÃO lê o progresso do aluno pela tabela — só pela porta', async () => {
    const staff = await criarConta(db, 'staff-rls@test.invalid');
    const aluno = await criarConta(db, 'alvo-rls@test.invalid');
    const assunto = await primeiroAssunto(db);

    const err = await comoPapel(db, { role: 'canone_staff', userId: staff }, () =>
      recusa(db, () => db.query(`SELECT * FROM learning.mastery`))
    );
    assert.ok(err, 'o staff não pode ler a tabela de progresso direto');
  });

  await t.test('o staff com concessão lê pela porta única E o acesso fica registrado', async () => {
    const staff = await criarConta(db, 'staff-porta@test.invalid');
    const aluno = await criarConta(db, 'alvo-porta@test.invalid');

    // A concessão é criada pelo admin (o papel do staff pode inserir, mas a
    // política exige staff_user_id = usuário da requisição).
    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, 'Chamado de suporte para verificar o progresso do aluno.']
    );

    const lido = await comoPapel(db, { role: 'canone_staff', userId: staff, commit: true }, async () => {
      const r = await db.query(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, aluno, g.id]);
      return r.rows;
    });
    assert.ok(Array.isArray(lido));

    const log = await rows(
      db,
      `SELECT staff_user_id, subject_user_id, resource FROM admin.support_access_log WHERE grant_id=$1`,
      [g.id]
    );
    assert.equal(log.length, 1, 'o acesso deveria estar registrado');
    assert.equal(log[0].staff_user_id, staff);
  });

  await t.test('o admin tem acesso pleno ao conteúdo, mas o log de auditoria é append-only', async () => {
    const err = await comoPapel(db, { role: 'canone_admin' }, () =>
      recusa(db, () => db.query(`UPDATE audit.audit_log SET action = ' adulterada '`))
    );
    assert.ok(err, 'o admin não pode alterar o log de auditoria');
  });

  await t.test('o contexto de usuário NÃO vaza entre requisições', async () => {
    const alunoA = await criarConta(db, 'aluno-ctx-a@test.invalid');
    // Requisição 1: como aluno A.
    await comoPapel(db, { role: 'canone_subscriber', userId: alunoA }, async () => {
      const r = await db.query(`SELECT current_setting('app.current_user_id', true) AS u`);
      assert.equal(r.rows[0].u, alunoA);
    });
    // Requisição 2: SEM usuário — não pode herdar o contexto anterior.
    const depois = await comoPapel(db, { role: 'canone_subscriber' }, async () => {
      const r = await db.query(`SELECT current_setting('app.current_user_id', true) AS u`);
      return r.rows[0].u;
    });
    assert.ok(!depois, `o contexto vazou para a requisição seguinte: ${depois}`);
  });

  await t.test('o assinante alcança o PRÓPRIO perfil (o schema identity tem USAGE)', async () => {
    // A 017 concede privilégio de TABELA em identity.user_profile — mas
    // privilégio de tabela sem USAGE no SCHEMA não chega ao fim: a
    // consulta morre em "permission denied for schema identity" antes do
    // RLS. A verificação tem que ser POSITIVA: ler o próprio perfil.
    const eu = await criarConta(db, 'aluno-perfil@test.invalid');
    const outro = await criarConta(db, 'outro-perfil@test.invalid');
    const meu = await comoPapel(db, { role: 'canone_subscriber', userId: eu }, () =>
      db.query(`SELECT display_name FROM identity.user_profile WHERE user_id = $1`, [eu])
    );
    assert.equal(meu.rows.length, 1, 'o assinante lê o próprio perfil');
    const alheio = await comoPapel(db, { role: 'canone_subscriber', userId: eu }, () =>
      db.query(`SELECT display_name FROM identity.user_profile WHERE user_id = $1`, [outro])
    );
    assert.equal(alheio.rows.length, 0, 'o assinante NÃO lê o perfil de outro');
  });

});
