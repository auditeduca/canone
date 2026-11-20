#!/usr/bin/env node
/**
 * GERADOR DA TABELA DE PREÇOS DO APP
 * ============================================================================
 * O app NÃO escreve o preço. O preço é DADO, no banco, com a sua origem ao
 * lado (commerce.plan.price_cents + price_source) — e este script leva o
 * dado do banco para o app.
 *
 * Por que gerar em vez de escrever à mão:
 *   · o preço muda no banco quando o comercial decide; o app tem que mudar
 *     junto, no mesmo instante — e sem ninguém lembrar;
 *   · um preço escrito à mão no app e outro no banco divergem em silêncio,
 *     e quem descobre é o cliente, no checkout;
 *   · a origem do preço viaja junto (price_source). O app não mostra um
 *     número, mostra um número COM a procedência no código.
 *
 * Um preço sem origem não entra: o gerador falha se o plano tiver preço e
 * não tiver price_source.
 *
 * Uso:  node scripts/gerar-precos.mjs [destino]
 *        (default: ../app/src/content/precos.ts)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { splitSql } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIGRATIONS = join(ROOT, 'db', 'migrations');
const destino = resolve(ROOT, process.argv[2] ?? '../app/src/content/precos.ts');

const db = await PGlite.create({ extensions: { citext, pg_trgm, btree_gist } });
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  for (const stmt of splitSql(readFileSync(join(MIGRATIONS, f), 'utf8'))) {
    await db.exec(stmt);
  }
}

const planos = await db.query(`
  SELECT p.key, p.name, p.description, p.billing_period, p.price_cents,
         p.price_source, p.currency, p.trial_days, p.sort_order,
         COALESCE(
           (SELECT json_agg(json_build_object('chave', pf.feature_key,
                                              'limite', pf.limit_value,
                                              'ativo', pf.enabled)
                           ORDER BY pf.feature_key)
              FROM commerce.plan_feature pf WHERE pf.plan_id = p.id),
           '[]'::json
         ) AS features
    FROM commerce.plan p
   WHERE p.is_public AND p.is_active
   ORDER BY p.sort_order
`);

/** "R$ 15,00/mês" — o rótulo que a pessoa lê. */
function rotulo(plan) {
  if (plan.price_cents === null) return null;
  const valor = (plan.price_cents / 100).toFixed(2).replace('.', ',');
  const por =
    plan.billing_period === 'mensal' ? '/mês'
    : plan.billing_period === 'anual' ? '/ano'
    : plan.billing_period === 'semestral' ? '/semestre'
    : plan.billing_period === 'vitalicio' ? '/vitalício'
    : `/${plan.billing_period}`;
  return `R$ ${valor}${por}`;
}

/** Um preço sem origem é um número sem fonte — não sai daqui. */
const semOrigem = planos.rows.filter((p) => p.price_cents !== null && !p.price_source);
if (semOrigem.length > 0) {
  console.error(
    `✗ preço sem origem: ${semOrigem.map((p) => p.key).join(', ')} — commerce.plan.price_source está vazio.`
  );
  process.exit(1);
}

/** Só o que pode ser vendido: preço definido. Plano sem preço não entra na vitrine. */
const vitrine = planos.rows.filter((p) => p.price_cents !== null);

const linhas = [];
linhas.push(`/* eslint-disable */`);
linhas.push(`// ARQUIVO GERADO. NÃO EDITE.`);
linhas.push(`//`);
linhas.push(`// Fonte: commerce.plan (schema do Cânone) — o preço e a origem de cada`);
linhas.push(`// plano vêm do banco. Gerado por backend/scripts/gerar-precos.mjs.`);
linhas.push(`// O teste \`13-preco\` confere que este arquivo está em dia: preço escrito`);
linhas.push(`// à mão no app mente, e o cliente descobre a mentira no checkout.`);
linhas.push(``);
linhas.push(`export interface PrecoPlano {`);
linhas.push(`  key: string;`);
linhas.push(`  nome: string;`);
linhas.push(`  descricao: string | null;`);
linhas.push(`  periodo: 'mensal' | 'anual' | 'semestral' | 'vitalicio';`);
linhas.push(`  centavos: number;`);
linhas.push(`  rotulo: string;`);
linhas.push(`  /** A origem do preço, como está no banco. Sem origem, o preço não sai. */`);
linhas.push(`  origem: string;`);
linhas.push(`  diasDeTeste: number;`);
linhas.push(`  destaque: boolean;`);
linhas.push(`  recursos: { chave: string; limite: number | null; ativo: boolean }[];`);
linhas.push(`}`);
linhas.push(``);
linhas.push(`export const PLANOS: PrecoPlano[] = [`);
for (const p of vitrine) {
  linhas.push(`  {`);
  linhas.push(`    key: ${JSON.stringify(p.key)},`);
  linhas.push(`    nome: ${JSON.stringify(p.name)},`);
  linhas.push(`    descricao: ${JSON.stringify(p.description)},`);
  linhas.push(`    periodo: ${JSON.stringify(p.billing_period)},`);
  linhas.push(`    centavos: ${p.price_cents},`);
  linhas.push(`    rotulo: ${JSON.stringify(rotulo(p))},`);
  linhas.push(`    // Fonte: ${JSON.stringify(p.price_source)}`);
  linhas.push(`    origem: ${JSON.stringify(p.price_source)},`);
  linhas.push(`    diasDeTeste: ${p.trial_days},`);
  linhas.push(`    destaque: ${p.key === 'anual'},`);
  linhas.push(`    recursos: ${JSON.stringify(p.features)},`);
  linhas.push(`  },`);
}
linhas.push(`];`);
linhas.push(``);
linhas.push(`/** O plano em destaque (o anual). O app usa este para o cartão principal. */`);
linhas.push(`export const PLANO_DESTAQUE = PLANOS.find((p) => p.destaque) ?? PLANOS[0];`);
linhas.push(``);

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, linhas.join('\n'), 'utf8');
console.log(
  `Tabela de preços gerada: ${vitrine.length} plano(s) com preço → ${destino}`
);
for (const p of vitrine) console.log(`  ${p.key}: ${rotulo(p)}`);
await db.close();
