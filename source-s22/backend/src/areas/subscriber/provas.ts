/**
 * ÁREA DO ASSINANTE — A PROVA E O GABARITO.
 *
 * O assinante responde; o servidor julga; o gabarito aparece depois.
 *
 * Nenhum método aceita "userId": a identidade vem do contexto da
 * requisição (`app.current_user_id`), como em todo o resto do backend.
 * Se aceitasse, bastaria um parâmetro trocado para responder a prova de
 * outra pessoa.
 *
 * E o GABARITO NÃO SAI DAQUI. A tentativa registra a resposta e o veredito;
 * a revelação do gabarito só acontece depois de a tentativa terminar, e
 * mesmo assim é uma função do banco (SECURITY DEFINER) que só devolve
 * o que o próprio servidor já sabia.
 */
import type { Db } from '../../db/driver.js';

export interface QuestaoProva {
  posicao: number;
  item_id: string;
  enunciado: string | null;
  opcao: string;
  opcao_pos: number;
  alternativa: string;
}

export interface ProvaDisponivel {
  exam_form_id: string;
  form_code: string;
  form_label: string;
  edition_code: string;
  edition_status: string;
  track_code: string;
  specialty_code: string | null;
  question_count: number;
  /** NULL = a prova já saiu e ainda não há gabarito definitivo. */
  key_status: string | null;
}

export interface VereditoTentativa {
  verdict: 'correta' | 'errada' | 'anulada';
}

export interface RespostaRevelada {
  ordinal: number;
  chosen_option: string | null;
  verdict: string;
  correct_option: string | null;
  is_annulled: boolean;
  stem: string;
}

export interface Tentativa {
  id: string;
  exam_form_id: string | null;
  mock_exam_id: string | null;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  annulled_count: number;
}

export const provas = {
  /**
   * O catálogo de provas já aplicadas, visível ao assinante.
   *
   * A leitura passa pela VIEW (subscriber.v_exam_forms): ela entrega o que
   * o assinante pode saber — inclusive se já existe gabarito definitivo —
   * e não entrega a letra, que nunca sai daqui.
   */
  async disponiveis(db: Db): Promise<ProvaDisponivel[]> {
    const r = await db.query<ProvaDisponivel>(
      `SELECT exam_form_id, form_code, form_label, edition_code, edition_status,
              track_code, specialty_code, question_count, key_status
         FROM canone_subscriber.v_exam_forms`
    );
    return r.rows;
  },

  /**
   * O enunciado e as alternativas de uma prova, por posição.
   *
   * Vem de uma view que não tem a coluna is_correct — é o mesmo caminho que
   * o item tem no estudo.
   */
  async questoes(db: Db, examFormId: string): Promise<QuestaoProva[]> {
    const r = await db.query<QuestaoProva>(
      `SELECT posicao, item_id, enunciado, opcao, opcao_pos, alternativa
         FROM canone_subscriber.v_exam_questions
        WHERE exam_form_id = $1
        ORDER BY posicao, opcao_pos`,
      [examFormId]
    );
    return r.rows;
  },

  async iniciar(db: Db, examFormId: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `SELECT canone_learning.start_exam_attempt($1) AS id`,
      [examFormId]
    );
    return r.rows[0].id;
  },

  /**
   * Caderno de erros do dono da tentativa concluída.
   * Não cria gabarito, cache paralelo nem outra tabela: DERIVA da revelação
   * canônica do banco, que primeiro verifica propriedade e conclusão.
   * Uma resposta anulada não é considerada erro do estudante.
   */
  async cadernoDeErros(db: Db, attemptId: string): Promise<RespostaRevelada[]> {
    const reveladas = await provas.revelar(db, attemptId);
    return reveladas.filter((r) => r.verdict === 'errada' && r.is_annulled === false);
  },

  /** Responde uma posição. O VEREDITO é do servidor. */
  async responder(db: Db, attemptId: string, ordinal: number, opcao: string): Promise<VereditoTentativa> {
    const r = await db.query<{ verdict: string }>(
      `SELECT canone_learning.answer_exam_attempt($1, $2, $3) AS verdict`,
      [attemptId, ordinal, opcao]
    );
    return { verdict: r.rows[0].verdict as VereditoTentativa['verdict'] };
  },

  /** Encerra a tentativa. */
  async finalizar(db: Db, attemptId: string): Promise<Tentativa> {
    const r = await db.query<Tentativa>(
      `SELECT * FROM canone_learning.finish_exam_attempt($1)`,
      [attemptId]
    );
    return r.rows[0];
  },

  /**
   * Revela o gabarito da tentativa. O banco recusa se a tentativa não
   * estiver concluída — a revelação antecipada é erro de servidor, não
   * erro de interface.
   */
  async revelar(db: Db, attemptId: string): Promise<RespostaRevelada[]> {
    const r = await db.query<RespostaRevelada>(
      `SELECT * FROM canone_learning.reveal_exam_key($1)`,
      [attemptId]
    );
    return r.rows;
  },
};
