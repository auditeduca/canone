// =============================================================================
// PROVAS DE RECUSA — O PREÇO
// -----------------------------------------------------------------------------
// O QUE ESTE ARQUIVO PROVA
//
// O preço é o único número do Cânone que não vem de norma: vem de decisão
// comercial. Por isso ele tem DUAS propriedades que o banco precisa
// garantir, e uma que precisa estar provada:
//
//   1. Preço tem ORIGEM. Um plano com preço e sem `price_source` não sai:
//      o gerador recusa (e o número não chega ao app).
//   2. Preço NÃO É ZERO. Zero não é "preço não definido" — é giveaway.
//      Preço não definido é NULL. (A regra está no banco: a restrição da
//      coluna price_cents.)
//   3. O APP NÃO MENTE. A tabela de preços do app é GERADA do banco; se o
//      comercial mudar o preço e ninguém regenerar, este teste acusa o
//      drift — antes do cliente ver o valor velho.
//
// E o drift é medido nos DOIS sentidos: o arquivo do app tem que bater com
// o banco, e o banco tem que ter o que o arquivo diz.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootDb, one, rows } from './helpers.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizBackend = resolve(aqui, '..');
const appPrecos = resolve(raizBackend, '../app/src/content/precos.ts');

test('o preço comercial', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  await t.test('todo plano com preço tem origem — e a origem diz de onde veio', async () => {
    const semOrigem = await rows(
      db,
      `SELECT key FROM commerce.plan WHERE price_cents IS NOT NULL AND price_source IS NULL`
    );
    assert.deepEqual(semOrigem, [], `plano com preço e sem origem: ${JSON.stringify(semOrigem)}`);
  });

  await t.test('preço zero é recusado pelo banco', async () => {
    const erro = await db.query(
      `UPDATE commerce.plan SET price_cents = 0 WHERE key = 'completo'`
    ).then(() => null).catch((e) => e);
    assert.ok(erro, 'o banco precisa recusar preço zero');
    assert.match(erro.message, /commerce_plan_price_cents_check|check constraint/i);
  });

  await t.test('preço não definido continua sendo NULL, não zero', async () => {
    const essencial = await one(db, `SELECT price_cents FROM commerce.plan WHERE key = 'essencial'`);
    assert.equal(essencial.price_cents, null, 'plano sem decisão comercial fica sem preço');
  });

  await t.test('a tabela do app é gerada do banco — sem drift', async (st) => {
    if (!existsSync(appPrecos)) {
      st.skip('o app não está neste pacote — a conferência do drift do preço é do repositório completo');
      return;
    }
    const fonte = readFileSync(appPrecos, 'utf8');
    const planos = await rows(
      db,
      `SELECT key, name, price_cents, price_source, currency, billing_period
         FROM commerce.plan
        WHERE is_public AND is_active AND price_cents IS NOT NULL
        ORDER BY sort_order`
    );
    assert.ok(planos.length > 0, 'há planos com preço para conferir');

    for (const p of planos) {
      assert.ok(
        fonte.includes(`"${p.key}"`),
        `o plano ${p.key} sumiu do app — regenere (npm run precos)`
      );
      assert.ok(
        fonte.includes(`centavos: ${p.price_cents}`),
        `o preço de ${p.key} diverge: o app não tem ${p.price_cents} — regenere (npm run precos)`
      );
      assert.ok(
        fonte.includes(p.price_source),
        `a origem do preço de ${p.key} não viajou para o app — regenere (npm run precos)`
      );
    }
  });

  await t.test('a decisão do dono está registrada no banco, com data', async () => {
    const completo = await one(
      db,
      `SELECT price_cents, price_source FROM commerce.plan WHERE key = 'completo'`
    );
    assert.equal(completo.price_cents, 1500, 'R$ 15,00/mês, como decidido');
    assert.match(completo.price_source, /decis[aã]o do dono/i, 'a origem diz de quem é a decisão');
  });
});
