/**
 * GOVERNANÇA — o estado do sistema, lido pelo banco.
 * ============================================================================
 * A governança é a METADE do comander que não executa: ela mostra o que
 * está pendente, o que está sem fonte, o que está aberto e o que já
 * aconteceu.
 *
 * A honestidade do painel é uma propriedade do BANCO, não da tela:
 *
 *   · o que não tem número mostra NULL, não zero;
 *   · o que não tem fonte aparece como "sem fonte", não preenchido;
 *   · a fila mostra o que está aberto, não o que o admin quer ver.
 *
 * Um painel que esconde o que está ruim é um painel de vendas. Este não é.
 */
import type { Db } from '../../db/driver.js';

export interface ItemDaFila {
  id: string;
  queue: string;
  priority: number;
  reason: string;
  detail: Record<string, unknown>;
  assigned_to: string | null;
  opened_at: Date;
  due_at: Date | null;
  content_key: string | null;
  content_title: string | null;
}

export interface ConcessaoGovernada {
  id: string;
  staff_user_id: string;
  subject_user_id: string;
  scope: string;
  reason: string;
  ticket_ref: string | null;
  granted_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
  /** Derivado, mas pelo banco: a concessão está expirada e ainda não revogada. */
  expirada: boolean;
  /** A concessão ainda dá acesso agora. */
  vigente: boolean;
}

export interface EventoAuditado {
  seq: number;
  occurred_at: Date;
  actor_id: string | null;
  actor_role: string | null;
  subject_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  request_id: string | null;
}

export interface EstadoCadeia {
  /** true = a cadeia está íntegra. */
  integra: boolean;
  /** Quantas linhas do log falharam na verificação. */
  quebradas: number;
  /** As linhas quebradas (seq, esperado, encontrado). */
  amostra: { seq: number; esperado: string; encontrado: string }[];
}

export const governancaEstado = {
  /** A fila de moderação: o que está aberto, por ordem de prioridade. */
  async fila(db: Db): Promise<ItemDaFila[]> {
    const r = await db.query<ItemDaFila>(
      `SELECT q.id, q.queue, q.priority, q.reason, q.detail, q.assigned_to,
              q.opened_at, q.due_at,
              ci.key AS content_key, ci.title AS content_title
         FROM canone_admin.moderation_queue q
         LEFT JOIN canone_editorial.content_item ci ON ci.id = q.content_item_id
        WHERE q.resolved_at IS NULL
        ORDER BY q.priority DESC, q.opened_at`
    );
    return r.rows;
  },

  /**
   * As concessões de suporte — INCLUDING as vencidas.
   *
   * Uma concessão expirada e não revogada é informação de governança: diz
   * que ninguém fechou o que abriu.
   */
  async concessoes(db: Db): Promise<ConcessaoGovernada[]> {
    const r = await db.query<ConcessaoGovernada>(
      `SELECT g.id, g.staff_user_id, g.subject_user_id, g.scope, g.reason,
              g.ticket_ref, g.granted_at, g.expires_at, g.revoked_at, g.revoke_reason,
              (g.expires_at <= now()) AS expirada,
              (g.revoked_at IS NULL AND g.expires_at > now()) AS vigente
         FROM canone_admin.support_access_grant g
        ORDER BY g.granted_at DESC
        LIMIT 200`
    );
    return r.rows;
  },

  /** O log de auditoria, do mais recente para o mais antigo. */
  async auditoria(db: Db, limite = 100): Promise<EventoAuditado[]> {
    const r = await db.query<EventoAuditado>(
      `SELECT seq, occurred_at, actor_id, actor_role, subject_user_id,
              action, entity_type, entity_id, request_id
         FROM canone_admin.v_audit_recent
        LIMIT $1`,
      [limite]
    );
    return r.rows;
  },

  /**
   * A verificação da cadeia de auditoria.
   *
   * A verificação RECALCULA o hash de cada linha. Uma cadeia que parece
   * íntegra porque ninguém recalculou nada não é integridade — é teatro.
   */
  async cadeia(db: Db): Promise<EstadoCadeia> {
    const r = await db.query<{ seq: number; ok: boolean; expected: string; found: string }>(
      `SELECT seq, ok, expected, found FROM canone_audit.verify_chain()`
    );
    return {
      integra: r.rows.length === 0,
      quebradas: r.rows.length,
      amostra: r.rows.slice(0, 10).map((x) => ({
        seq: Number(x.seq),
        esperado: x.expected,
        encontrado: x.found,
      })),
    };
  },
};
