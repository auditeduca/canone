/**
 * CONTEXTO DE REQUISIÇÃO — a ponte entre a requisição e o banco.
 *
 * A regra do Cânone: o backend NUNCA consulta com o papel técnico. Cada
 * requisição abre uma transação, troca para o papel da área, e diz ao banco
 * QUEM é o usuário. A partir daí, o banco decide o que essa pessoa pode
 * ver — inclusive as coisas que o backend nem sabe que existem.
 *
 * Por que `SET LOCAL` e não `SET`: LOCAL vale só até o fim da transação.
 * Se a conexão voltar para o pool com o papel trocado, o próximo-request
 * herdaria a sessão de outro — vazamento silencioso entre usuários.
 */
import type { Db } from './driver.js';
import { roleFor, type Area } from './roles.js';

export interface RequestContext {
  area: Area;
  /** Usuário da requisição. NULL = anônimo (área pública). */
  userId?: string | null;
  /** Id da requisição, para correlacionar log de auditoria. */
  requestId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(v: string, campo: string): string {
  if (!UUID_RE.test(v)) {
    throw new Error(`${campo} não é um uuid: ${v}`);
  }
  return v;
}

/**
 * Executa `fn` no contexto de uma requisição.
 *
 * Garante, em ordem:
 *   1. transação
 *   2. SET LOCAL ROLE  (papel da área)
 *   3. SET LOCAL app.current_area / app.current_user_id / app.request_id
 *   4. o que `fn` fizer
 *
 * Ao final: COMMIT se tudo deu certo, ROLLBACK se algo deu errado. A
 * troca de papel e o contexto morrem com a transação.
 */
export async function withArea<T>(
  db: Db,
  ctx: RequestContext,
  fn: (tx: Db) => Promise<T>
): Promise<T> {
  return db.transaction((tx) => dentroDaArea(tx, ctx, fn));
}

/**
 * O MESMO contexto, sem abrir transação.
 *
 * Para quem já está dentro de uma transação — o comander, que roda a
 * prévia (rollback) e a execução (commit) com o MESMO código, e só muda
 * o destino da transação.
 */
export async function dentroDaArea<T>(
  tx: Db,
  ctx: RequestContext,
  fn: (tx: Db) => Promise<T>
): Promise<T> {
  // app.current_user_id é contexto mutável, NÃO autenticação criptográfica.
  // Receber ctx.userId exclusivamente da sessão validada pelo servidor HTTP;
  // nunca permitir SQL arbitrário para um papel exposto ao usuário.
  const role = roleFor(ctx.area);
  const userId = ctx.userId ? assertUuid(ctx.userId, 'app.current_user_id') : null;
  const requestId = ctx.requestId ? assertUuid(ctx.requestId, 'app.request_id') : null;

  // O papel técnico SEMPRE troca antes de tocar em dado de área.
  await tx.exec(`SET LOCAL ROLE ${role}`);
  await tx.exec(`SET LOCAL app.current_area = '${ctx.area}'`);
  if (userId) {
    await tx.exec(`SET LOCAL app.current_user_id = '${userId}'`);
  } else {
    // Anônimo: a ausência precisa ser EXPLÍCITA. Um GUC herdado de
    // outra requisição seria pior que não ter usuário.
    await tx.exec(`SET LOCAL app.current_user_id = ''`);
  }
  if (requestId) {
    await tx.exec(`SET LOCAL app.request_id = '${requestId}'`);
  } else {
    // Ausência explícita: evita reutilizar um request_id preexistente na conexão.
    await tx.exec(`SET LOCAL app.request_id = ''`);
  }
  return fn(tx);
}

/**
 *MESMA COISA, sem trocar de papel.
 *
 * Para o que é do backend e não do usuário: jobs, rotinas de expiração,
 * leitura de configuração. Ainda assim roda em transação e com contexto
 * limpo — a diferença é que fica no papel técnico.
 */
export async function withSystem<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL app.current_area = 'sistema'`);
    await tx.exec(`SET LOCAL app.current_user_id = ''`);
    await tx.exec(`SET LOCAL app.request_id = ''`);
    return fn(tx);
  });
}
