/**
 * ADAPTADOR PGLITE — Postgres de verdade, em WASM.
 *
 * Usado em desenvolvimento e na suíte de testes. NÃO é um mock: é o
 * PostgreSQL 16.4 compilado para WebAssembly, com os mesmosphinx de
 * planner, as mesmas constraints e os mesmos triggers.
 *
 * O PGlite tem UMA conexão. Por isso o pool é virtual: a serialização é
 * explícita, e não há risco de dois contexts trocando de papel na mesma
 * sessão.
 */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { Db, QueryResult } from './driver.js';
import { DbError } from './driver.js';

export interface PGliteOptions {
  /** Caminho do diretório de dados. ':memory:' para efêmero. */
  dataDir?: string;
}

export class PGliteDb implements Db {
  private readonly pg: PGlite;
  /** Fila de transações: o PGlite tem uma conexão só. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(pg: PGlite) {
    this.pg = pg;
  }

  static async create(opts: PGliteOptions = {}): Promise<PGliteDb> {
    const pg = await PGlite.create({
      dataDir: opts.dataDir ?? ':memory:',
      extensions: { citext, pg_trgm, btree_gist },
    });
    return new PGliteDb(pg);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    const res = await this.pg.query<T>(sql, params as never[]);
    return { rows: res.rows as T[], rowCount: res.affectedRows ?? res.rows.length };
  }

  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }

  /**
   * Transação SERIALIZADA.
   *
   * A serialização não é otimização: o `SET LOCAL ROLE` depende que
   * ninguém mais troque o papel entre o BEGIN e o COMMIT. Duas
   * requisições simultâneas na mesma conexão sem serialização teriam
   *papéis trocados no meio do caminho.
   */
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.pg.exec('BEGIN');
      try {
        const out = await fn(this);
        await this.pg.exec('COMMIT');
        return out;
      } catch (e) {
        try { await this.pg.exec('ROLLBACK'); } catch { /* já abortada */ }
        throw e;
      }
    });
    // A corrente precisa continuar mesmo se esta transação falhar.
    this.chain = run.catch(() => undefined);
    return run;
  }

  /**
   * Execução em transação DESFEITA: a prévia do comander.
   * A mesma serialização da transação normal — o PGlite tem uma conexão só.
   */
  async dryRun<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.pg.exec('BEGIN');
      let out: T;
      try {
        out = await fn(this);
        // As regras DEFERRABLE só são conferidas no COMMIT — e aqui não há
        // COMMIT, há rollback. Sem esta linha, a prévia NÃO dispararia a
        // regra de completude: ela diria "ok" para um gabarito que o
        // COMMIT recusaria. A prévia tem que ser o COMMIT.
        await this.pg.exec('SET CONSTRAINTS ALL IMMEDIATE');
      } finally {
        await this.pg.exec('ROLLBACK');
      }
      return out;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

export function toDbError(e: unknown): DbError {
  if (e instanceof DbError) return e;
  const anyE = e as { message?: string; code?: string };
  return new DbError(anyE?.message ?? String(e), anyE?.code);
}
