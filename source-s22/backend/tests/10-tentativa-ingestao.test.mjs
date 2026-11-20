// =============================================================================
// PROVAS DE RECUSA — TENTATIVA DE PROVA E INGESTÃO DO ACERVO
// -----------------------------------------------------------------------------
// Duas cadeias se fecham aqui:
//
// 1. A TENTATIVA. O candidato responde, o servidor julga, e o gabarito só
//    aparece DEPOIS de terminar. Antes disso, revelar gabarito é dar a
//    resposta de graça.
//
// 2. A INGESTÃO. O acervo (56 edições, 1.975 questões, 34 anuladas) chega
//    como JSON de outro ambiente. A importação tem que ser idempotente,
//    tem que recusar enunciado ausente (perda silenciosa é proibida) e tem
//    que recusar conflito de número de questões (divergência de fonte não
//    se resolve sobrescrevendo).
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona, criarConta, criarFonte,
  criarEdicaoRealizada, criarTrilha, criarForma, criarItemNaForma, criarGabarito
} from './helpers.mjs';

/** Como `comoPapel`, masallowing forjar a ÁREA pelo GUC (o que o QA mediu). */
async function comoPapelComArea(db, { role, userId, area }, fn) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET ROLE ${role}`);
    if (userId) await db.exec(`SET LOCAL app.current_user_id = '${userId}'`);
    if (area) await db.exec(`SET LOCAL app.current_area = '${area}'`);
    const r = await fn();
    await db.exec('COMMIT');
    return r;
  } finally {
    try { await db.exec('ROLLBACK'); } catch { /* transação abortada ou já commitada */ }
    try { await db.exec('RESET ROLE'); } catch { /* */ }
  }
}

/** Prova de teste: rodada realizada, trilha, variante T01, 3 questões e gabarito. */
async function criarProvaDeTeste(db, sufixo) {
  const fonte = await criarFonte(db, { key: `fonte-${sufixo}`, quote: `Gabarito oficial ${sufixo}.` });
  const edicao = await criarEdicaoRealizada(db, { code: `2099.${sufixo === 'forge' ? '1' : '2'}`, questionCount: 3, passingScore: 2 });
  const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
  const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
  const q1 = await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: `prova-${sufixo}-q01` });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: `prova-${sufixo}-q02` });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: `prova-${sufixo}-q03` });
  await criarGabarito(db, {
    formId: forma.id, status: 'definitivo', sourceId: fonte.id,
    entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'A' }, { ordinal: 3, letter: 'B' }]
  });
  return { formId: forma.id, q1ItemId: q1.itemId };
}

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

/** Monta um payload no formato do catálogo do acervo. */
function payloadAcervo({ id, ano, edicao, tipo = 'T01', examType = 'Suf', gabarito = 'definitive', questoes }) {
  return {
    id, ano, edicao,
    tipo_prova: tipo,
    exam_type: examType,
    banca: 'FGV',
    gabarito_type: gabarito,
    questoes: questoes.map((q) => ({
      numero: q.n,
      gabarito: q.gabarito,
      enunciado: q.enunciado ?? `Enunciado da questão ${q.n}.`,
      alternativas: q.alternativas ?? {
        A: `Alternativa A da questão ${q.n}.`,
        B: `Alternativa B da questão ${q.n}.`,
        C: `Alternativa C da questão ${q.n}.`,
        D: `Alternativa D da questão ${q.n}.`
      }
    }))
  };
}

test('tentativa de prova e ingestão do acervo', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  const fonteGab = await criarFonte(db, { key: 'fonte-gab-tentativa', quote: 'Gabarito.' });

  // ---- Uma prova real, montada à mão, para a tentativa -------------
  const edicao = await criarEdicaoRealizada(db, { code: '2025.2', questionCount: 3, passingScore: 2 });
  const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
  const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
  const q1 = await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'tentativa-q01' });
  const q2 = await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'tentativa-q02' });
  const q3 = await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'tentativa-q03' });
  await criarGabarito(db, {
    formId: forma.id, status: 'definitivo', sourceId: fonteGab.id,
    entries: [{ ordinal: 1, letter: 'A' }, { ordinal: 2, annulled: true }, { ordinal: 3, letter: 'C' }]
  });

  const aluno = await criarConta(db, 'aluno-tentativa@test.invalid');

  await t.test('a tentativa nasce do usuário do contexto — não de um parâmetro', async () => {
    // commit: true — sem isso o ROLLBACK do harness descartaria a tentativa
    // e o teste mediria o harness, não o banco.
    const id = await comoPapel(db, { role: 'canone_subscriber', userId: aluno, commit: true }, () =>
      db.query(`SELECT learning.start_exam_attempt($1) AS id`, [forma.id])
    );
    assert.ok(id.rows[0].id, 'a tentativa tem que ser criada');
    const a = await one(db, `SELECT user_id, exam_form_id, status FROM learning.exam_attempt WHERE id=$1`, [id.rows[0].id]);
    assert.equal(a.user_id, aluno, 'a tentativa é do usuário do contexto');
    assert.equal(a.status, 'em_andamento');
  });

  await t.test('responder devolve o VEREDITO e guarda a resposta', async () => {
    // commit: true — as respostas precisam sobreviver ao fim do teste para
    // que as contagens possam ser conferidas.
    const [a, b, c] = await comoPapel(db, { role: 'canone_subscriber', userId: aluno, commit: true }, async () => {
      const att = await db.query(`SELECT id FROM learning.exam_attempt LIMIT 1`);
      const id = att.rows[0].id;
      const v1 = await db.query(`SELECT learning.answer_exam_attempt($1,1,'A') AS v`, [id]);
      const v2 = await db.query(`SELECT learning.answer_exam_attempt($1,2,'A') AS v`, [id]);
      const v3 = await db.query(`SELECT learning.answer_exam_attempt($1,3,'D') AS v`, [id]);
      return [v1.rows[0].v, v2.rows[0].v, v3.rows[0].v];
    });
    assert.equal(a, 'correta');
    assert.equal(b, 'anulada', 'a questão anulada não é errada');
    assert.equal(c, 'errada');
    const cont = await one(db, `SELECT answered_count, correct_count, wrong_count, annulled_count FROM learning.exam_attempt LIMIT 1`);
    assert.equal(Number(cont.answered_count), 3);
    assert.equal(Number(cont.correct_count), 1);
    assert.equal(Number(cont.wrong_count), 1);
    assert.equal(Number(cont.annulled_count), 1);
  });

  await t.test('mudar a resposta recalcula a contagem (não acumula torto)', async () => {
    await comoPapel(db, { role: 'canone_subscriber', userId: aluno, commit: true }, async () => {
      const att = await db.query(`SELECT id FROM learning.exam_attempt LIMIT 1`);
      await db.query(`SELECT learning.answer_exam_attempt($1,3,'C')`, [att.rows[0].id]);
    });
    const cont = await one(db, `SELECT correct_count, wrong_count FROM learning.exam_attempt LIMIT 1`);
    assert.equal(Number(cont.correct_count), 2, 'a resposta trocada corrigiu a contagem');
    assert.equal(Number(cont.wrong_count), 0);
  });

  await t.test('o gabarito NÃO é revelado antes de terminar a tentativa', async () => {
    const err = await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, () =>
      recusa(db, async () => {
        const att = await db.query(`SELECT id FROM learning.exam_attempt LIMIT 1`);
        await db.query(`SELECT * FROM learning.reveal_exam_key($1)`, [att.rows[0].id]);
      })
    );
    assert.ok(err, 'revelar gabarito antes de terminar é dar a resposta');
    assert.ok(menciona(err, 'terminar'), `a mensagem tem que dizer por quê: ${err?.message}`);
  });

  await t.test('terminada a tentativa, o gabarito é revelado — e bate com a resposta', async () => {
    const r = await comoPapel(db, { role: 'canone_subscriber', userId: aluno, commit: true }, async () => {
      const att = await db.query(`SELECT id FROM learning.exam_attempt LIMIT 1`);
      await db.query(`SELECT learning.finish_exam_attempt($1)`, [att.rows[0].id]);
      return db.query(`SELECT * FROM learning.reveal_exam_key($1)`, [att.rows[0].id]);
    });
    assert.equal(r.rows.length, 3);
    assert.equal(r.rows[0].correct_option, 'A');
    assert.equal(r.rows[1].is_annulled, true, 'a posição anulada aparece como anulada');
    assert.equal(r.rows[2].correct_option, 'C');
  });

  await t.test('ninguém responde a tentativa de outro', async () => {
    const outro = await criarConta(db, 'outro-aluno@test.invalid');
    // O id é buscado FORA do papel: o outro assinante não enxerga a
    // tentativa alheia (isso é RLS, testado abaixo), mas a função tem de
    // recusar mesmo assim.
    const att = await one(db, `SELECT id FROM learning.exam_attempt LIMIT 1`);
    const err = await comoPapel(db, { role: 'canone_subscriber', userId: outro }, () =>
      recusa(db, () => db.query(`SELECT learning.answer_exam_attempt($1,1,'A')`, [att.id]))
    );
    assert.ok(err, 'a tentativa alheia é recusada');
  });

  await t.test('o assinante não vê a tentativa dos outros (RLS)', async () => {
    const outro = await criarConta(db, 'outro-aluno-2@test.invalid');
    const r = await comoPapel(db, { role: 'canone_subscriber', userId: outro }, () =>
      db.query(`SELECT count(*)::int AS n FROM learning.exam_attempt`)
    );
    assert.equal(r.rows[0].n, 0, 'RLS: a tentativa de outro não aparece');
  });

  // ---- A INGESTÃO DO ACERVO ---------------------------------------
  await t.test('a ingestão cria prova, questões e gabarito a partir do JSON', async () => {
    const p = payloadAcervo({
      id: 'cfc_suf_2022_1_T01', ano: 2022, edicao: 1, tipo: 'T01', examType: 'Suf',
      questoes: [
        { n: 1, gabarito: 'A' }, { n: 2, gabarito: 'B' }, { n: 3, gabarito: null }, { n: 4, gabarito: 'D' }
      ]
    });
    const formId = await one(db, `SELECT ops.import_corpus_form($1::jsonb) AS id`, [JSON.stringify(p)]);
    assert.ok(formId.id, 'a importação devolve a variante criada');

    const forma = await one(db, `SELECT id FROM learning.exam_form WHERE id=$1`, [formId.id]);
    const itens = await rows(db, `SELECT ordinal, item_id FROM learning.exam_form_item WHERE exam_form_id=$1 ORDER BY ordinal`, [forma.id]);
    assert.equal(itens.length, 4, 'as quatro questõesEntraram na prova');

    const chaves = await rows(db, `SELECT key FROM editorial.content_item WHERE key LIKE 'cfc_suf_2022_1_T01_q%' ORDER BY key`);
    assert.equal(chaves.length, 4);

    const gab = await one(db, `SELECT status FROM learning.answer_key WHERE exam_form_id=$1`, [forma.id]);
    assert.equal(gab.status, 'definitivo', 'o banco fala português; o acervo fala inglês');

    const entradas = await rows(db, `SELECT ordinal, correct_option, is_annulled FROM learning.answer_key_entry
      JOIN learning.answer_key ak ON ak.id = answer_key_id
      WHERE ak.exam_form_id=$1 ORDER BY ordinal`, [forma.id]);
    assert.equal(entradas.length, 4);
    assert.equal(entradas[2].is_annulled, true, 'a questão sem gabarito entra como anulada');
    assert.equal(entradas[0].correct_option, 'A');

    // A letra oficial manda na projeção do item.
    const letra = await rows(db, `SELECT o.ordinal, o.is_correct FROM learning.item_option o
      JOIN learning.item i ON i.id = o.item_id
      JOIN learning.exam_form_item efi ON efi.item_id = i.id
      WHERE efi.exam_form_id=$1 AND efi.ordinal=1 ORDER BY o.ordinal`, [forma.id]);
    assert.equal(letra.find((x) => x.ordinal === 'A').is_correct, true);
  });

  await t.test('a ingestão é idempotente: rodar duas vezes não duplica nem diverge', async () => {
    const p = payloadAcervo({
      id: 'cfc_suf_2022_1_T01', ano: 2022, edicao: 1, tipo: 'T01', examType: 'Suf',
      questoes: [{ n: 1, gabarito: 'A' }, { n: 2, gabarito: 'B' }, { n: 3, gabarito: null }, { n: 4, gabarito: 'D' }]
    });
    await db.query(`SELECT ops.import_corpus_form($1::jsonb)`, [JSON.stringify(p)]);
    const itens = await rows(db, `SELECT ordinal FROM learning.exam_form_item efi
      JOIN learning.exam_form ef ON ef.id = efi.exam_form_id
      JOIN taxonomy.exam_track t ON t.id = ef.exam_track_id
      WHERE t.exam_edition_id = (SELECT id FROM taxonomy.exam_edition WHERE code='2022.1')`);
    assert.equal(itens.length, 4, 'a segunda passagem não duplicou posições');
    const chaves = await rows(db, `SELECT key FROM editorial.content_item WHERE key LIKE 'cfc_suf_2022_1_T01_q%'`);
    assert.equal(chaves.length, 4, 'a segunda passagem não duplicou questões');
  });

  await t.test('acervo SEM enunciado é recusado — perda silenciosa é proibida', async () => {
    // Uma rodada nova (2023.1): a de 2022.1 já tem 4 questões no banco e a
    // importação acusaria CONFLITO antes de chegar no enunciado.
    const p = payloadAcervo({ id: 'cfc_suf_2023_1_T02', ano: 2023, edicao: 1, tipo: 'T02', questoes: [{ n: 1, gabarito: 'A' }] });
    delete p.questoes[0].enunciado;
    const err = await recusa(db, () => db.query(`SELECT ops.import_corpus_form($1::jsonb)`, [JSON.stringify(p)]));
    assert.ok(err, 'questão sem enunciado tem de ser recusada');
    assert.ok(menciona(err, 'enunciado'), `a mensagem tem que dizer o que falta: ${err?.message}`);
  });

  await t.test('acervo com CONFLITO de número de questões é recusado', async () => {
    const p = payloadAcervo({
      id: 'cfc_suf_2022_1_T03', ano: 2022, edicao: 1, tipo: 'T03',
      questoes: [{ n: 1, gabarito: 'A' }, { n: 2, gabarito: 'B' }, { n: 3, gabarito: 'C' }, { n: 4, gabarito: 'D' }, { n: 5, gabarito: 'A' }]
    });
    const err = await recusa(db, () => db.query(`SELECT ops.import_corpus_form($1::jsonb)`, [JSON.stringify(p)]));
    assert.ok(err, 'divergência de número de questões tem de ser recusada');
    assert.ok(menciona(err, 'Conflito') || menciona(err, 'conflito'), `a mensagem tem que dizer que é conflito: ${err?.message}`);
  });

  await t.test('a EQT entra como trilha com especialidade e 25 questões', async () => {
    const questoes = Array.from({ length: 25 }, (_, i) => ({ n: i + 1, gabarito: ['A', 'B', 'C', 'D'][i % 4] }));
    const p = payloadAcervo({
      id: 'cfc_eqt_2026_1_CVM_T01', ano: 2026, edicao: 1, tipo: 'T01', examType: 'CVM',
      gabarito: 'preliminary', questoes
    });
    const r = await one(db, `SELECT ops.import_corpus_form($1::jsonb) AS id`, [JSON.stringify(p)]);
    const t1 = await one(db, `SELECT t.track_code, t.specialty_code, t.question_count
      FROM taxonomy.exam_track t JOIN learning.exam_form ef ON ef.exam_track_id = t.id WHERE ef.id=$1`, [r.id]);
    assert.equal(t1.track_code, 'eqt');
    assert.equal(t1.specialty_code, 'CVM');
    assert.equal(Number(t1.question_count), 25);
    const gab = await one(db, `SELECT status FROM learning.answer_key WHERE exam_form_id=$1`, [r.id]);
    assert.equal(gab.status, 'preliminar', 'o acervo de 2026.1 ainda é preliminar');
  });

  // ---------------------------------------------------------------------------
  // OS TRÊS FECHOS QUE O QA ADVERSARIAL ABRIU
  // ---------------------------------------------------------------------------

  await t.test('forjar a ÁREA no GUC não abre a porta do staff', async () => {
    // O GUC app.current_area é de TEXTO LIVRE: qualquer sessão escreve.
    // Quem é staff é o PAPEL (current_user), que só muda por SET ROLE — e
    // SET ROLE exige membro do papel de destino. O assinante não é.
    const aluno = await criarConta(db, 'aluno-forge@test.invalid');
    const outro = await criarConta(db, 'outro-forge@test.invalid');
    const prova = await criarProvaDeTeste(db, 'forge');

    const at = await comoPapel(db, { role: 'canone_subscriber', userId: aluno, commit: true }, () =>
      db.query(`SELECT learning.start_exam_attempt($1) AS id`, [prova.formId])
    );
    const att = at.rows[0].id;

    // O assinante responde uma questão — para haver gabarito a vazar.
    await comoPapel(db, { role: 'canone_subscriber', userId: aluno }, () =>
      db.query(`SELECT learning.answer_exam_attempt($1, 1, 'A')`, [att])
    );

    // Agora o MESMO assinante se declara staff pelo GUC.
    await db.exec('BEGIN');
    let err = null, rowsReveladas = 0;
    try {
      await db.exec('SET ROLE canone_subscriber');
      await db.exec(`SET LOCAL app.current_user_id = '${aluno}'`);
      await db.exec(`SET LOCAL app.current_area = 'staff'`);
      const r = await db.query(`SELECT * FROM learning.reveal_exam_key($1)`, [att]);
      rowsReveladas = r.rows.length;
    } catch (e) { err = e; } finally {
      try { await db.exec('ROLLBACK'); } catch { /* */ }
      try { await db.exec('RESET ROLE'); } catch { /* */ }
    }
    assert.ok(err, 'a área forjada não pode revelar o gabarito antes da tentativa');
    assert.equal(rowsReveladas, 0, 'nenhuma linha de gabarito pode vazar');

    // E a tentativa alheia continua intocável, mesmo com a área forjada.
    let err2 = null;
    try {
      await comoPapelComArea(db, { role: 'canone_subscriber', userId: outro, area: 'staff' }, () =>
        db.query(`SELECT learning.finish_exam_attempt($1)`, [att])
      );
    } catch (e) { err2 = e; }
    assert.ok(err2, 'ninguém finaliza a tentativa de outro');
    assert.ok(menciona(err2, 'não é do usuário'), `a mensagem tem que apontar a posse: ${err2?.message}`);
  });

  await t.test('o INSERT não pode criar a SEGUNDA alternativa correta', async () => {
    // A regra de "uma alternativa correta" contava o estado ANTES da
    // mudança — num INSERT, a contagem "antes" é a do item, e uma segunda
    // correta entrava sem ninguém reclamar.
    const prova = await criarProvaDeTeste(db, 'insert');
    const err = await recusa(db, () =>
      db.query(
        `INSERT INTO learning.item_option (item_id, ordinal, body, is_correct)
         SELECT item_id, 'E', 'texto', true FROM learning.item_option
          WHERE item_id = $1 AND ordinal = 'A'`,
        [prova.q1ItemId]
      )
    );
    assert.ok(err, 'a segunda alternativa correta tem de ser recusada');
    const n = await one(db, `SELECT count(*)::int AS n FROM learning.item_option WHERE item_id=$1 AND is_correct`, [prova.q1ItemId]);
    assert.equal(n.n, 1, 'o item continua com uma alternativa correta');
  });

  await t.test('o conflito de número contra a TRILHA vale para qualquer gabarito', async () => {
    // O número de questões é fato da PROVA, não do gabarito: uma variante
    // PRELIMINAR com 30 questões numa trilha que declara 50 é conflito do
    // mesmo jeito. (O QA furava a regra por aqui.)
    const questoes50 = Array.from({ length: 50 }, (_, i) => ({ n: i + 1, gabarito: ['A', 'B', 'C', 'D'][i % 4] }));
    const p1 = payloadAcervo({
      id: 'cfc_suf_2031_1_T01', ano: 2031, edicao: 1, tipo: 'T01',
      questoes: questoes50
    });
    await one(db, `SELECT ops.import_corpus_form($1::jsonb) AS id`, [JSON.stringify(p1)]);

    const questoes30 = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, gabarito: ['A', 'B', 'C', 'D'][i % 4] }));
    const p2 = payloadAcervo({
      id: 'cfc_suf_2031_1_T02', ano: 2031, edicao: 1, tipo: 'T02',
      gabarito: 'preliminary', questoes: questoes30
    });
    const err = await recusa(db, () => db.query(`SELECT ops.import_corpus_form($1::jsonb)`, [JSON.stringify(p2)]));
    assert.ok(err, '30 questões numa trilha que declara 50 é conflito');
    assert.ok(menciona(err, 'Conflito') || menciona(err, 'conflito'), `a mensagem tem que dizer que é conflito: ${err?.message}`);
  });

  await t.test('a rodada da Suficiência recebe o número extraído do acervo', async () => {
    // A prova É a fonte do número de questões dela. Sem isto, o conflito
    // ficaria desligado quando a primeira variante a chegar é de EQT.
    const eqt = Array.from({ length: 25 }, (_, i) => ({ n: i + 1, gabarito: ['A', 'B', 'C', 'D'][i % 4] }));
    const pEqt = payloadAcervo({
      id: 'cfc_eqt_2032_1_CVM_T01', ano: 2032, edicao: 1, tipo: 'T01', examType: 'CVM', questoes: eqt
    });
    await one(db, `SELECT ops.import_corpus_form($1::jsonb) AS id`, [JSON.stringify(pEqt)]);
    const antes = await one(db, `SELECT question_count FROM taxonomy.exam_edition WHERE code='2032.1'`);
    assert.equal(antes.question_count, null, 'a rodada ainda não tem número: só a EQT chegou');

    const suf = Array.from({ length: 50 }, (_, i) => ({ n: i + 1, gabarito: ['A', 'B', 'C', 'D'][i % 4] }));
    const pSuf = payloadAcervo({
      id: 'cfc_suf_2032_1_T01', ano: 2032, edicao: 1, tipo: 'T01', questoes: suf
    });
    await one(db, `SELECT ops.import_corpus_form($1::jsonb) AS id`, [JSON.stringify(pSuf)]);
    const depois = await one(db, `SELECT question_count FROM taxonomy.exam_edition WHERE code='2032.1'`);
    assert.equal(Number(depois.question_count), 50, 'a rodada da Suficiência passa a ter o número extraído');
  });
});
