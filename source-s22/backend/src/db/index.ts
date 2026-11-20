/**
 * FÁBRICA DE BANCO — escolhe o driver pelo ambiente.
 *
 *   PGLITE_DATA_DIR (sem DATABASE_URL) → PGlite (dev/teste)
 *   DATABASE_URL                        → node-postgres (produção)
 *
 * A escolha NÃO é negociável em produção: subir contra PGlite em produção
 * significaria um banco de um processo só, sem pool, e sem a possibilidade
 * de mais de um backend rodando.
 */
import type { Db } from './driver.js';
import { PGliteDb } from './pglite-driver.js';
import { PgDb } from './pg-driver.js';
import { readEnv, type Env } from '../config/env.js';
import { ROLE_TECNICO } from './roles.js';

export async function createDb(env: Env = readEnv()): Promise<Db> {
  if (env.databaseUrl) {
    return new PgDb({
      connectionString: env.databaseUrl,
      max: env.poolMax,
      appRole: ROLE_TECNICO,
    });
  }
  return PGliteDb.create({ dataDir: env.pgliteDataDir ?? ':memory:' });
}

export * from './driver.js';
export * from './roles.js';
export * from './rls-context.js';
export { PGliteDb } from './pglite-driver.js';
export { PgDb } from './pg-driver.js';
