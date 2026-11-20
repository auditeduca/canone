// =============================================================================
// PROVAS DE RECUSA — INTEGRIDADE EDITORIAL
// -----------------------------------------------------------------------------
// A tese do Cânone: o BANCO recusa, não a aplicação. Se estas provas caírem,
// o schema virou uma sugestão.
//
// NOTA DE SEMÂNTICA (aprendida rodando os testes, não desenhando):
//   a transição em_revisao → verificado JÁ exige editorial.verification com
//   state='verificada'. Ou seja: não se marca um item como "verificado" sem
//   antes registrar a evidência. A verificação É a prova da transição.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona,
  criarConta, criarQuestao, criarFonte, criarVerificacao, tipoConteudo
} from './helpers.mjs';

/** Move o item pelo caminho feliz, criando a verificação antes do 'verificado'. */
async function publicar(db, { key, autor, fonte, quote = 'Art. 1º. O texto da norma.', validUntil = null, opcoes }) {
  const q = await criarQuestao(db, { key, autor, opcoes });
  await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [q.contentItemId]);
  if (fonte) {
    await criarVerificacao(db, {
      contentItemId: q.contentItemId,
      sourceId: fonte.id,
      quote,
      validUntil,
      autor
    });
  }
  return q;
}

test('integridade editorial', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('não se marca "verificado" sem verificação de fonte', async () => {
    const autor = await criarConta(db, 'editor-sem-verificacao@test.invalid');
    const q = await publicar(db, { key: 'q-sem-verificacao', autor, fonte: null });

    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'deveria ser recusado marcar como verificado sem verificação');
    assert.ok(menciona(err, 'sem verificação de fonte vigente'), `mensagem: ${err.message}`);
  });

  await t.test('publicar sem verificação vigente é recusado', async () => {
    const autor = await criarConta(db, 'editor-pub-sem-verif@test.invalid');
    const q = await publicar(db, { key: 'q-pub-sem-verif', autor, fonte: null });

    // Atalho: rascunho → publicado. Recusado pela transição E pela
    // ausência de verificação. O que importa é que foi recusado.
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'a publicação sem verificação deveria ter sido recusada');
  });

  await t.test('publicar com verificação vigente é aceito e carimba published_at', async () => {
    const autor = await criarConta(db, 'editor-com-verificacao@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-ok', quote: 'Art. 1º. O texto da norma.' });
    const q = await publicar(db, { key: 'q-com-verificacao', autor, fonte });

    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId]);
    await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [q.contentItemId]);

    const item = await one(db, `SELECT state, published_at FROM editorial.content_item WHERE id=$1`, [
      q.contentItemId
    ]);
    assert.equal(item.state, 'publicado');
    assert.ok(item.published_at, 'published_at deveria ter sido carimbado');
  });

  await t.test('verificação expirada bloqueia a publicação', async () => {
    const autor = await criarConta(db, 'editor-expirado@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-expirada' });
    const q = await publicar(db, {
      key: 'q-expirado',
      autor,
      fonte,
      validUntil: new Date(Date.now() - 86_400_000).toISOString() // ontem
    });

    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'verificação vencida deveria bloquear');
    assert.ok(menciona(err, 'sem verificação de fonte vigente'), `mensagem: ${err.message}`);
  });

  await t.test('verificação sem trecho literal é recusada pelo próprio schema', async () => {
    const autor = await criarConta(db, 'editor-sem-trecho@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-sem-trecho' });
    const q = await criarQuestao(db, { key: 'q-sem-trecho', autor });

    const err = await recusa(db, () =>
      criarVerificacao(db, {
        contentItemId: q.contentItemId,
        sourceId: fonte.id,
        quote: null, // state='verificada' exige source_quote
        autor
      })
    );
    assert.ok(err, 'verificação verificada sem trecho deveria ser recusada');
  });

  await t.test('item com DUAS alternativas corretas é recusado na projeção', async () => {
    const autor = await criarConta(db, 'editor-dupla@test.invalid');
    const err = await recusa(db, () =>
      criarQuestao(db, {
        key: 'q-dupla-correta',
        autor,
        opcoes: [
          { ordinal: 'A', body: 'A', correct: true },
          { ordinal: 'B', body: 'B', correct: true },
          { ordinal: 'C', body: 'C', correct: false },
          { ordinal: 'D', body: 'D', correct: false }
        ]
      })
    );
    assert.ok(err, 'duas alternativas corretas deveriam ser recusadas');
    assert.ok(menciona(err, 'corretas'), `mensagem inesperada: ${err.message}`);
  });

  await t.test('publicar item sem NENHUMA alternativa correta é recusado', async () => {
    const autor = await criarConta(db, 'editor-zero@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-zero' });
    const { contentTypeId, versionId } = await tipoConteudo(db, 'questao');
    const item = await one(
      db,
      `INSERT INTO editorial.content_item
         (content_type_id, content_type_version_id, key, state, title, created_by)
       VALUES ($1,$2,'q-zero-correta','rascunho','Item sem gabarito',$3) RETURNING id`,
      [contentTypeId, versionId, autor]
    );
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [item.id]);
    await criarVerificacao(db, {
      contentItemId: item.id,
      sourceId: fonte.id,
      quote: 'Trecho.',
      autor
    });
    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [item.id]);

    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [item.id])
    );
    assert.ok(err, 'publicar item sem alternativa correta deveria falhar');
    assert.ok(
      menciona(err, 'corretas') || menciona(err, 'exige exatamente 1'),
      `mensagem: ${err.message}`
    );
  });

  await t.test('transição fora da tabela é recusada', async () => {
    const autor = await criarConta(db, 'editor-transicao@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-transicao' });
    const q = await publicar(db, { key: 'q-transicao', autor, fonte });
    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId]);
    await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [q.contentItemId]);

    // 'publicado' → 'rascunho' NÃO está em editorial.state_transition.
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='rascunho' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'atalho de transição deveria ser recusado');
    assert.ok(menciona(err, 'Transição não permitida') || menciona(err, 'state_transition'), `mensagem: ${err.message}`);
  });

  await t.test('estado inexistente para a família é recusado', async () => {
    const autor = await criarConta(db, 'editor-estado@test.invalid');
    const q = await criarQuestao(db, { key: 'q-estado-invalido', autor });
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='aprovado' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'estado fora do catálogo deveria ser recusado');
  });

  await t.test('a projeção relacional é DERIVADA do payload (dual-write impossível)', async () => {
    const autor = await criarConta(db, 'editor-projecao@test.invalid');
    const q = await criarQuestao(db, { key: 'q-projecao', autor });

    const opts = await rows(
      db,
      `SELECT ordinal, body, is_correct FROM learning.item_option WHERE item_id=$1 ORDER BY ordinal_pos`,
      [q.itemId]
    );
    assert.equal(opts.length, 4, 'a projeção deveria ter as 4 alternativas do payload');
    assert.equal(opts.filter((o) => o.is_correct).length, 1);
    assert.equal(opts[0].ordinal, 'A');

    // Trocar o payload deve TROCAR a projeção — sem ninguém escrever em
    // learning.item_option.
    await db.exec(
      `UPDATE editorial.content_item_version
          SET payload = jsonb_set(payload, '{options,1,body}', '"Alternativa B reescrita"'::jsonb)
        WHERE id=$1`,
      [q.versionId]
    );
    const opts2 = await rows(
      db,
      `SELECT body FROM learning.item_option WHERE item_id=$1 AND ordinal='B'`,
      [q.itemId]
    );
    assert.equal(opts2[0].body, 'Alternativa B reescrita',
      'a projeção deveria ter acompanhado o payload');
  });

  await t.test('o histórico de transição de estado é gravado', async () => {
    const autor = await criarConta(db, 'editor-historico@test.invalid');
    const q = await criarQuestao(db, { key: 'q-historico', autor });
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [q.contentItemId]);

    const rev = await rows(
      db,
      `SELECT from_state, to_state FROM editorial.content_revision WHERE content_item_id=$1`,
      [q.contentItemId]
    );
    assert.equal(rev.length, 1);
    assert.equal(rev[0].from_state, 'rascunho');
    assert.equal(rev[0].to_state, 'em_revisao');
  });

  await t.test('a verificação publicada não é alterada por uma linha mais recente recusada', async () => {
    // Regressão do bug do SELECT sem ORDER BY: com várias verificações, o
    // gate pegava uma linha ARBITRÁRIA.
    const autor = await criarConta(db, 'editor-multi-verif@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-multi' });
    const q = await publicar(db, { key: 'q-multi-verif', autor, fonte });

    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId]);
    await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [q.contentItemId]);

    // Uma recusa posterior NÃO pode invalidar a publicação já concreta.
    await criarVerificacao(db, {
      contentItemId: q.contentItemId,
      sourceId: fonte.id,
      state: 'rejeitada',
      quote: 'Recusado depois.',
      autor
    });
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='necessita_atualizacao' WHERE id=$1`, [q.contentItemId])
    );
    // A transição publicado→necessita_atualizacao EXISTE e não exige
    // verificação: deve passar. Se fosse barrado, o gate estaria misturando
    // linhas de verificação ao acaso.
    assert.equal(err, null, `não deveria ter barrado: ${err?.message}`);
  });
});
