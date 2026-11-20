// =============================================================================
// PROVAS DE RECUSA — AUDITORIA
// -----------------------------------------------------------------------------
// O log de auditoria é append-only E encadeado por hash. A segunda parte é
// a que importa: um log que alguém possa reescrever sem deixar rastro é
// só um log.
//
// Cada linha guarda o hash da anterior. Adulterar uma linha quebra a cadeia
// a partir dela, e audit.verify_chain() diz ONDE.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDb, one, rows, recusa, menciona, criarConta } from './helpers.mjs';

async function registrar(db, { action, entityType, entityId, actorId = null }) {
  return one(
    db,
    `INSERT INTO audit.audit_log (action, entity_type, entity_id, actor_id)
     VALUES ($1,$2,$3,$4) RETURNING id, seq, prev_hash, row_hash`,
    [action, entityType, entityId, actorId]
  );
}

test('auditoria encadeada', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('UPDATE no log é recusado', async () => {
    await registrar(db, { action: 'criar', entityType: 'teste', entityId: '1' });
    const err = await recusa(db, () =>
      db.exec(`UPDATE audit.audit_log SET action = 'alterado'`)
    );
    assert.ok(err, 'editar o log de auditoria deveria ser recusado');
    assert.ok(menciona(err, 'append-only'), `mensagem: ${err.message}`);
  });

  await t.test('DELETE no log é recusado', async () => {
    await registrar(db, { action: 'criar', entityType: 'teste', entityId: '2' });
    const err = await recusa(db, () => db.exec(`DELETE FROM audit.audit_log`));
    assert.ok(err, 'apagar o log de auditoria deveria ser recusado');
  });

  await t.test('cada linha guarda o hash da anterior', async () => {
    const a = await registrar(db, { action: 'criar', entityType: 'teste', entityId: '3' });
    const b = await registrar(db, { action: 'criar', entityType: 'teste', entityId: '4' });
    assert.equal(b.prev_hash, a.row_hash, 'a segunda linha deveria apontar para a primeira');
  });

  await t.test('a cadeia íntegra não acusa nada', async () => {
    await registrar(db, { action: 'criar', entityType: 'teste', entityId: '5' });
    const quebradas = await rows(db, `SELECT * FROM audit.verify_chain()`);
    assert.equal(quebradas.length, 0, 'a cadeia deveria estar íntegra');
  });

  await t.test('a verificação PARCIAL não acusa falso positivo', async () => {
    // Regressão: com p_from, o lag() era calculado sobre o recorte e a
    // primeira linha do recorte acusava cadeia quebrada. O verificador
    // mentia — e um verificador que mente é pior do que nenhum.
    const todas = await rows(db, `SELECT seq FROM audit.audit_log ORDER BY seq`);
    assert.ok(todas.length >= 2, 'precisa de linhas para testar');
    const meio = todas[Math.floor(todas.length / 2)].seq;

    const quebradas = await rows(db, `SELECT * FROM audit.verify_chain($1)`, [meio]);
    assert.equal(quebradas.length, 0, 'verificação parcial não deveria acusar nada');
  });

  await t.test('a adulteração de uma linha é DETECTADA', async () => {
    const antes = await rows(db, `SELECT * FROM audit.verify_chain()`);
    assert.equal(antes.length, 0);

    // Simula quem tem acesso direto ao banco e desliga o trigger para
    // reescrever o histórico — o cenário que a cadeia de hash existe para
    // tornar visível.
    // Desliga os DOIS triggers: o do hash e o que bloqueia UPDATE.
    await db.exec(`ALTER TABLE audit.audit_log DISABLE TRIGGER trg_audit_hash`);
    await db.exec(`ALTER TABLE audit.audit_log DISABLE TRIGGER trg_audit_no_update`);
    try {
      await db.exec(
        `UPDATE audit.audit_log SET action = 'reescrito' WHERE seq = (SELECT min(seq) FROM audit.audit_log)`
      );
    } finally {
      await db.exec(`ALTER TABLE audit.audit_log ENABLE TRIGGER trg_audit_hash`);
      await db.exec(`ALTER TABLE audit.audit_log ENABLE TRIGGER trg_audit_no_update`);
    }

    const quebradas = await rows(db, `SELECT * FROM audit.verify_chain()`);
    assert.ok(quebradas.length > 0, 'a adulteração deveria ter sido detectada');
    assert.ok(quebradas[0].expected !== quebradas[0].found, 'o verificador deveria apontar a divergência');
  });

  await t.test('o hash é o mesmo para a MESMA linha (reprodutível)', async () => {
    // Timestamp FIXO: com now() as duas chamadas seriam de instantes
    // diferentes e o hash (corretamente) mudaria.
    const h1 = await one(
      db,
      `SELECT audit.compute_row_hash(NULL,'ação','entidade','1',NULL,NULL,'{"a":1}'::jsonb,
         '2026-10-24 12:00:00+00'::timestamptz) AS h`
    );
    const h2 = await one(
      db,
      `SELECT audit.compute_row_hash(NULL,'ação','entidade','1',NULL,NULL,'{"a":1}'::jsonb,
         '2026-10-24 12:00:00+00'::timestamptz) AS h`
    );
    assert.equal(h1.h.length, 64, 'o hash deveria ter 64 hex');
    assert.equal(h1.h, h2.h, 'mesma entrada, mesmo hash');
  });

  await t.test('o ator da ação é registrado', async () => {
    const staff = await criarConta(db, 'auditor@test.invalid');
    const l = await registrar(db, {
      action: 'conceder_visao', entityType: 'admin.support_access_grant', entityId: 'x', actorId: staff
    });
    const lido = await one(db, `SELECT actor_id, action FROM audit.audit_log WHERE id=$1`, [l.id]);
    assert.equal(lido.actor_id, staff);
    assert.equal(lido.action, 'conceder_visao');
  });
});
