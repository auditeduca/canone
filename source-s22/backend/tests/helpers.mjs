// =============================================================================
// FIXTURE DE TESTE — sobe um banco Cânone real e monta o cenário mínimo.
// -----------------------------------------------------------------------------
// Os testes NÃO mockam o banco. Cada teste sobe um PGlite novo, aplica as
// 16 migrations e mexe no schema de verdade. Um teste que passa porque
// o mock era permissivo não prova nada.
//
// REGRA: o teste prova o COMPORTAMENTO (o banco recusa / aceita), nunca a
// forma do texto. Se o SQL mudar e o comportamento continuar, o teste
// continua verde — que é exatamente o objetivo.
// =============================================================================
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSql } from '../scripts/migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'db', 'migrations');

export async function bootDb() {
  const db = new PGlite({ extensions: { citext, pg_trgm, btree_gist } });

  // O exec() do PGlite NÃO aceita parâmetros ($1) — ele serve para
  // múltiplos statements sem binding. Encapsulamos: com parâmetros, vai
  // por query(); sem, continua no exec().
  const execCru = db.exec.bind(db);
  db.exec = (sql, params) =>
    Array.isArray(params) && params.length > 0 ? db.query(sql, params) : execCru(sql);

  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    for (const stmt of splitSql(sql)) {
      await db.exec(stmt);
    }
  }

  // O PGlite cru não implementa o CONTRATO de banco que o backend fala
  // (Db: query/exec/transaction/dryRun/close). Sem o dryRun, a prévia do
  // comander não teria onde rodar — e o teste mediria um objeto que o
  // backend nunca usa. Envolve no mesmo contrato de produção.
  const crud = db;
  const contrato = {
    query: async (sql, params = []) => {
      const r = await crud.query(sql, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    exec: (sql, params) => crud.exec(sql, params),
    transaction: async (fn) => {
      await crud.exec('BEGIN');
      try {
        const out = await fn(contrato);
        await crud.exec('COMMIT');
        return out;
      } catch (e) {
        try { await crud.exec('ROLLBACK'); } catch { /* já abortada */ }
        throw e;
      }
    },
    dryRun: async (fn) => {
      await crud.exec('BEGIN');
      try {
        const out = await fn(contrato);
        // A prévia tem que ser o COMMIT: sem isto, as regras DEFERRABLE
        // (a completude do gabarito, por exemplo) não rodariam, e a prévia
        // diria "ok" para o que o COMMIT recusa.
        await crud.exec('SET CONSTRAINTS ALL IMMEDIATE');
        await crud.exec('ROLLBACK');
        return out;
      } catch (e) {
        try { await crud.exec('ROLLBACK'); } catch { /* já abortada */ }
        throw e;
      }
    },
    close: () => crud.close(),
  };
  return contrato;
}

/** Executa e devolve as linhas. */
export async function rows(db, sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows;
}

/** Executa e devolve a 1ª linha. */
export async function one(db, sql, params = []) {
  const r = await rows(db, sql, params);
  return r[0] ?? null;
}

/**
 * Roda `fn` e devolve o erro do BANCO, ou null se deu certo.
 * Usado para as PROVAS DE RECUSA: o teste passa quando o banco RECUSA.
 *
 * IMPORTANTE: só conta como recusa o que veio do Postgres (tem `code`).
 * Um TypeError de JavaScript no próprio teste PROPAGA — senão um teste
 * quebrado "passa" como se o banco tivesse recusado, e o falso verde
 * esconde exatamente o que a prova existe para achar.
 */
export async function recusa(db, fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    if (!e || (!e.code && !e.severity)) throw e;
    return e;
  }
}

/** Verdadeiro se o erro menciona o fragmento (ignora caixa). */
export function menciona(err, fragmento) {
  if (!err) return false;
  return String(err.message ?? '').toLowerCase().includes(fragmento.toLowerCase());
}

// -----------------------------------------------------------------------------
// FIXTURES DE DOMÍNIO
// -----------------------------------------------------------------------------

export async function criarConta(db, email) {
  const r = await one(
    db,
    `INSERT INTO identity.account (email, status, email_verified_at)
     VALUES ($1, 'ativo', now()) RETURNING id`,
    [email]
  );
  await db.exec(
    `INSERT INTO identity.user_profile (user_id, display_name)
     VALUES ($1, $2)`,
    [r.id, email.split('@')[0]]
  );
  return r.id;
}

/** Garante uma versão de tipo de conteúdo e devolve seu id. */
export async function tipoConteudo(db, key, family = 'avaliacao') {
  const ct = await one(db, `SELECT id FROM editorial.content_type WHERE key = $1`, [key]);
  if (!ct) throw new Error(`content_type ${key} não existe`);
  const v = await one(
    db,
    `SELECT id FROM editorial.content_type_version WHERE content_type_id = $1 AND version = 1`,
    [ct.id]
  );
  if (v) return { contentTypeId: ct.id, versionId: v.id };
  const criado = await one(
    db,
    `INSERT INTO editorial.content_type_version (content_type_id, version, definition)
     VALUES ($1, 1, $2::jsonb) RETURNING id`,
    [ct.id, JSON.stringify({ key })]
  );
  return { contentTypeId: ct.id, versionId: criado.id };
}

/**
 * Cria um item de avaliação (questão) com payload e projeta.
 * O payload é a fonte da verdade: a projeção em learning.* é derivada.
 */
export async function criarQuestao(db, { key, title, opcoes, subjectId = null, autor = null }) {
  const { contentTypeId, versionId } = await tipoConteudo(db, 'questao');
  const item = await one(
    db,
    `INSERT INTO editorial.content_item
       (content_type_id, content_type_version_id, key, state, title, subject_id, created_by)
     VALUES ($1, $2, $3, 'rascunho', $4, $5, $6) RETURNING id`,
    [contentTypeId, versionId, key, title ?? key, subjectId, autor]
  );
  const payload = {
    kind: 'questao',
    stem: 'Enunciado de teste.',
    difficulty: 2,
    estimated_seconds: 60,
    options: opcoes ?? [
      { ordinal: 'A', body: 'Alternativa A', correct: true },
      { ordinal: 'B', body: 'Alternativa B', correct: false },
      { ordinal: 'C', body: 'Alternativa C', correct: false },
      { ordinal: 'D', body: 'Alternativa D', correct: false }
    ]
  };
  const versao = await one(
    db,
    `INSERT INTO editorial.content_item_version (content_item_id, version, payload, author_id)
     VALUES ($1, 1, $2::jsonb, $3) RETURNING id`,
    [item.id, JSON.stringify(payload), autor]
  );
  await db.exec(`UPDATE editorial.content_item SET current_version_id = $1 WHERE id = $2`, [
    versao.id,
    item.id
  ]);
  const proj = await one(db, `SELECT id FROM learning.item WHERE content_item_id = $1`, [item.id]);
  return { contentItemId: item.id, versionId: versao.id, itemId: proj.id };
}

/** Cria a fonte que sustenta uma verificação. */
export async function criarFonte(db, { key, quote = 'Trecho literal da fonte.' }) {
  return one(
    db,
    `INSERT INTO editorial.source (key, kind, title, publisher, url, source_quote, consulted_at)
     VALUES ($1, 'norma', $2, 'Fonte de teste', 'https://exemplo.invalid/fonte', $3, now())
     ON CONFLICT (key) DO UPDATE SET source_quote = EXCLUDED.source_quote
     RETURNING id`,
    [key, `Fonte ${key}`, quote]
  );
}

/** Cria uma verificação verificada (com trecho literal obrigatório). */
export async function criarVerificacao(db, { contentItemId, sourceId, state = 'verificada', quote, validUntil = null, autor = null }) {
  return one(
    db,
    `INSERT INTO editorial.verification
       (content_item_id, state, method, source_id, source_quote, verified_by, verified_at, valid_until)
     VALUES ($1, $2, 'manual', $3, $4, $5,
             CASE WHEN $2 = 'verificada' THEN now() ELSE NULL END, $6)
     RETURNING id`,
    [contentItemId, state, sourceId, quote ?? null, autor, validUntil]
  );
}

/** Cria uma norma com uma versão vigente. */
export async function criarNorma(db, { code = 'CPC 99', title = 'Norma de teste', sourceId = null }) {
  const issuer = await one(db, `SELECT id FROM norms.issuer WHERE key = 'cfc'`);
  const norma = await one(
    db,
    `INSERT INTO norms.norm (issuer_id, code, title, source_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [issuer.id, code, title, sourceId]
  );
  const versao = await one(
    db,
    `INSERT INTO norms.norm_version (norm_id, label, effective_from, source_id)
     VALUES ($1, $2, current_date - 30, $3) RETURNING id`,
    [norma.id, `${code} (R1)`, sourceId]
  );
  return { normId: norma.id, versionId: versao.id };
}

/** Assunto de referência do seed (o 1º do edital). */
export async function primeiroAssunto(db) {
  return one(db, `SELECT id, key FROM taxonomy.subject ORDER BY ordinal LIMIT 1`);
}

// -----------------------------------------------------------------------------
// PROVAS APLICADAS E GABARITO
// -----------------------------------------------------------------------------

/**
 * Cria uma rodada REALIZADA (prova já aplicada) com a banca.
 * A data pode ser null: data de prova antiga que ainda não foi conferida
 * na fonte fica NULA — null explícito, não data inventada.
 */
export async function criarEdicaoRealizada(db, { code, questionCount = 50, passingScore = 25 }) {
  const [ano, ed] = code.split('.');
  return one(
    db,
    `INSERT INTO taxonomy.exam_edition
       (code, label, edition_number, year, application_date, question_count,
        passing_score, status, bank, exam_kind)
     VALUES ($1, $2, $3, $4, NULL, $5, $6, 'realizada', 'FGV', 'suficiencia')
     RETURNING id`,
    [code, `Exame de Suficiência ${code}`, Number(ed), Number(ano), questionCount, passingScore]
  );
}

/** Cria a trilha (o exame dentro da rodada). */
export async function criarTrilha(db, { editionId, trackCode = 'suficiencia', specialty = null, questionCount = 50, passingScore = 25, label = 'Suficiência' }) {
  return one(
    db,
    `INSERT INTO taxonomy.exam_track
       (exam_edition_id, track_code, specialty_code, label, question_count, passing_score)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [editionId, trackCode, specialty, label, questionCount, passingScore]
  );
}

/** Cria a variante da prova (T01..T04). */
export async function criarForma(db, { trackId, formCode = 'T01' }) {
  return one(
    db,
    `INSERT INTO learning.exam_form (exam_track_id, form_code, form_label)
     VALUES ($1, $2, $3) RETURNING id`,
    [trackId, formCode, `Tipo ${formCode.slice(1)}`]
  );
}

/** Cria uma questão e a coloca na POSIÇÃO da prova. */
export async function criarItemNaForma(db, { formId, ordinal, key, opcoes }) {
  const q = await criarQuestao(db, { key, title: key, opcoes });
  await db.query(
    `INSERT INTO learning.exam_form_item (exam_form_id, ordinal, item_id)
     VALUES ($1, $2, $3)`,
    [formId, ordinal, q.itemId]
  );
  return { ...q, ordinal };
}

/**
 * Cria o gabarito (preliminar ou definitivo) e as entradas.
 *
 * Tudo numa TRANSAÇÃO: a regra de completude do gabarito definitivo é um
 * CONSTRAINT TRIGGER DEFERRABLE, e o DEFERRABLE só é avaliado no COMMIT.
 * Sem a transação explícita, o INSERT do gabarito seria verificado sozinho,
 * antes das entradas existirem — e o teste mediria o harness, não a regra.
 */
export async function criarGabarito(db, { formId, status = 'preliminar', sourceId, entries, supersedesId = null, extraction = null }) {
  await db.exec('BEGIN');
  try {
    const key = await one(
      db,
      `INSERT INTO learning.answer_key (exam_form_id, status, source_id, supersedes_id, extraction)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [formId, status, sourceId, supersedesId, JSON.stringify(extraction ?? { parser_version: 'teste' })]
    );
    for (const e of entries) {
      await db.query(
        `INSERT INTO learning.answer_key_entry (answer_key_id, ordinal, correct_option, is_annulled)
         VALUES ($1, $2, $3, $4)`,
        [key.id, e.ordinal, e.annulled ? null : (e.letter ?? null), !!e.annulled]
      );
    }
    await db.exec('COMMIT');
    return key;
  } catch (e) {
    try { await db.exec('ROLLBACK'); } catch { /* já desfeita */ }
    throw e;
  }
}
