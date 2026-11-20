/**
 * ÁREA DO ASSINANTE — o progresso de QUEM pergunta.
 *
 * Tudo aqui é escopado pelo `app.current_user_id` que a camada de
 * contexto injeta na transação. Nenhum repositório aceita "userId" como
 * parâmetro: se aceitasse, bastaria o chamador passar o id de outra
 * pessoa. A identidade vem do contexto, não do argumento.
 */
import type { Db } from '../../db/driver.js';

export interface ProgressoAssunto {
  user_id: string;
  subject_id: string;
  subject_label: string;
  subject_key: string;
  items_seen: number;
  items_mastered: number;
  items_fragile: number;
  items_unseen: number;
  correct_answers: number;
  total_answers: number;
  /** NULL = ainda sem resposta. NUNCA 0. */
  accuracy: string | null;
  confidence: string | null;
  updated_at: Date;
}

export interface ItemDevido {
  item_id: string;
  subject_id: string;
  due_at: Date;
  state: string;
  stability_days: string;
  is_fragile: boolean;
  last_grade: string | null;
}

export interface EventoHistorico {
  id: string;
  item_id: string;
  title: string;
  item_key: string;
  grade: string;
  basis: string;
  correct: boolean | null;
  duration_ms: number | null;
  repetition: number;
  reviewed_at: Date;
  session_id: string | null;
  mock_exam_id: string | null;
}

export type Grade = 'facil' | 'esforco' | 'errei' | 'naosei';
export type Base = 'sistema' | 'autodeclarado';

export const progresso = {
  async porAssunto(db: Db): Promise<ProgressoAssunto[]> {
    const r = await db.query<ProgressoAssunto>(
      `SELECT user_id, subject_id, subject_label, subject_key,
              items_seen, items_mastered, items_fragile, items_unseen,
              correct_answers, total_answers, accuracy, confidence, updated_at
         FROM canone_subscriber.v_my_progress
        ORDER BY subject_label`
    );
    return r.rows;
  },

  async devidos(db: Db, limite = 50): Promise<ItemDevido[]> {
    const r = await db.query<ItemDevido>(
      `SELECT item_id, subject_id, due_at, state, stability_days, is_fragile, last_grade
         FROM canone_subscriber.v_my_due LIMIT $1`,
      [limite]
    );
    return r.rows;
  },

  async historico(db: Db, limite = 100): Promise<EventoHistorico[]> {
    const r = await db.query<EventoHistorico>(
      `SELECT id, item_id, title, item_key, grade, basis, correct,
              duration_ms, repetition, reviewed_at, session_id, mock_exam_id
         FROM canone_subscriber.v_my_history
        ORDER BY reviewed_at DESC LIMIT $1`,
      [limite]
    );
    return r.rows;
  },

  /**
   * REGISTRA UMA REVISÃO.
   *
   * A função do banco (learning.apply_review_event) grava o evento
   * append-only e só então aplica ao estado. O usuário da requisição vem
   * do contexto — por isso esta função não aceita userId.
   *
   * O `basis` decide de onde vem o estado:
   *   'sistema'      → gabarito conhecido; o estado é DERIVADO (facil/errei)
   *   'autodeclarado' → flashcard; o estado é DECLARADO (esforço/naosei)
   */
  async registrar(
    db: Db,
    entrada: {
      itemId: string;
      grade: Grade;
      basis: Base;
      correct?: boolean | null;
      durationMs?: number | null;
      sessionId?: string | null;
    }
  ): Promise<{ state: string; due_at: Date | null; last_grade: string }> {
    const r = await db.query<{ state: string; due_at: Date | null; last_grade: string }>(
      `SELECT state, due_at, last_grade
         FROM canone_learning.apply_review_event(
           canone_ops.current_user_id(), $1::uuid, $2::canone_learning.review_grade,
           $3::canone_learning.review_basis, $4::boolean, $5::int)
       `,
      [entrada.itemId, entrada.grade, entrada.basis, entrada.correct ?? null, entrada.durationMs ?? null]
    );
    return r.rows[0];
  },

  /** Recalcula a maestria por assunto a partir do log. */
  async recalcularMaestria(db: Db, subjectId: string): Promise<void> {
    await db.query(`SELECT canone_learning.refresh_mastery(canone_ops.current_user_id(), $1::uuid)`, [subjectId]);
  },
};
