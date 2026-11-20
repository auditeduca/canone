/**
 * ÁREA PÚBLICA — o que qualquer pessoa vê, sem login.
 *
 * Tudo aqui lê de VIEW, nunca de tabela crua. A view é o contrato: se
 * amanhã a estrutura interna mudar, o frontend não sente.
 *
 * E a view é a barreira: `v_public_content` filtra por estado público, e
 * o gabarito não está em lugar nenhum desta camada.
 */
import type { Db } from '../../db/driver.js';

export interface PlanoPublico {
  id: string;
  key: string;
  name: string;
  description: string | null;
  billing_period: string;
  trial_days: number;
  /** NULL = preço ainda não definido. NUNCA 0. */
  price_cents: number | null;
  currency: string;
  sort_order: number;
}

export interface AssuntoPublico {
  id: string;
  key: string;
  label: string;
  description: string | null;
  ordinal: number;
  area_label: string;
  area_key: string;
}

export interface ModuloPublico {
  id: string;
  key: string;
  name: string;
  short_name: string;
  description: string | null;
  phase: string;
  ordinal: number;
  icon_key: string | null;
}

export interface ConteudoPublico {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  state: string;
  published_at: Date | null;
  content_type_key: string;
  family: string;
  subject_key: string | null;
  subject_label: string | null;
  subtopic_key: string | null;
  subtopic_label: string | null;
  difficulty_band: string | null;
  estimated_seconds: number | null;
  ordinal: number;
}

export interface ItemPublico {
  id: string;
  content_item_id: string;
  kind: string;
  difficulty: string;
  estimated_seconds: number | null;
  title: string;
  subject_id: string | null;
  subtopic_id: string | null;
  ordinal: number;
}

export const catalogo = {
  async planos(db: Db): Promise<PlanoPublico[]> {
    const r = await db.query<PlanoPublico>(
      `SELECT id, key, name, description, billing_period, trial_days, price_cents, currency, sort_order
         FROM canone_public.v_public_plan ORDER BY sort_order`
    );
    return r.rows;
  },

  async assuntos(db: Db): Promise<AssuntoPublico[]> {
    const r = await db.query<AssuntoPublico>(
      `SELECT id, key, label, description, ordinal, area_label, area_key
         FROM canone_public.v_public_subject ORDER BY ordinal`
    );
    return r.rows;
  },

  async modulos(db: Db): Promise<ModuloPublico[]> {
    const r = await db.query<ModuloPublico>(
      `SELECT id, key, name, short_name, description, phase, ordinal, icon_key
         FROM canone_public.v_public_module ORDER BY ordinal`
    );
    return r.rows;
  },

  async conteudos(db: Db, filtros: { contentTypeKey?: string; subjectKey?: string } = {}): Promise<ConteudoPublico[]> {
    const cond: string[] = [];
    const params: unknown[] = [];
    if (filtros.contentTypeKey) {
      params.push(filtros.contentTypeKey);
      cond.push(`content_type_key = $${params.length}`);
    }
    if (filtros.subjectKey) {
      params.push(filtros.subjectKey);
      cond.push(`subject_key = $${params.length}`);
    }
    const onde = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query<ConteudoPublico>(
      `SELECT id, key, title, summary, state, published_at, content_type_key, family,
              subject_key, subject_label, subtopic_key, subtopic_label,
              difficulty_band, estimated_seconds, ordinal
         FROM canone_public.v_public_content ${onde}
        ORDER BY ordinal, key`
    , params);
    return r.rows;
  },

  /**
   * Itens prontos para entrega — SEM gabarito.
   *
   * As alternativas NÃO vêm aqui. Elas vêm por endpoint autenticado, e o
   * gabarito nunca sai do servidor.
   */
  async itens(db: Db, filtros: { subjectId?: string } = {}): Promise<ItemPublico[]> {
    const params: unknown[] = [];
    let onde = '';
    if (filtros.subjectId) {
      params.push(filtros.subjectId);
      onde = 'WHERE subject_id = $1';
    }
    const r = await db.query<ItemPublico>(
      `SELECT id, content_item_id, kind, difficulty, estimated_seconds, title,
              subject_id, subtopic_id, ordinal
         FROM canone_public.v_public_item ${onde} ORDER BY ordinal`
    , params);
    return r.rows;
  },

  /**
   * O gabarito NUNCA é lido aqui. Esta função existe para deixar isso
   * explícito no código: se alguém precisar do gabarito, vai ter que
   * escrever uma consulta nova — e o revisor vai ver.
   */
  async gabarito(): Promise<never> {
    throw new Error(
      'O gabarito não é lido na área pública. Se você precisa dele para servir o item, ' +
        'o item só pode ser entregue a um usuário autenticado, pelo fluxo de simulação.'
    );
  },
};
