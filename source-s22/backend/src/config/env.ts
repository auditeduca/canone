/**
 * CONFIGURAÇÃO — validada na subida, não na primeira requisição.
 *
 * A regra: se a configuração está errada, o processo NÃO SOBE. Um backend
 * que sobe com `DATABASE_URL` faltando e só falha quando alguém usa a
 * área do assinante é um backend que vai falhar em produção na hora mais
 * cara.
 */

export type AppEnv = 'desenvolvimento' | 'teste' | 'producao';

export interface Env {
  appEnv: AppEnv;
  /** URL do Postgres. obrigatória em produção. */
  databaseUrl: string | null;
  /** Diretório de dados do PGlite (dev/teste). */
  pgliteDataDir: string | null;
  /** Limite de conexões do pool. */
  poolMax: number;
  /** Tempo máximo de uma transação de requisição. */
  statementTimeoutMs: number;
  /** Prefixo dos GUCs de contexto. */
  appPrefix: string;
}

class EnvError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'EnvError';
  }
}

function int(v: string | undefined, padrao: number, nome: string): number {
  if (v === undefined || v === '') return padrao;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new EnvError(`${nome} deve ser um inteiro positivo (veio: ${v})`);
  }
  return n;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const rawEnv = source.APP_ENV ?? 'desenvolvimento';
  if (!['desenvolvimento', 'teste', 'producao'].includes(rawEnv)) {
    throw new EnvError(`APP_ENV inválido: ${rawEnv} (use desenvolvimento|teste|producao)`);
  }
  const appEnv = rawEnv as AppEnv;

  const databaseUrl = source.DATABASE_URL ?? null;
  const pgliteDataDir = source.PGLITE_DATA_DIR ?? null;

  if (appEnv === 'producao' && !databaseUrl) {
    throw new EnvError(
      'DATABASE_URL é obrigatória em produção. O Cânone não sobe contra PGlite em produção: ' +
        'o pool e o RLS multi-sessão precisam do Postgres de verdade.'
    );
  }
  if (!databaseUrl && !pgliteDataDir) {
    throw new EnvError(
      'Defina DATABASE_URL (produção) ou PGLITE_DATA_DIR (desenvolvimento/teste).'
    );
  }

  return {
    appEnv,
    databaseUrl,
    pgliteDataDir,
    poolMax: int(source.POOL_MAX, 10, 'POOL_MAX'),
    statementTimeoutMs: int(source.STATEMENT_TIMEOUT_MS, 5_000, 'STATEMENT_TIMEOUT_MS'),
    appPrefix: 'app',
  };
}
