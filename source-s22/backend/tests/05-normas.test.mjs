// =============================================================================
// PROVAS DE RECUSA — NORMAS E VIGÊNCIA
// -----------------------------------------------------------------------------
// A promessa do Cânone: se a norma muda, o que foi verificado contra a
// versão antiga NÃO continua valendo como se nada tivesse acontecido.
//
// O mecanismo: nova versão da norma → expira as verificações que a citam
// → abre a fila de moderação.
//
// BUG HISTÓRICO (achado por este teste): o trigger fazia JOIN com
// norms.norm_item por um id que era content_item. A citação nunca casava e
// o mecanismo central de integridade nunca disparou.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona,
  criarConta, criarQuestao, criarFonte, criarVerificacao, criarNorma
} from './helpers.mjs';

test('normas e vigência', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('só existe UMA versão vigente por norma', async () => {
    const { normId } = await criarNorma(db, { code: 'NORM-A' });
    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO norms.norm_version (norm_id, label, effective_from) VALUES ($1,'NORM-A (R2)', current_date)`,
        [normId]
      )
    );
    assert.ok(err, 'duas versões vigentes simultâneas deveriam ser recusadas');
  });

  await t.test('nova versão EXPIRA a verificação que a citava', async () => {
    const autor = await criarConta(db, 'autor-norma@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-norma' });
    const { normId, versionId: v1 } = await criarNorma(db, { code: 'NORM-B', sourceId: fonte.id });

    // Um item que cita a norma.
    const q = await criarQuestao(db, { key: 'item-cita-norma', autor });
    await db.exec(
      `INSERT INTO editorial.content_norm_citation
         (content_item_id, norm_id, norm_item_id, norm_version_id, quote, locator)
       VALUES ($1, $2, NULL, $3, 'Art. 1º da norma.', 'art. 1º')`,
      [q.contentItemId, normId, v1]
    );
    await criarVerificacao(db, {
      contentItemId: q.contentItemId, sourceId: fonte.id, quote: 'Art. 1º da norma.', autor
    });

    const antes = await one(
      db, `SELECT state FROM editorial.verification WHERE content_item_id=$1`, [q.contentItemId]
    );
    assert.equal(antes.state, 'verificada');

    // Fecha a v1 e abre a v2 — a v2 é o que dispara o mecanismo.
    await db.exec(`UPDATE norms.norm_version SET effective_to = current_date - 1 WHERE id=$1`, [v1]);
    await db.exec(
      `INSERT INTO norms.norm_version (norm_id, label, effective_from) VALUES ($1,'NORM-B (R2)', current_date)`,
      [normId]
    );

    const depois = await one(
      db, `SELECT state FROM editorial.verification WHERE content_item_id=$1`, [q.contentItemId]
    );
    assert.equal(depois.state, 'necessita_atualizacao',
      'a verificação deveria ter caducado quando a norma ganhou versão nova');
  });

  await t.test('nova versão ABRE a fila de moderação', async () => {
    const autor = await criarConta(db, 'autor-moderacao@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-moderacao' });
    const { normId, versionId: v1 } = await criarNorma(db, { code: 'NORM-C', sourceId: fonte.id });

    const q = await criarQuestao(db, { key: 'item-moderacao', autor });
    await db.exec(
      `INSERT INTO editorial.content_norm_citation
         (content_item_id, norm_id, norm_version_id, quote, locator)
       VALUES ($1, $2, $3, 'Trecho.', 'art. 2º')`,
      [q.contentItemId, normId, v1]
    );
    await criarVerificacao(db, {
      contentItemId: q.contentItemId, sourceId: fonte.id, quote: 'Trecho.', autor
    });

    await db.exec(`UPDATE norms.norm_version SET effective_to = current_date - 1 WHERE id=$1`, [v1]);
    await db.exec(
      `INSERT INTO norms.norm_version (norm_id, label, effective_from) VALUES ($1,'NORM-C (R2)', current_date)`,
      [normId]
    );

    const fila = await rows(
      db,
      `SELECT queue, reason, content_item_id FROM admin.moderation_queue WHERE content_item_id=$1`,
      [q.contentItemId]
    );
    assert.equal(fila.length, 1, 'deveria ter aberto a fila de moderação');
    assert.equal(fila[0].queue, 'expirada');
    assert.ok(fila[0].reason.includes('NORM-C'), `motivo: ${fila[0].reason}`);
  });

  await t.test('item NÃO citado não é expiroado', async () => {
    const autor = await criarConta(db, 'autor-nao-citado@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-nao-citado' });
    const { normId, versionId: v1 } = await criarNorma(db, { code: 'NORM-D', sourceId: fonte.id });

    // Item que NÃO cita a norma.
    const q = await criarQuestao(db, { key: 'item-nao-citado', autor });
    await criarVerificacao(db, {
      contentItemId: q.contentItemId, sourceId: fonte.id, quote: 'Trecho.', autor
    });

    await db.exec(`UPDATE norms.norm_version SET effective_to = current_date - 1 WHERE id=$1`, [v1]);
    await db.exec(
      `INSERT INTO norms.norm_version (norm_id, label, effective_from) VALUES ($1,'NORM-D (R2)', current_date)`,
      [normId]
    );

    const v = await one(db, `SELECT state FROM editorial.verification WHERE content_item_id=$1`, [
      q.contentItemId
    ]);
    assert.equal(v.state, 'verificada', 'item que não cita a norma não deveria ser expiroado');
  });

  await t.test('a verificação caducada bloqueia a publicação', async () => {
    const autor = await criarConta(db, 'autor-caducada@test.invalid');
    const fonte = await criarFonte(db, { key: 'fonte-caducada' });
    const { normId, versionId: v1 } = await criarNorma(db, { code: 'NORM-E', sourceId: fonte.id });

    const q = await criarQuestao(db, { key: 'item-caducada', autor });
    await db.exec(
      `INSERT INTO editorial.content_norm_citation
         (content_item_id, norm_id, norm_version_id, quote, locator)
       VALUES ($1,$2,$3,'Trecho.','art. 3º')`,
      [q.contentItemId, normId, v1]
    );
    await criarVerificacao(db, {
      contentItemId: q.contentItemId, sourceId: fonte.id, quote: 'Trecho.', autor
    });

    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [q.contentItemId]);
    await db.exec(`UPDATE norms.norm_version SET effective_to = current_date - 1 WHERE id=$1`, [v1]);
    await db.exec(
      `INSERT INTO norms.norm_version (norm_id, label, effective_from) VALUES ($1,'NORM-E (R2)', current_date)`,
      [normId]
    );

    // A verificação está em 'necessita_atualizacao' → não pode virar 'verificado'.
    const err = await recusa(db, () =>
      db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [q.contentItemId])
    );
    assert.ok(err, 'item com verificação caducada não pode ser verificado');
  });
});
