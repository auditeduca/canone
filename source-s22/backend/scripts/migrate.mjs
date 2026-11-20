#!/usr/bin/env node
/* ============================================================================
   CÂNONE — RUNNER DE MIGRATIONS
   ---------------------------------------------------------------------------
   Usa PGlite (PostgreSQL 16 real, compilado para WASM) para que o schema
   seja EXECUTADO e não só escrito. Migration que nunca rodou é uma hipótese.

   · migrations rodam em ordem numérica, dentro de transação
   · cada migration grava checksum em ops.migration_log
   · checksum divergente = migration editada depois de aplicada → erro
   · --reset reconstrói do zero
   ========================================================================== */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(HERE, '..', 'db', 'migrations');

/**
 * Splitter de SQL que respeita:
 *   · blocos $$ ... $$ (corpos de função, DO $$)
 *   · literais de string '...' com escape '' (aspas duplicadas)
 *   · comentários de linha -- ...
 *
 * Motivo: o exec() do PGlite embaralha blocos $$ e passa parte do corpo
 * como parâmetro ($1). Split próprio = controle de erro e atomicidade.
 */
export function splitSql(sql) {
  const out = [];
  let cur = '';
  let i = 0;
  const n = sql.length;
  let inDollar = false;

  while (i < n) {
    if (inDollar) {
      if (sql.startsWith('$$', i)) { cur += '$$'; i += 2; inDollar = false; continue; }
      cur += sql[i]; i++; continue;
    }
    const c = sql[i];
    if (c === "'") {
      cur += c; i++;
      while (i < n) {
        cur += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { cur += sql[i + 1]; i += 2; continue; }
          i++; break;
        }
        i++;
      }
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      cur += '\n';
      continue;
    }
    if (sql.startsWith('$$', i)) { inDollar = true; cur += '$$'; i += 2; continue; }
    if (c === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = ''; i++; continue;
    }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function runMigrations(db, { log = () => {} } = {}) {
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS public.__runner (
      version text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      duration_ms int
    );`);

  const applied = new Map();
  try {
    const r = await db.query('SELECT version, checksum FROM public.__runner');
    for (const row of r.rows) applied.set(row.version, row.checksum);
  } catch { /* primeira execução */ }

  const report = [];
  for (const file of files) {
    const sql = readFileSync(join(MIG_DIR, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const version = file.replace(/\.sql$/, '');

    if (applied.has(version)) {
      if (applied.get(version) !== checksum) {
        throw new Error(
          `✗ ${version}: checksum divergente.\n` +
          `  migration já aplicada com ${applied.get(version).slice(0, 12)}…\n` +
          `  arquivo atual tem        ${checksum.slice(0, 12)}…\n` +
          `  Editar migration aplicada é erro silencioso que vira bug de ambiente.\n` +
          `  Crie uma migration nova.`
        );
      }
      report.push({ version, status: 'ja aplicada' });
      continue;
    }

    const t0 = Date.now();
    try {
      await db.exec('BEGIN');
      const stmts = splitSql(sql);
      for (let i = 0; i < stmts.length; i++) {
        try {
          await db.exec(stmts[i]);
        } catch (stmtErr) {
          const ctx = stmts
            .slice(Math.max(0, i - 1), i + 1)
            .map((x, k) => `  [${Math.max(0, i - 1) + k}] ${x.slice(0, 400)}`)
            .join('\n');
          throw new Error(`✗ ${version} falhou: ${stmtErr.message}\nstatement:\n${ctx}`);
        }
      }
      await db.query(
        `INSERT INTO public.__runner (version, checksum, duration_ms) VALUES ($1,$2,$3)`,
        [version, checksum, Date.now() - t0]
      );
      await db.exec('COMMIT');
    } catch (e) {
      try { await db.exec('ROLLBACK'); } catch { /* */ }
      throw new Error(`✗ ${version} falhou: ${e.message}`);
    }
    report.push({ version, status: 'aplicada', ms: Date.now() - t0 });
    log(`  ✓ ${version.padEnd(32)} ${Date.now() - t0}ms`);
  }
  return report;
}

/* CLI */
if (process.argv[1] && process.argv[1].endsWith('migrate.mjs')) {
  const db = new PGlite({ extensions: { citext, pg_trgm, btree_gist } });
  console.log('Cânone — aplicando migrations');
  const report = await runMigrations(db, { log: console.log });
  const applied = report.filter((r) => r.status === 'aplicada').length;
  console.log(`\n${applied} migration(s) aplicada(s), ${report.length - applied} já existente(s).`);

  // Verificação de sanidade: o schema tem o que precisa ter?
  // Contagem HONESTA: tabelas base e views são coisas diferentes.
  // A versão anterior chamava de "tabelas" uma contagem que incluía views
  // — e número inflado é exatamente o que este projeto não tolera.
  const check = await db.query(`
    SELECT
      count(*) FILTER (WHERE table_type = 'BASE TABLE')::int AS tabelas,
      count(*) FILTER (WHERE table_type = 'VIEW')::int         AS views
      FROM information_schema.tables
     WHERE table_schema IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit')`);
  console.log(
    `Tabelas base: ${check.rows[0].tabelas} · views: ${check.rows[0].views}`
  );
  await db.close();
}
