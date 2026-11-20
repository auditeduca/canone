#!/usr/bin/env node
/* ============================================================================
   PROVA DE FORMA DO ACERVO — o schema aguenta o acervo real inteiro?
   ---------------------------------------------------------------------------
   O acervo (provas_cfc, em outro ambiente) tem, segundo o catálogo:

     · 56 variantes de prova
     · 1.975 questões      (23 variantes de Suficiência × 50 + 33 da EQT × 25)
     · 1.941 com gabarito  → 34 questões ANULADAS
     · 43 gabaritos DEFINITIVOS e 13 PRELIMINARES (os 13 são a rodada 2026.2,
       cujo definitivo ainda não foi publicado)

   Este script MONTA esse acervo dentro do schema, pela MESMA porta da
   ingestão real (ops.import_corpus_form), e depois confere os invariantes.
   Não é teste de速度: é prova de que a ESTRUTURA comporta o acervo inteiro,
   com as anulações e o ciclo de vida dos gabaritos.

   A DISTRIBUIÇÃO POR RODADA é uma suposição do script (o acervo real está em
   outro ambiente e traz a distribuição exata). O que a prova fixa são os
   TOTAIS e a FORMA: 56 variantes, 1.975 questões, 34 anuladas, 43 definitivos,
   13 preliminares.

   Uso: node scripts/prova-forma-acervo.mjs
   ========================================================================== */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSql } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG = join(HERE, '..', 'db', 'migrations');

// -----------------------------------------------------------------------------
// A FORMA DO ACERVO
// -----------------------------------------------------------------------------
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

/**
 * 23 variantes de Suficiência (50 questões) e 33 da EQT (25 questões).
 * A rodada 2026.2 é a que tem só gabarito PRELIMINAR (13 variantes: 4 da
 * Suficiência e 9 da EQT) — é o que o acervo registra.
 */
function planoDoAcervo() {
  const rodadas = [];

  // SUFICIÊNCIA — 23 variantes de 50 questões.
  // As rodadas 2024.2, 2025.1, 2025.2, 2026.1 e 2026.2 têm 4 variantes
  // cada (20). As três primeiras rodadas do acervo têm uma variante cada
  // (3) — a DISTRIBUIÇÃO é suposição do script; o TOTAL (23) é o dado.
  const suf = [
    ['2022', 1, 1], ['2023', 1, 1], ['2024', 1, 1],
    ['2024', 2, 4], ['2025', 1, 4], ['2025', 2, 4], ['2026', 1, 4], ['2026', 2, 4]
  ];
  for (const [ano, ed, formas] of suf) {
    for (let t = 1; t <= formas; t++) {
      rodadas.push({
        id: `cfc_suf_${ano}_${ed}_T${String(t).padStart(2, '0')}`,
        ano: +ano, ed, tipo: `T${String(t).padStart(2, '0')}`, exame: 'Suf',
        gab: ano === '2026' && Number(ed) === 2 ? 'preliminary' : 'definitive'
      });
    }
  }

  // EQT — 33 variantes de 25 questões, por especialidade.
  // A lista por rodada é o dado do acervo: 2025.1 tem CVM e QTG com duas
  // variantes; 2025.2 não tem CVM T02; 2026 tem PERITO com duas.
  const eqt = {
    '2025.1': [['BCB', 1], ['CVM', 1], ['CVM', 2], ['PERITO', 1], ['PREVIC', 1], ['QTG', 1], ['QTG', 2], ['SUSEP', 1]],
    '2025.2': [['BCB', 1], ['CVM', 1], ['PERITO', 1], ['PREVIC', 1], ['QTG', 1], ['QTG', 2], ['SUSEP', 1]],
    '2026.1': [['BCB', 1], ['CVM', 1], ['CVM', 2], ['PERITO', 1], ['PERITO', 2], ['PREVIC', 1], ['QTG', 1], ['QTG', 2], ['SUSEP', 1]],
    '2026.2': [['BCB', 1], ['CVM', 1], ['CVM', 2], ['PERITO', 1], ['PERITO', 2], ['PREVIC', 1], ['QTG', 1], ['QTG', 2], ['SUSEP', 1]]
  };
  for (const [rodada, lista] of Object.entries(eqt)) {
    const [ano, ed] = rodada.split('.');
    for (const [org, tipo] of lista) {
      rodadas.push({
        id: `cfc_eqt_${ano}_${ed}_${org}_T${String(tipo).padStart(2, '0')}`,
        ano: +ano, ed: +ed, tipo: `T${String(tipo).padStart(2, '0')}`, exame: org,
        gab: rodada === '2026.2' ? 'preliminary' : 'definitive'
      });
    }
  }
  return rodadas;
}

/** Monta o payload no formato do catálogo. */
function payload(r, indice, anuladas) {
  const nQ = r.exame === 'Suf' ? 50 : 25;
  const questoes = [];
  for (let n = 1; n <= nQ; n++) {
    const anulada = anuladas.has(`${r.id}:${n}`);
    questoes.push({
      numero: n,
      gabarito: anulada ? null : LETRAS[(indice + n) % 4],
      enunciado: `Questão ${n} da variante ${r.tipo} (${r.id}).`,
      alternativas: Object.fromEntries(LETRAS.slice(0, 4).map((L) => [L, `Alternativa ${L}.`]))
    });
  }
  return {
    id: r.id, ano: r.ano, edicao: r.ed, tipo_prova: r.tipo, exam_type: r.exame,
    banca: 'FGV', gabarito_type: r.gab, questoes
  };
}

// -----------------------------------------------------------------------------
// AS 34 ANULADAS — a lista do acervo (verificada contra os PDFs oficiais)
// -----------------------------------------------------------------------------
const ANULADAS = {
  'cfc_suf_2024_2_T01': [37], 'cfc_suf_2024_2_T02': [40], 'cfc_suf_2024_2_T03': [38], 'cfc_suf_2024_2_T04': [37],
  'cfc_suf_2025_1_T01': [2, 10], 'cfc_suf_2025_1_T02': [1, 11], 'cfc_suf_2025_1_T03': [2, 12], 'cfc_suf_2025_1_T04': [1, 13],
  'cfc_suf_2025_2_T01': [49, 50], 'cfc_suf_2025_2_T02': [49, 50], 'cfc_suf_2025_2_T03': [49, 50], 'cfc_suf_2025_2_T04': [49, 50],
  'cfc_suf_2026_1_T01': [13, 39], 'cfc_suf_2026_1_T02': [10, 40], 'cfc_suf_2026_1_T03': [11, 41], 'cfc_suf_2026_1_T04': [12, 42],
  'cfc_eqt_2025_1_PERITO_T01': [18], 'cfc_eqt_2025_2_PERITO_T01': [1],
  'cfc_eqt_2026_1_CVM_T01': [8], 'cfc_eqt_2026_1_CVM_T02': [15],
  'cfc_eqt_2026_1_SUSEP_T01': [3, 14]
};
// O acervo de 2026.2 é PRELIMINAR e não tem lista de anulações conferida:
// as 34 anuladas acima são as do acervo conferido (definitivos).

// -----------------------------------------------------------------------------
// EXECUÇÃO
// -----------------------------------------------------------------------------
const t0 = Date.now();
const db = new PGlite({ extensions: { citext, pg_trgm, btree_gist } });
const execCru = db.exec.bind(db);
db.exec = (sql, params) => (Array.isArray(params) && params.length > 0 ? db.query(sql, params) : execCru(sql));

for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) {
  for (const stmt of splitSql(readFileSync(join(MIG, f), 'utf8'))) await db.exec(stmt);
}
console.log('migrations aplicadas');

const plano = planoDoAcervo();
const anuladas = new Set();
for (const [id, nums] of Object.entries(ANULADAS)) for (const n of nums) anuladas.add(`${id}:${n}`);

let totalQ = 0;
let i = 0;
for (const r of plano) {
  const p = payload(r, i++, anuladas);
  totalQ += p.questoes.length;
  await db.query(`SELECT ops.import_corpus_form($1::jsonb)`, [JSON.stringify(p)]);
}
console.log(`acervo importado: ${plano.length} variantes, ${totalQ} questões`);

const q = async (sql) => (await db.query(sql)).rows[0];
const contagens = {
  variantes: Number((await q(`SELECT count(*)::int n FROM learning.exam_form`)).n),
  rodadas: Number((await q(`SELECT count(*)::int n FROM taxonomy.exam_edition WHERE status='realizada'`)).n),
  trilhas: Number((await q(`SELECT count(*)::int n FROM taxonomy.exam_track`)).n),
  itens: Number((await q(`SELECT count(*)::int n FROM learning.exam_form_item`)).n),
  questoes: Number((await q(`SELECT count(*)::int n FROM editorial.content_item WHERE key LIKE 'cfc\\_%'`)).n),
  gabaritos: Number((await q(`SELECT count(*)::int n FROM learning.answer_key`)).n),
  definitivos: Number((await q(`SELECT count(*)::int n FROM learning.answer_key WHERE status='definitivo'`)).n),
  preliminares: Number((await q(`SELECT count(*)::int n FROM learning.answer_key WHERE status='preliminar'`)).n),
  anuladas: Number((await q(`SELECT count(*)::int n FROM learning.answer_key_entry WHERE is_annulled`)).n),
  com_resposta: Number((await q(`SELECT count(*)::int n FROM learning.answer_key_entry WHERE NOT is_annulled`)).n)
};

console.log('\n=== O QUE O BANCO GUARDOU ===');
for (const [k, v] of Object.entries(contagens)) console.log(`  ${k.padEnd(14)} ${v}`);

// ---- OS INVARIANTES -------------------------------------------------------
const falhas = [];
const esperar = (cond, msg) => { if (!cond) falhas.push(msg); };

esperar(contagens.variantes === 56, `variantes: esperado 56, veio ${contagens.variantes}`);
esperar(contagens.itens === 1975, `posições na prova: esperado 1975, veio ${contagens.itens}`);
esperar(contagens.questoes === 1975, `questões: esperado 1975, veio ${contagens.questoes}`);
esperar(contagens.anuladas === 34, `anuladas: esperado 34, veio ${contagens.anuladas}`);
esperar(contagens.com_resposta === 1941, `com resposta: esperado 1941, veio ${contagens.com_resposta}`);
esperar(contagens.definitivos === 43, `definitivos: esperado 43, veio ${contagens.definitivos}`);
esperar(contagens.preliminares === 13, `preliminares: esperado 13, veio ${contagens.preliminares}`);

// Nenhum gabarito definitivo pode ter buraco (a regra do banco já impede;
// aqui se confere que nada escapou).
const incompletos = await q(`
  SELECT count(*)::int n FROM learning.answer_key ak
   WHERE ak.status='definitivo'
     AND (SELECT count(*) FROM learning.answer_key_entry e WHERE e.answer_key_id=ak.id)
         <> (SELECT t.question_count FROM learning.exam_form ef
               JOIN taxonomy.exam_track t ON t.id=ef.exam_track_id WHERE ef.id=ak.exam_form_id)`);
esperar(Number(incompletos.n) === 0, `gabaritos definitivos incompletos: ${incompletos.n}`);

// A projeção tem que bater com o gabarito: é a letra que o CFC imprimiu.
const divergentes = await q(`
  SELECT count(*)::int n FROM learning.answer_key_entry e
    JOIN learning.answer_key ak ON ak.id=e.answer_key_id
    JOIN learning.exam_form_item efi ON efi.exam_form_id=ak.exam_form_id AND efi.ordinal=e.ordinal
    JOIN learning.item_option o ON o.item_id=efi.item_id AND o.ordinal=e.correct_option
   WHERE NOT e.is_annulled AND o.is_correct IS NOT TRUE`);
esperar(Number(divergentes.n) === 0, `letras divergentes do gabarito: ${divergentes.n}`);

// A questão anulada não tem alternativa correta (anulada = sem resposta).
const anuladasComLetra = await q(`
  SELECT count(*)::int n FROM learning.answer_key_entry e
    JOIN learning.answer_key ak ON ak.id=e.answer_key_id
    JOIN learning.exam_form_item efi ON efi.exam_form_id=ak.exam_form_id AND efi.ordinal=e.ordinal
    JOIN learning.item_option o ON o.item_id=efi.item_id
   WHERE e.is_annulled AND o.is_correct`);
esperar(Number(anuladasComLetra.n) === 0, `anuladas com letra: ${anuladasComLetra.n}`);

console.log('\n=== INVARIANTES ===');
if (falhas.length === 0) {
  console.log('  ✓ todos os invariantes do acervo real se sustentam');
} else {
  for (const f of falhas) console.log(`  ✗ ${f}`);
}
console.log(`\n(${Math.round((Date.now() - t0) / 1000)}s)`);
await db.close();
process.exit(falhas.length === 0 ? 0 : 1);
