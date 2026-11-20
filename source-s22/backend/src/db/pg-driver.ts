/**
 * ADAPTADOR POSTGRES (node-postgres) — o caminho de produção.
 *
 * Pool de verdade, com limite de conexões. Cada conexão do pool é
 * REUTILIZÁVEL porque o contexto (papel e usuário) é sempre de uma
 * transação com SET LOCAL — nada sobra para a próxima requisição.
 */
import pg from 'pg';
import type { Db, QueryResult } from './driver.js';
import { DbError } from './driver.js';

export interface PgOptions {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  /** Aplica o papel técnico a cada conexão nova do pool. */
  appRole?: string;
}

export class PgDb implements Db {
  private readonly pool: pg.Pool;
  private readonly appRole: string;

  constructor(opts: PgOptions) {
    this.appRole = opts.appRole ?? 'canone_app';
    this.pool = new pg.Pool({
      connectionString: opts.connectionString,
      max: opts.max ?? 10,
      idleTimeoutMillis: opts.idleTimeoutMillis ?? 30_000,
      connectionTimeoutMillis: opts.connectionTimeoutMillis ?? 5_000,
      // Toda conexão nova entra no papel técnico. A troca para o papel da
      // área acontece DEPOIS, dentro da transação da requisição.
      options: `-c role=${this.appRole}`,
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    try {
      const res = await this.pool.query(sql, params as never[]);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    } catch (e) {
      const anyE = e as { message?: string; code?: string };
      throw new DbError(anyE?.message ?? String(e), anyE?.code);
    }
  }

  async exec(sql: string): Promise<void> {
    await this.query(sql);
  }

  /**
   * Execução em transação DESFEITA: a prévia do comander.
   */
  async dryRun<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx = this.txDe(client);
    try {
      await client.query('BEGIN');
      const out = await fn(tx);
      // Sem isto, a prévia não dispararia as regras DEFERRABLE (que só
      // correm no COMMIT) — ela mentiria dizendo que o gabarito incompleto
      // passaria. A prévia tem que ser o COMMIT.
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await client.query('ROLLBACK');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* já abortada */ }
      throw e;
    } finally {
      client.release();
    }
  }

  private txDe(client: import('pg').PoolClient): Db {
    return {
      query: async <R>(sql: string, params: unknown[] = []) => {
        try {
          const res = await client.query(sql, params as never[]);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
        } catch (e) {
          const anyE = e as { message?: string; code?: string };
          throw new DbError(anyE?.message ?? String(e), anyE?.code);
        }
      },
      exec: async (sql: string) => { await client.query(sql); },
      transaction: async <R>(inner: (t: Db) => Promise<R>) => inner(this.txDe(client)),
      dryRun: async <R>(inner: (t: Db) => Promise<R>) => {
        await client.query('BEGIN');
        try {
          const out = await inner(this.txDe(client));
          await client.query('SET CONSTRAINTS ALL IMMEDIATE');
          return out;
        } finally {
          await client.query('ROLLBACK');
        }
      },
      close: async () => { /* a conexão volta para o pool */ },
    };
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx: Db = {
      query: async <R>(sql: string, params: unknown[] = []) => {
        try {
          const res = await client.query(sql, params as never[]);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
        } catch (e) {
          const anyE = e as { message?: string; code?: string };
          throw new DbError(anyE?.message ?? String(e), anyE?.code);
        }
      },
      exec: async (sql: string) => { await client.query(sql); },
      transaction: async <R>(inner: (t: Db) => Promise<R>) => inner(tx),
      dryRun: async <R>(inner: (t: Db) => Promise<R>) => {
        await client.query('BEGIN');
        try {
          return await inner(tx);
        } finally {
          await client.query('ROLLBACK');
        }
      },
      close: async () => { /* a conexão volta para o pool */ },
    };

    try {
      await client.query('BEGIN');
      const out = await fn(tx);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* já abortada */ }
      throw e;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
