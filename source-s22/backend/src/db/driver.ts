/**
 * DRIVER — o contrato de banco que o backend fala.
 *
 * O backend fala com Postgres por este contrato, e não com uma biblioteca
 * específica. Isso não é abstração por Taste: é o que permite rodar a
 * SUÍTE INTEIRA contra PGlite (Postgres 16.4 de verdade, compilado em
 * WASM) sem mock, e rodar em produção contra o Postgres do provedor com o
 * mesmo código.
 *
 * Um mock de banco não prova nada sobre restrições, RLS e triggers — que é
 * justamente o que este projeto precisa provar.
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  /** Consulta parametrizada. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** SQL sem parâmetros, múltiplos statements. */
  exec(sql: string): Promise<void>;
  /**
   * Executa `fn` dentro de uma transação. A transação é de uma requisição:
   * se `fn` lançar, tudo é desfeito.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /**
   * Executa `fn` dentro de uma transação que é DESFEITA no fim, e devolve
   * o valor produzido.
   *
   * É o que o comander usa para pré-visualizar: a prévia é a MESMA
   * execução, com rollback. A resposta da prévia é o que o banco faria —
   * não o que a interface imagina.
   */
  dryRun<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Erro de banco com o código do Postgres — o que os testes usam para distinguir recusa de bug. */
export class DbError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DbError';
    this.code = code;
  }
}
