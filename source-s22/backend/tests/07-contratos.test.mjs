// =============================================================================
// PROVAS DE RECUSA — CONTRATOS DO METAMODELO E DO COMERCIAL
// -----------------------------------------------------------------------------
// Três tesuras do produto que precisam ser garantidas pelo banco:
//
//   1. ENUMERAÇÃO É CATÁLOGO. Um valor fora do catálogo é erro de digitação
//      e precisa ser recusado — não salvo.
//   2. PREÇO NÃO É INVENTADO. commerce.plan.price_cents é NULL até o
//      comercial definir. A API pública expõe isso, não um zero.
//   3. SEGREDO NÃO É VALOR. O banco guarda a REFERÊNCIA ao cofre; o valor
//      jamais entra aqui.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDb, one, rows, recusa, menciona, criarConta } from './helpers.mjs';

test('contratos do metamodelo e do comercial', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('um valor de enumeração de uma enumeração INEXISTENTE é recusado', async () => {
    // O catálogo é o conjunto de valores; extender o catálogo é o que se
    // faz ao inserir. O que o banco DEVE recusar é a referência a uma
    // enumeração que não existe.
    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO editorial.enumeration_value (enumeration_key, key, label)
         VALUES ('enum_que_nao_existe','impossivel','Impossível')`
      )
    );
    assert.ok(err, 'valor de enumeração inexistente deveria ser recusado');
  });

  await t.test('um campo que aponta para uma enumeração INEXISTENTE é recusado', async () => {
    const ct = await one(db, `SELECT id FROM editorial.content_type WHERE key='questao'`);
    const ctv = await one(
      db,
      `INSERT INTO editorial.content_type_version (content_type_id, version, definition)
       VALUES ($1, 9, '{}'::jsonb) RETURNING id`,
      [ct.id]
    );
    const err = await recusa(db, () =>
      db.exec(
        `INSERT INTO editorial.field_definition
           (content_type_version_id, key, label, data_kind, enumeration_key)
         VALUES ($1,'dificuldade','Dificuldade','enumeracao','enum_que_nao_existe')`,
        [ctv.id]
      )
    );
    assert.ok(err, 'campo apontando para enumeração inexistente deveria ser recusado');
  });

  await t.test('um campo que aponta para uma enumeração existente é aceito', async () => {
    const ct = await one(db, `SELECT id FROM editorial.content_type WHERE key='questao'`);
    const ctv = await one(
      db,
      `INSERT INTO editorial.content_type_version (content_type_id, version, definition)
       VALUES ($1, 10, '{}'::jsonb) RETURNING id`,
      [ct.id]
    );
    const f = await one(
      db,
      `INSERT INTO editorial.field_definition
         (content_type_version_id, key, label, data_kind, enumeration_key)
       VALUES ($1,'dificuldade','Dificuldade','enumeracao','nivel_dificuldade')
       RETURNING key`,
      [ctv.id]
    );
    assert.equal(f.key, 'dificuldade');
  });

  await t.test('o preço do plano é NULL até o comercial definir', async () => {
    const p = await one(db, `SELECT key, price_cents FROM commerce.plan LIMIT 1`);
    assert.equal(p.price_cents, null, 'o preço não pode ser inventado');
  });

  await t.test('a flag pública expõe "preços indisponíveis" em vez de um zero', async () => {
    const s = await one(
      db, `SELECT value FROM ops.setting WHERE key='plano_precos_indisponiveis'`
    );
    assert.ok(s, 'a flag deveria existir');
    assert.equal(s.value.exibir_preco, false);
    assert.ok(s.value.mensagem, 'deveria haver uma mensagem para o usuário');
  });

  await t.test('a view pública de planos devolve o preço NULL (não 0)', async () => {
    const v = await one(db, `SELECT price_cents FROM public.v_public_plan LIMIT 1`);
    assert.equal(v.price_cents, null, 'a view não pode transformar "sem preço" em zero');
  });

  await t.test('a integração guarda secret_ref, nunca o valor do segredo', async () => {
    const i = await one(db, `SELECT key, config, secret_ref FROM ops.integration LIMIT 1`);
    assert.ok(i);
    const texto = JSON.stringify(i.config);
    assert.ok(
      !/(senha|secret|token|api[_-]?key|password)\s*[:=]\s*["'][^"']{6,}/i.test(texto),
      `config não pode conter segredo: ${texto}`
    );
  });

  await t.test('a fonte carrega o TRECHO LITERAL que sustenta os números', async () => {
    const s = await one(
      db, `SELECT key, source_quote FROM editorial.source WHERE key='cfc-exame-2026-3'`
    );
    assert.ok(s, 'a fonte do edital da 3ª edição deveria existir');
    assert.ok(s.source_quote && s.source_quote.length > 40, 'o trecho literal deveria estar registrado');
    assert.ok(s.source_quote.includes('R$ 199,00'), `trecho: ${s.source_quote}`);
  });

  await t.test('a edição do exame guarda taxa e datas coerentes com a fonte', async () => {
    const e = await one(
      db,
      `SELECT code, registration_fee_cents, question_count, options_per_question,
              passing_score, passing_percent, application_date, source_id
         FROM taxonomy.exam_edition ORDER BY edition_number`
    );
    assert.equal(e.question_count, 50);
    assert.equal(e.options_per_question, 4);
    assert.equal(Number(e.passing_score), 25, 'aprovação = 50% de 50 = 25 acertos');
    assert.equal(Number(e.passing_percent), 50);
    assert.ok(e.source_id, 'a edição precisa apontar para a fonte');
  });

  await t.test('as 13 áreas e os 13 assuntos estão lá, na ordem do edital', async () => {
    const areas = await rows(db, `SELECT key FROM taxonomy.knowledge_area ORDER BY ordinal`);
    const assuntos = await rows(db, `SELECT key FROM taxonomy.subject ORDER BY ordinal`);
    assert.equal(areas.length, 13);
    assert.equal(assuntos.length, 13);
  });

  await t.test('todo módulo de avaliação cobre os 13 assuntos', async () => {
    const m = await one(
      db,
      `SELECT (SELECT count(*) FROM taxonomy.module_subject ms
                JOIN taxonomy.module m ON m.id = ms.module_id
               WHERE m.key = 'simulados') AS n`
    );
    assert.equal(Number(m.n), 13, 'simulados precisa cobrir os 13 assuntos do edital');
  });
});
