// =============================================================================
// PROVAS DE RECUSA — PROVA APLICADA E GABARITO OFICIAL
// -----------------------------------------------------------------------------
// O acervo real tem 56 edições de prova, 4 variantes paralelas por exame
// (T01..T04), 1.975 questões, 1.941 com gabarito e 34 anuladas. O schema
// anterior não tinha lugar nenhum para isso: o gabarito era um booleano e a
// prova era um simulado.
//
// Aqui se prova o COMPORTAMENTO do banco:
//   · a estrutura aceita prova, trilha, variante e gabarito com ciclo de vida
//   · o gabarito DEFINITIVO só existe se tiver todas as posições
//   · o gabarito que aponta para alternativa inexistente é recusado
//     (é o detector de prova DESALINHADA — o defeito que corrompe um acervo
//     inteiro quando o parser perde uma seção do PDF)
//   · questão anulada devolve 'anulada', nunca 'errada'
//   · o veredito sai do servidor e o gabarito não sai
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona, criarConta, criarQuestao, criarFonte,
  criarVerificacao, criarEdicaoRealizada, criarTrilha, criarForma,
  criarItemNaForma, criarGabarito
} from './helpers.mjs';

/** Executa `fn` com um papel e (opcionalmente) um usuário da requisição. */
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

test('prova aplicada e gabarito oficial', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  const autor = await criarConta(db, 'autor-provas@test.invalid');
  const fonteProva = await criarFonte(db, { key: 'fonte-prova-2024-2', quote: 'Prova 2024.2 — Tipo 1.' });
  const fonteGab = await criarFonte(db, { key: 'fonte-gabarito-2024-2', quote: 'Gabarito definitivo 2024.2 — Tipo 1.' });

  // Rodada realizada, trilha de Suficiência e a variante T01.
  // A rodada do teste tem 3 questões (a real tem 50 — a prova de forma do
  // acervo real é o script prova-forma-acervo.mjs). O que importa aqui é o
  // COMPORTAMENTO, e a regra de completude só fecha prova INTEIRA.
  const edicao = await criarEdicaoRealizada(db, { code: '2024.2', questionCount: 3, passingScore: 2 });
  const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
  const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });

  // Três questões na prova. O payload diz que a correta é sempre 'A';
  // o gabarito é que diz a verdade.
  const q1 = await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'prova-2024-2-T01-q01' });
  const q2 = await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'prova-2024-2-T01-q02' });
  const q3 = await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'prova-2024-2-T01-q03' });

  await t.test('a rodada realizada aceita data nula — data não conferida fica nula, não inventada', async () => {
    const e = await one(db, `SELECT application_date, status FROM taxonomy.exam_edition WHERE id=$1`, [edicao.id]);
    assert.equal(e.status, 'realizada');
    assert.equal(e.application_date, null, 'sem data conferida, a data é nula');
  });

  await t.test('rodada agendada SEM data é recusada', async () => {
    const err = await recusa(db, () =>
      one(db, `INSERT INTO taxonomy.exam_edition (code, label, edition_number, year, application_date, status)
               VALUES ('2099.1','Rodada futura',1,2099,NULL,'agendada') RETURNING id`)
    );
    assert.ok(err, 'a rodada agendada tem que ter data');
  });

  await t.test('a trilha da Suficiência não pode discordar da rodada sobre o número de questões', async () => {
    const err = await recusa(db, () => criarTrilha(db, { editionId: edicao.id, questionCount: 2, passingScore: 2 }));
    assert.ok(err && menciona(err, '3'), 'a divergência de número de questões tem de ser recusada');
  });

  await t.test('a especialidade é obrigatória na EQT e proibida na Suficiência', async () => {
    const errEqt = await recusa(db, () =>
      criarTrilha(db, { editionId: edicao.id, trackCode: 'eqt', specialty: null, questionCount: 25, passingScore: null })
    );
    assert.ok(errEqt, 'EQT sem especialidade é inválida');
    const errSuf = await recusa(db, () =>
      criarTrilha(db, { editionId: edicao.id, trackCode: 'suficiencia', specialty: 'CVM', questionCount: 50, passingScore: 25 })
    );
    assert.ok(errSuf, 'Suficiência não tem especialidade');
  });

  await t.test('o gabarito projeta a letra no item — e o payload perde para o oficial', async () => {
    // O payload diz 'A'; o gabarito preliminar diz 'C'.
    await criarGabarito(db, {
      formId: forma.id, status: 'preliminar', sourceId: fonteGab.id,
      entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'B' }, { ordinal: 3, letter: 'D' }]
    });
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q1.itemId]);
    assert.deepEqual(opts.map((o) => [o.ordinal, o.is_correct]), [['A', false], ['B', false], ['C', true], ['D', false]]);
  });

  await t.test('o gabarito DEFINITIVO exige todas as posições', async () => {
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'A' }, { ordinal: 2, letter: 'B' }] // falta a 3ª
      })
    );
    assert.ok(err, 'gabarito definitivo incompleto tem de ser recusado');
    assert.ok(menciona(err, '3'), `o erro tem que dizer quantas posições faltam: ${err?.message}`);
  });

  await t.test('a prova pela metade não recebe gabarito definitivo', async () => {
    // Uma variante com 2 das 3 questões: o gabarito definitivo exige a prova
    // inteira — senão a perda de questões fica em silêncio.
    const trilha2 = await criarTrilha(db, { editionId: edicao.id, trackCode: 'eqt', specialty: 'CVM', questionCount: 3, passingScore: null });
    const forma2 = await criarForma(db, { trackId: trilha2.id, formCode: 'T01' });
    await criarItemNaForma(db, { formId: forma2.id, ordinal: 1, key: 'prova-parcial-q01' });
    await criarItemNaForma(db, { formId: forma2.id, ordinal: 2, key: 'prova-parcial-q02' });
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: forma2.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'A' }, { ordinal: 2, letter: 'B' }]
      })
    );
    assert.ok(err, 'prova incompleta não pode ter gabarito definitivo');
    assert.ok(menciona(err, 'completa'), `o erro tem que dizer que a prova está incompleta: ${err?.message}`);
  });

  await t.test('o gabarito que aponta para alternativa inexistente é recusado (prova desalinhada)', async () => {
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'E' }, { ordinal: 2, letter: 'B' }, { ordinal: 3, letter: 'D' }]
      })
    );
    assert.ok(err, 'alternativa que não existe tem de ser recusada');
    assert.ok(menciona(err, 'alternativa'), `o erro tem que apontar a alternativa: ${err?.message}`);
  });

  await t.test('a posição que não existe na prova é recusada', async () => {
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'A' }, { ordinal: 2, letter: 'B' }, { ordinal: 3, letter: 'D' }, { ordinal: 9, letter: 'A' }]
      })
    );
    assert.ok(err, 'posição fora da prova tem de ser recusada');
  });

  await t.test('questão anulada devolve "anulada" — nunca "errada"', async () => {
    await criarGabarito(db, {
      formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
      entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, annulled: true }, { ordinal: 3, letter: 'D' }]
    });
    const v = await rows(db, `SELECT learning.grade_answer($1,'A') AS v`, [q2.itemId]);
    assert.equal(v[0].v, 'anulada', 'a questão anulada não é errada: ninguém pode errá-la');
    const v3 = await rows(db, `SELECT learning.grade_answer($1,'D') AS v`, [q3.itemId]);
    assert.equal(v3[0].v, 'correta');
    const v3b = await rows(db, `SELECT learning.grade_answer($1,'A') AS v`, [q3.itemId]);
    assert.equal(v3b[0].v, 'errada');
  });

  await t.test('o veredito vem do gabarito oficial, não da letra que sobrou no payload', async () => {
    // A letra no payload é 'A'; o gabarito definitivo diz 'C'.
    const vC = await rows(db, `SELECT learning.grade_answer($1,'C') AS v`, [q1.itemId]);
    assert.equal(vC[0].v, 'correta');
    const vA = await rows(db, `SELECT learning.grade_answer($1,'A') AS v`, [q1.itemId]);
    assert.equal(vA[0].v, 'errada');
  });

  await t.test('o segundo gabarito DEFINITIVO da mesma prova é recusado', async () => {
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'A' }, { ordinal: 2, letter: 'B' }, { ordinal: 3, letter: 'C' }]
      })
    );
    assert.ok(err, 'só existe um definitivo por prova');
  });

  await t.test('o DEFINITIVO substitui o PRELIMINAR da MESMA prova — e nada de outra', async () => {
    const outro = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: null, trackCode: 'eqt', specialty: 'BCB' });
    const outraForma = await criarForma(db, { trackId: outro.id, formCode: 'T01' });
    const preliminar = await one(db, `SELECT id FROM learning.answer_key WHERE exam_form_id=$1 AND status='preliminar'`, [forma.id]);
    const err = await recusa(db, () =>
      criarGabarito(db, {
        formId: outraForma.id, status: 'definitivo', sourceId: fonteGab.id,
        entries: [{ ordinal: 1, letter: 'A' }],
        supersedesId: preliminar.id
      })
    );
    assert.ok(err, 'não se substitui gabarito de outra prova');
  });

  await t.test('editar o payload NÃO devolve a letra antiga por cima do gabarito', async () => {
    // O redator edita o enunciado e a letra no payload muda para 'B'.
    await db.query(
      `UPDATE editorial.content_item_version SET payload = payload || '{"options":[{"ordinal":"A","body":"Alternativa A","correct":true},{"ordinal":"B","body":"Alternativa B","correct":false},{"ordinal":"C","body":"Alternativa C","correct":false},{"ordinal":"D","body":"Alternativa D","correct":false}]}'::jsonb
        WHERE content_item_id=$1`,
      [q1.contentItemId]
    );
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q1.itemId]);
    assert.deepEqual(
      opts.map((o) => [o.ordinal, o.is_correct]),
      [['A', false], ['B', false], ['C', true], ['D', false]],
      'o gabarito oficial tem precedência sobre a letra do payload'
    );
  });

  await t.test('o assinante NÃO lê o gabarito, mas recebe o veredito', async () => {
    const aluno = await criarConta(db, 'aluno-provas@test.invalid');
    const err = await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, () =>
      recusa(db, () => db.query(`SELECT * FROM learning.answer_key`))
    );
    assert.ok(err, 'o assinante não pode ler o gabarito');
    assert.ok(menciona(err, 'permission denied'), `o erro tem que ser de privilégio: ${err?.message}`);

    const v = await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, () =>
      db.query(`SELECT learning.grade_answer($1,'D') AS v`, [q3.itemId])
    );
    assert.equal(v.rows[0].v, 'correta', 'o veredito sai do servidor');
  });

  await t.test('o staff lê o gabarito (é quem confere a extração) e a visão de governança mostra a situação', async () => {
    const keys = await comoPapel(db, { role: 'canone_staff' }, () =>
      db.query(`SELECT status FROM learning.answer_key WHERE exam_form_id=$1`, [forma.id])
    );
    assert.equal(keys.rows.length, 2, 'preliminar + definitivo');
    const v = await comoPapel(db, { role: 'canone_staff' }, () =>
      db.query(`SELECT key_status, annulled, keyed, items_linked FROM admin.v_exam_form_status WHERE exam_form_id=$1`, [forma.id])
    );
    assert.equal(v.rows[0].key_status, 'definitivo');
    assert.equal(Number(v.rows[0].annulled), 1, 'a visão mostra a anulada');
    assert.equal(Number(v.rows[0].keyed), 3);
    assert.equal(Number(v.rows[0].items_linked), 3);
  });

  await t.test('o staff ALCANÇA o gabarito (o caminho concedido não pode estar morto)', async () => {
    // A 017 concede SELECT em learning.item_option ao staff — mas com RLS
    // FORCE e ZERO policies, o staff via ZERO linhas: o privilégio
    // concedido não chegava ao fim, e a falha se disfarçava de erro de
    // dado. O staff é quem confere a extração; o caminho tem de existir.
    const v = await comoPapel(db, { role: 'canone_staff' }, () =>
      db.query(`SELECT count(*)::int AS n FROM learning.item_option WHERE item_id = $1`, [q1.itemId])
    );
    assert.equal(v.rows[0].n, 4, 'o staff lê as alternativas da questão');
    const gab = await comoPapel(db, { role: 'canone_staff' }, () =>
      db.query(`SELECT count(*)::int AS n FROM learning.answer_key_entry`)
    );
    assert.ok(gab.rows[0].n > 0, 'o staff lê as entradas do gabarito');
    // E o assinante continua sem enxergar nada — e o banco RECUSA, não
    // devolve linha vazia: a ausência de privilégio é mais forte que uma
    // lista vazia.
    const erroAssinante = await comoPapel(db, { role: 'canone_subscriber' }, () =>
      recusa(db, () => db.query(`SELECT count(*)::int AS n FROM learning.item_option WHERE item_id = $1`, [q1.itemId]))
    );
    assert.ok(erroAssinante, 'o assinante não lê o gabarito');
  });

  await t.test('a camada de PRIVÍLEGIO já barra a escrita da letra', async () => {
    // learning.item_option não tem UPDATE para nenhum papel de aplicação
    // (017): só SELECT para staff e admin. A escrita pela aplicação morre
    // aqui, antes de qualquer regra.
    const res = await comoPapel(db, { role: 'canone_admin' }, async () => {
      const r = await db.query(
        `UPDATE learning.item_option SET is_correct = true
          WHERE item_id = $1 AND ordinal = 'A' AND is_correct = false`,
        [q1.itemId]
      );
      return r;
    });
    assert.equal(res.affectedRows ?? 0, 0, 'o admin não escreve a letra do item');
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q1.itemId]);
    assert.equal(opts.filter((o) => o.is_correct).length, 1, 'continua exatamente uma alternativa correta');
  });

  await t.test('a letra do item é DERIVADA: nem o dono escreve por cima do gabarito', async () => {
    // O dono do schema consegue UPDATE em learning.item_option (ninguém
    // mais consegue). A regra do banco é que a letra é DERIVADA: escrever
    // por cima da letra oficial é recusado, não aceito em silêncio.
    //
    // A mensagem pode ser a da regra de "uma alternativa correta" (que é
    // BEFORE e dispara antes) ou a da derivação (que é deferida para o
    // COMMIT). O que importa aqui: a escrita é recusada. A prova
    // específica da DERIVAÇÃO é o teste seguinte, que desmarca a letra
    // oficial — caminho que só a regra derivada fecha.
    const err = await recusa(db, () =>
      db.query(
        `UPDATE learning.item_option SET is_correct = true
          WHERE item_id = $1 AND ordinal = 'A' AND is_correct = false`,
        [q1.itemId]
      )
    );
    assert.ok(err, 'a letra do item é derivada do gabarito');
    assert.ok(
      menciona(err, 'DERIVADA') || menciona(err, 'alternativas corretas'),
      `a mensagem tem que apontar a letra derivada: ${err?.message}`
    );
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q1.itemId]);
    assert.equal(opts.filter((o) => o.is_correct).length, 1, 'continua exatamente uma alternativa correta');
    assert.equal(opts.find((o) => o.is_correct)?.ordinal, 'C', 'e continua sendo a letra do gabarito');
  });

  await t.test('a questão anulada não aceita alternativa correta', async () => {
    // Uma linha só: em Postgres os triggers AFTER disparam no FIM do
    // statement, e um UPDATE de várias linhas encontra antes a regra de
    // "uma alternativa correta" (que é BEFORE). A regra do anulado continua
    // valendo — o statement aborta e nada é gravado.
    const err = await recusa(db, () =>
      db.query(
        `UPDATE learning.item_option SET is_correct = true
          WHERE item_id = $1 AND ordinal = 'A' AND is_correct = false`,
        [q2.itemId]
      )
    );
    assert.ok(err, 'questão anulada não tem resposta para escrever');
    assert.ok(menciona(err, 'ANULADA'), `a mensagem tem que dizer que está anulada: ${err?.message}`);
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q2.itemId]);
    assert.equal(opts.filter((o) => o.is_correct).length, 0, 'questão anulada continua sem alternativa correta');
  });

  await t.test('a questão anulada não publica: sem gabarito, não há resposta', async () => {
    // q2 é a anulada: o payload não tem alternativa correta.
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q2.itemId]);
    assert.equal(opts.filter((o) => o.is_correct).length, 0, 'a anulada não tem letra');
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [q2.contentItemId]);
    await criarVerificacao(db, { contentItemId: q2.contentItemId, sourceId: fonteProva.id, quote: 'Trecho literal da prova.', autor });
    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q2.contentItemId]);
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [q2.contentItemId])
    );
    assert.ok(err, 'questão sem gabarito não publica como item de avaliação');
  });

  await t.test('a letra oficial não pode ser desmarcada: projeção e veredito não divergem', async () => {
    // O caminho inverso do erro anterior: não é só marcar a alternativa
    // errada que é proibido — DESMARCAR a alternativa oficial também é.
    // Sem isso, a projeção diz "nenhuma correta" enquanto o veredito
    // (que vem do gabarito) continua dizendo 'correta': duas verdades.
    const err = await recusa(db, () =>
      db.query(
        `UPDATE learning.item_option SET is_correct = false
          WHERE item_id = $1 AND ordinal = 'C' AND is_correct = true`,
        [q1.itemId]
      )
    );
    assert.ok(err, 'a letra oficial não pode ser desmarcada');
    assert.ok(menciona(err, 'DERIVADA'), `a mensagem tem que dizer que é derivada: ${err?.message}`);
    const opts = await rows(db, `SELECT ordinal, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal`, [q1.itemId]);
    assert.equal(opts.filter((o) => o.is_correct).length, 1, 'a alternativa oficial continua marcada');
    const v = await rows(db, `SELECT learning.grade_answer($1,'C') AS v`, [q1.itemId]);
    assert.equal(v[0].v, 'correta', 'projeção e veredito continuam de acordo');
  });

  await t.test('a prova selada não se desmonta: apagar a posição é recusado', async () => {
    // A prova já tem gabarito DEFINITIVO. Apagar uma posição deixaria o
    // gabarito apontando para uma posição que não existe mais — e a
    // regra de completude (que é sobre o gabarito) nem acordaria.
    const err = await recusa(db, () =>
      db.query(`DELETE FROM learning.exam_form_item WHERE exam_form_id = $1 AND ordinal = 2`, [forma.id])
    );
    assert.ok(err, 'posição de prova selada não pode ser apagada');
    assert.ok(menciona(err, 'DEFINITIVO'), `a mensagem tem que dizer que a prova é selada: ${err?.message}`);
    const n = await one(db, `SELECT count(*)::int AS n FROM learning.exam_form_item WHERE exam_form_id = $1`, [forma.id]);
    assert.equal(n.n, 3, 'a prova continua com as três posições');
  });

  await t.test('a prova selada não troca a questão da posição', async () => {
    const err = await recusa(db, () =>
      db.query(
        `UPDATE learning.exam_form_item SET item_id = $1
          WHERE exam_form_id = $2 AND ordinal = 3`,
        [q2.itemId, forma.id]
      )
    );
    assert.ok(err, 'posição de prova selada não troca de questão');
    const pos = await one(db, `SELECT item_id FROM learning.exam_form_item WHERE exam_form_id = $1 AND ordinal = 3`, [forma.id]);
    assert.notEqual(pos.item_id, q2.itemId, 'a posição continua com a questão original');
  });

  // ---------------------------------------------------------------------------
  // A CADEIA QUE O QA ADVERSARIAL MEDIU (e que fechava inteira)
  // ---------------------------------------------------------------------------

  await t.test('o gabarito DEFINITIVO não volta a preliminar', async () => {
    // O selo não se desfaz. Rebaixar o definitivo era o primeiro elo da
    // cadeia: sem ele, a prova perdia o selo e vinha o resto.
    const err = await recusa(db, () =>
      db.query(
        `UPDATE learning.answer_key SET status = 'preliminar'
          WHERE exam_form_id = $1 AND status = 'definitivo'`,
        [forma.id]
      )
    );
    assert.ok(err, 'gabarito definitivo não volta a preliminar');
    const k = await one(db, `SELECT status FROM learning.answer_key WHERE exam_form_id=$1 AND status='definitivo'`, [forma.id]);
    assert.equal(k.status, 'definitivo', 'o selo continua');
  });

  await t.test('a entrada do gabarito DEFINITIVO não pode ser apagada nem mudada', async () => {
    const keyId = await one(db, `SELECT id FROM learning.answer_key WHERE exam_form_id=$1 AND status='definitivo'`, [forma.id]);
    const errDel = await recusa(db, () =>
      db.query(`DELETE FROM learning.answer_key_entry WHERE answer_key_id=$1 AND ordinal=3`, [keyId.id])
    );
    assert.ok(errDel, 'entrada de gabarito definitivo não se apaga');
    const errUpd = await recusa(db, () =>
      db.query(`UPDATE learning.answer_key_entry SET correct_option='A' WHERE answer_key_id=$1 AND ordinal=1`, [keyId.id])
    );
    assert.ok(errUpd, 'entrada de gabarito definitivo não muda de letra');
    const n = await one(db, `SELECT count(*)::int AS n FROM learning.answer_key_entry WHERE answer_key_id=$1`, [keyId.id]);
    assert.equal(n.n, 3, 'o gabarito continua com as três entradas');
  });

  await t.test('a régua não se rebaseia depois do selo', async () => {
    // Trocar o número de questões da trilha depois do selo é trocar o
    // gabarito por fora: a completude é conferida contra esse número.
    const err = await recusa(db, () =>
      db.query(`UPDATE taxonomy.exam_track SET question_count = 2 WHERE id = $1`, [trilha.id])
    );
    assert.ok(err, 'a régua não se rebaseia depois do selo');
    const t2 = await one(db, `SELECT question_count FROM taxonomy.exam_track WHERE id=$1`, [trilha.id]);
    assert.equal(Number(t2.question_count), 3, 'a régua continua com 3');
  });

  await t.test('a cadeia inteira do QA está fechada', async () => {
    // Os quatro elos, em sequência, como o QA os mediu.
    const elos = [];
    elos.push(await recusa(db, () =>
      db.query(`UPDATE learning.answer_key SET status='preliminar' WHERE exam_form_id=$1 AND status='definitivo'`, [forma.id])
    ));
    elos.push(await recusa(db, () =>
      db.query(`DELETE FROM learning.exam_form_item WHERE exam_form_id=$1 AND ordinal=3`, [forma.id])
    ));
    elos.push(await recusa(db, () =>
      db.query(`UPDATE taxonomy.exam_track SET question_count=2 WHERE id=$1`, [trilha.id])
    ));
    elos.push(await recusa(db, () =>
      db.query(`UPDATE learning.answer_key SET status='definitivo' WHERE exam_form_id=$1`, [forma.id])
    ));
    for (const [i, e] of elos.entries()) {
      assert.ok(e, `elo ${i + 1} da cadeia tem de ser recusado`);
    }
    const estado = await one(db, `
      SELECT (SELECT count(*)::int FROM learning.exam_form_item WHERE exam_form_id=$1) AS posicoes,
             (SELECT count(*)::int FROM learning.answer_key_entry e
                JOIN learning.answer_key k ON k.id=e.answer_key_id
               WHERE k.exam_form_id=$1 AND k.status='definitivo') AS entradas,
             (SELECT question_count FROM taxonomy.exam_track WHERE id=$2) AS regua`,
      [forma.id, trilha.id]);
    assert.equal(estado.posicoes, 3, 'a prova continua com 3 posições');
    assert.equal(estado.entradas, 3, 'o gabarito continua com 3 entradas');
    assert.equal(Number(estado.regua), 3, 'a régua continua em 3');
  });
});
