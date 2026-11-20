// =============================================================================
// PROVAS DE RECUSA — VISÃO DE USUÁRIO (SUPORTE)
// -----------------------------------------------------------------------------
// O staff NÃO "é" o aluno. Ele lê o dado do aluno COMO o aluno, sob uma
// concessão com MOTIVO e PRAZO, e tudo que ele vê fica registrado.
//
// Três portas, três recusas:
//   1. sem motivo  → o banco recusa a concessão
//   2. prazo > 72h → o banco recusa a concessão
//   3. concessão inválida/vencida → a PORTA recusa a leitura e audita
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDb, one, rows, recusa, menciona, criarConta, primeiroAssunto } from './helpers.mjs';

const MOTIVO = 'Chamado aberto pelo suporte para investigating o progresso do aluno.';

test('visão de usuário (suporte)', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('concessão sem motivo suficiente é recusada', async () => {
    const staff = await criarConta(db, 'staff-sem-motivo@test.invalid');
    const aluno = await criarConta(db, 'alvo-sem-motivo@test.invalid');

    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
         VALUES ($1,$2,'curto', now() + interval '1 hour')`,
        [staff, aluno]
      )
    );
    assert.ok(err, 'motivo com menos de 10 caracteres deveria ser recusado');
  });

  await t.test('concessão com prazo acima de 72h é recusada', async () => {
    const staff = await criarConta(db, 'staff-72h@test.invalid');
    const aluno = await criarConta(db, 'alvo-72h@test.invalid');

    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
         VALUES ($1,$2,$3, now() + interval '73 hours')`,
        [staff, aluno, MOTIVO]
      )
    );
    assert.ok(err, 'prazo acima de 72h deveria ser recusado');
    assert.ok(menciona(err, 'ck_grant_max_duration') || menciona(err, '72'), `mensagem: ${err.message}`);
  });

  await t.test('concessão no limite de 72h é aceita', async () => {
    const staff = await criarConta(db, 'staff-72h-ok@test.invalid');
    const aluno = await criarConta(db, 'alvo-72h-ok@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '72 hours') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    assert.ok(g.id);
  });

  await t.test('a concessão vencida é recusada pela porta de leitura', async () => {
    const staff = await criarConta(db, 'staff-vencida@test.invalid');
    const aluno = await criarConta(db, 'alvo-vencida@test.invalid');
    const assunto = await primeiroAssunto(db);

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    // Vence a concessão. Não dá para INSERIR já vencida: a constraint
    // ck_grant_expiry recusa (expires_at > granted_at). Vence-se
    // recuando o granted_at.
    await db.exec(
      `UPDATE admin.support_access_grant
          SET granted_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        WHERE id=$1`,
      [g.id]
    );

    const err = await recusa(db, () =>
      db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, aluno, g.id])
    );
    assert.ok(err, 'concessão vencida deveria ser recusada');
    assert.ok(menciona(err, 'expirada') || menciona(err, 'revogada'), `mensagem: ${err.message}`);
  });

  await t.test('a concessão revogada é recusada pela porta de leitura', async () => {
    const staff = await criarConta(db, 'staff-revogada@test.invalid');
    const aluno = await criarConta(db, 'alvo-revogada@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    await db.exec(
      `UPDATE admin.support_access_grant SET revoked_at = now(), revoke_reason='ticket encerrado' WHERE id=$1`,
      [g.id]
    );

    const err = await recusa(db, () =>
      db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, aluno, g.id])
    );
    assert.ok(err, 'concessão revogada deveria ser recusada');
  });

  await t.test('a concessão de OUTRO staff não abre a porta', async () => {
    const staffA = await criarConta(db, 'staff-a@test.invalid');
    const staffB = await criarConta(db, 'staff-b@test.invalid');
    const aluno = await criarConta(db, 'alvo-outro-staff@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staffA, aluno, MOTIVO]
    );
    const err = await recusa(db, () =>
      db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staffB, aluno, g.id])
    );
    assert.ok(err, 'concessão de outro staff deveria ser recusada');
    assert.ok(menciona(err, 'não pertence a este staff'), `mensagem: ${err.message}`);
  });

  await t.test('a concessão não cobre outro titular', async () => {
    const staff = await criarConta(db, 'staff-titular@test.invalid');
    const alvo = await criarConta(db, 'alvo-cobierto@test.invalid');
    const outro = await criarConta(db, 'alvo-nao-cobierto@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, alvo, MOTIVO]
    );
    const err = await recusa(db, () =>
      db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, outro, g.id])
    );
    assert.ok(err, 'concessão não deveria cobrir outro titular');
    assert.ok(menciona(err, 'não cobre este titular'), `mensagem: ${err.message}`);
  });

  await t.test('escopo insuficiente é recusado', async () => {
    const staff = await criarConta(db, 'staff-escopo@test.invalid');
    const aluno = await criarConta(db, 'alvo-escopo@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, scope, reason, expires_at)
       VALUES ($1,$2,'conta',$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    const err = await recusa(db, () =>
      db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, aluno, g.id])
    );
    assert.ok(err, 'escopo "conta" não deveria permitir ler progresso');
    assert.ok(menciona(err, 'não permite ler progresso'), `mensagem: ${err.message}`);
  });

  await t.test('leitura válida é permitida E registrada', async () => {
    const staff = await criarConta(db, 'staff-ok@test.invalid');
    const aluno = await criarConta(db, 'alvo-ok@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    await db.exec(`SELECT * FROM admin.read_user_progress_as($1,$2,$3)`, [staff, aluno, g.id]);

    const log = await rows(
      db,
      `SELECT resource, action FROM admin.support_access_log WHERE grant_id=$1`,
      [g.id]
    );
    assert.equal(log.length, 1, 'a leitura deveria ter sido registrada');
    assert.equal(log[0].resource, 'learning.mastery');
    assert.equal(log[0].action, 'leitura');
  });

  await t.test('a concessão expira SOZINHA (sem depender de job)', async () => {
    const staff = await criarConta(db, 'staff-auto@test.invalid');
    const aluno = await criarConta(db, 'alvo-auto@test.invalid');

    const g = await one(
      db,
      `INSERT INTO admin.support_access_grant (staff_user_id, subject_user_id, reason, expires_at)
       VALUES ($1,$2,$3, now() + interval '1 hour') RETURNING id`,
      [staff, aluno, MOTIVO]
    );
    // Passa a data de vencimento para o passado.
    await db.exec(
      `UPDATE admin.support_access_grant
          SET granted_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        WHERE id=$1`,
      [g.id]
    );
    // O trigger de expiração roda no UPDATE — a concessão morre sozinha.
    const depois = await one(
      db,
      `SELECT revoked_at, revoke_reason FROM admin.support_access_grant WHERE id=$1`,
      [g.id]
    );
    assert.ok(depois.revoked_at, 'a concessão vencida deveria estar revogada automaticamente');
    assert.ok(depois.revoke_reason);
  });
});
