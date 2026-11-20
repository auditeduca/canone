/**
 * ÁREA ADMINISTRATIVA — staff e admin.
 *
 * A VISÃO DE USUÁRIO É O CENTRO DESTE ARQUIVO.
 *
 * O staff não "é" o aluno. Ele lê o dado do aluno COMO o aluno, sob uma
 * concessão com motivo e prazo, e cada leitura é registrada. Não existe
 * caminho lateral: `lerProgresso` é a única função que devolve dado de
 * aluno, e ela delega à porta do banco.
 */
import type { Db } from '../../db/driver.js';

export interface Concessao {
  id: string;
  staff_user_id: string;
  subject_user_id: string;
  scope: 'progresso' | 'conta' | 'assinatura' | 'completo';
  reason: string;
  ticket_ref: string | null;
  granted_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
}

export interface ProgressoDoAluno {
  subject_key: string;
  subject_label: string;
  items_seen: number;
  items_mastered: number;
  items_fragile: number;
  items_unseen: number;
  accuracy: string | null;
  confidence: string | null;
}

export interface SaudeConteudo {
  id: string;
  key: string;
  title: string;
  content_type_key: string;
  family: string;
  state: string;
  subject_id: string | null;
  updated_at: Date;
  verification_state: string | null;
  valid_until: Date | null;
  verified_at: Date | null;
  is_valid: boolean | null;
  correct_rate: string | null;
  answer_count: number | null;
  flagged_for_review: boolean | null;
  norm_citations: string;
}

export interface AlegacaoRecusada {
  id: string;
  key: string;
  title: string;
  updated_at: Date;
  verification_state: string;
  refusal_reason: string | null;
  verified_at: Date | null;
  source_id: string | null;
  source_title: string | null;
  source_url: string | null;
}

/** A porta ÚNICA de leitura de dado de aluno. */
export const visaoDeUsuario = {
  /**
   * Concede acesso ao progresso de um aluno.
   *
   * O banco recusa: motivo com menos de 10 caracteres, prazo acima de 72h.
   * A recusa é do BANCO, não desta função — aqui só se delega.
   */
  async conceder(
    db: Db,
    entrada: {
      staffUserId: string;
      subjectUserId: string;
      reason: string;
      ticketRef?: string | null;
      scope?: Concessao['scope'];
      horasValidade?: number;
    }
  ): Promise<Concessao> {
    const horas = entrada.horasValidade ?? 24;
    const r = await db.query<Concessao>(
      `INSERT INTO canone_admin.support_access_grant
         (staff_user_id, subject_user_id, scope, reason, ticket_ref, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5,
               now() + make_interval(hours => $6::int))
       RETURNING id, staff_user_id, subject_user_id, scope, reason, ticket_ref,
                 granted_at, expires_at, revoked_at, revoke_reason`,
      [
        entrada.staffUserId,
        entrada.subjectUserId,
        entrada.scope ?? 'progresso',
        entrada.reason,
        entrada.ticketRef ?? null,
        horas
      ]
    );
    return r.rows[0];
  },

  async revogar(db: Db, grantId: string, staffUserId: string, motivo: string): Promise<void> {
    await db.query(
      `UPDATE canone_admin.support_access_grant
          SET revoked_at = now(), revoked_by = $2::uuid, revoke_reason = $3
        WHERE id = $1::uuid AND revoked_at IS NULL`,
      [grantId, staffUserId, motivo]
    );
  },

  /**
   * Lê o progresso do aluno.
   *
   * Não passa pelo RLS: a função do banco é SECURITY DEFINER e exige
   * concessão válida. Tudo que ela devolve fica em admin.support_access_log.
   */
  async lerProgresso(
    db: Db,
    entrada: { staffUserId: string; subjectUserId: string; grantId: string }
  ): Promise<ProgressoDoAluno[]> {
    const r = await db.query<ProgressoDoAluno>(
      `SELECT subject_key, subject_label, items_seen, items_mastered,
              items_fragile, items_unseen, accuracy, confidence
         FROM canone_admin.read_user_progress_as($1::uuid, $2::uuid, $3::uuid)`,
      [entrada.staffUserId, entrada.subjectUserId, entrada.grantId]
    );
    return r.rows;
  },

  async concessoesAtivas(db: Db, staffUserId: string): Promise<Concessao[]> {
    const r = await db.query<Concessao>(
      `SELECT id, staff_user_id, subject_user_id, scope, reason, ticket_ref,
              granted_at, expires_at, revoked_at, revoke_reason
         FROM canone_admin.support_access_grant
        WHERE staff_user_id = $1::uuid AND revoked_at IS NULL
        ORDER BY granted_at DESC`,
      [staffUserId]
    );
    return r.rows;
  },
};

/** Situação de cada variante de prova: questões, gabarito vigente, anuladas. */
export interface SituacaoProva {
  exam_form_id: string;
  form_code: string;
  form_label: string;
  edition_code: string;
  edition_status: string;
  track_code: string;
  specialty_code: string | null;
  question_count: number;
  items_linked: number;
  key_status: string | null;
  keyed: number;
  annulled: number;
}

export const governanca = {
  /** Saúde do acervo: o que está publicado sem verificação válida. */
  async saudeConteudo(db: Db): Promise<SaudeConteudo[]> {
    const r = await db.query<SaudeConteudo>(
      `SELECT id, key, title, content_type_key, family, state, subject_id, updated_at,
              verification_state, valid_until, verified_at, is_valid,
              correct_rate, answer_count, flagged_for_review, norm_citations
         FROM canone_admin.v_content_health
        ORDER BY is_valid NULLS FIRST, updated_at DESC`
    );
    return r.rows;
  },

  /** Situação das variantes de prova: o que está importado e o que falta. */
  async situacaoProvas(db: Db): Promise<SituacaoProva[]> {
    const r = await db.query<SituacaoProva>(
      `SELECT exam_form_id, form_code, form_label, edition_code, edition_status,
              track_code, specialty_code, question_count, items_linked,
              key_status, keyed, annulled
         FROM canone_admin.v_exam_form_status
        ORDER BY edition_code DESC, track_code, specialty_code NULLS FIRST, form_code`
    );
    return r.rows;
  },

  /** Alegações recusadas — insumo direto da página de integridade. */
  async alegacoesRecusadas(db: Db): Promise<AlegacaoRecusada[]> {
    const r = await db.query<AlegacaoRecusada>(
      `SELECT id, key, title, updated_at, verification_state, refusal_reason,
              verified_at, source_id, source_title, source_url
         FROM canone_admin.v_refused_claims
        ORDER BY updated_at DESC`
    );
    return r.rows;
  },
};
