/**
 * AS ROTAS DO PRODUTO — o que o assinante (e o visitante) chamam.
 * ============================================================================
 * A superfície HTTP do Cânone tinha UM endereço: o comander. O resto do
 * motor — o catálogo público e o fluxo da prova — existia no banco e nos
 * serviços, sem porta de entrada. Este arquivo é essa porta.
 *
 * TRÊS ÁREAS, TRÊS PAPÉIS
 *
 *   · /api/public/*    — sem login. O catálogo do que existe.
 *   · /api/auth/*      — o acesso: pedir link, trocar link por sessão.
 *   · /api/subscriber/* — a prova. Exige sessão.
 *
 * O QUE A ROTA NÃO FAZ
 *
 * Não calcula nota nem corrige item: isso continua exclusivamente no banco.
 * O gate comercial S9 exige assinatura/concessão vigente na entrada de TODA
 * rota do assinante, antes de chamar o serviço, e o PostgreSQL mantém RLS,
 * propriedade da tentativa e o segredo do gabarito como segunda barreira.
 *
 * O VEREDITO NÃO VOLTA ANTES DA HORA
 *
 * Responder uma questão devolve "resposta registrada" — e nada mais. O
 * acerto de cada item fica no servidor até a tentativa acabar: quem simula
 * a prova não recebe a gabarito no meio do caminho. A revelação é uma
 * rota à parte, e o banco recusa se a tentativa não estiver concluída.
 */
import type { Db } from '../db/driver.js';
import { withArea } from '../db/rls-context.js';
import { acesso } from '../areas/auth/conta.js';
import { catalogo } from '../areas/public/catalogo.js';
import { provas } from '../areas/subscriber/provas.js';

export interface ContextoApi {
  db: Db;
  corpo: unknown;
  parametros: Record<string, string>;
  /** A sessão do assinante (quando há). */
  sessao: { userId: string; token: string } | null;
  /** O Bearer cru, para encerrar a sessão. */
  token: string | null;
  /**
   * Entrega o link de acesso. O servidor injeta; sem injeção, a rota
   * recusa — porque devolver o link na resposta seria entregar o acesso
   * a quem pediu o link.
   */
  entregarLink?: (email: string, link: string, expiraEm: Date) => Promise<void>;
}

export interface RotaApi {
  metodo: string;
  caminho: RegExp;
  area: 'publica' | 'acesso' | 'assinante';
  /** Exige sessão de assinante. */
  autenticada: boolean;
  tratar(ctx: ContextoApi): Promise<unknown>;
}

function campo(corpo: unknown, nome: string): string {
  if (corpo && typeof corpo === 'object' && nome in (corpo as object)) {
    const v = (corpo as Record<string, unknown>)[nome];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  throw new Error(`Campo obrigatório ausente: ${nome}.`);
}

/** Número inteiro: aceita JSON number ou string numérica. */
function numeroDe(corpo: unknown, nome: string): number {
  if (corpo && typeof corpo === 'object' && nome in (corpo as object)) {
    const v = (corpo as Record<string, unknown>)[nome];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
    if (Number.isInteger(n)) return n;
  }
  throw new Error(`Campo obrigatório ausente: ${nome}.`);
}

function emailDe(corpo: unknown): string {
  const email = campo(corpo, 'email').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('E-mail inválido.');
  }
  return email;
}

/**
 * Oassinante TEM acesso?
 *
 * A prova é o produto pago: o acesso depende de assinatura ativa (ou de
 * entitlement concedido). Sem esta checagem, qualquer link de acesso —
 * que qualquer um pode pedir — daria direito ao gabarito.
 */
async function temAcesso(db: Db, userId: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM canone_commerce.subscription s
      WHERE s.user_id = $1
        AND s.status = 'ativa'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
     UNION ALL
     SELECT count(*)::int AS n
       FROM canone_commerce.entitlement e
      WHERE e.user_id = $1
        AND e.revoked_at IS NULL
        AND (e.expires_at IS NULL OR e.expires_at > now())`,
    [userId]
  );
  return r.rows.reduce((soma, x) => soma + x.n, 0) > 0;
}

/**
 * S9 · Porta única do assinante. Todas as operações da prova passam pelo
 * MESMO gate de entitlement na MESMA transação/ROLE da requisição.
 * RLS e propriedade da tentativa continuam sendo decisões do PostgreSQL.
 * Não recebe userId do cliente e nunca devolve o veredito de uma resposta.
 */
export async function comAssinante<T>(
  ctx: ContextoApi,
  executar: (tx: Db) => Promise<T>
): Promise<T> {
  const userId = ctx.sessao?.userId;
  if (!userId) throw new Error('Não autenticado.');
  return withArea(ctx.db, { area: 'assinante', userId }, async (tx) => {
    if (!(await temAcesso(tx, userId))) {
      throw new Error('Sem assinatura ativa ou concessão vigente.');
    }
    return executar(tx);
  });
}

export const rotasApi: RotaApi[] = [
  // ---------------------------------------------------------------------------
  // ACESSO
  // ---------------------------------------------------------------------------
  {
    metodo: 'POST',
    caminho: /^\/api\/auth\/link$/,
    area: 'acesso',
    autenticada: false,
    async tratar(ctx) {
      const email = emailDe(ctx.corpo);
      const pedido = await withArea(ctx.db, { area: 'acesso' }, (tx) =>
        acesso.pedirLink(tx, email)
      );
      if (!ctx.entregarLink) {
        // Sem canal de entrega, o link existiu mas não foi entregue. Dizer
        // isso é melhor do que fingir que foi.
        throw new Error('O envio do link de acesso não está configurado neste ambiente.');
      }
      await ctx.entregarLink(email, pedido.token, pedido.expiraEm);
      // A resposta é a MESMA exista ou não a conta: a rota não é oráculo.
      return { enviado: true };
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/auth\/sessao$/,
    area: 'acesso',
    autenticada: false,
    async tratar(ctx) {
      const token = campo(ctx.corpo, 'token');
      const sessao = await withArea(ctx.db, { area: 'acesso' }, (tx) =>
        acesso.abrirSessao(tx, token)
      );
      return {
        token: sessao.token,
        expiraEm: sessao.expiraEm.toISOString(),
      };
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/auth\/sair$/,
    area: 'acesso',
    autenticada: true,
    async tratar(ctx) {
      if (!ctx.sessao) throw new Error('Não autenticado.');
      await withArea(ctx.db, { area: 'acesso' }, (tx) =>
        acesso.encerrarSessao(tx, ctx.sessao!.token)
      );
      return { encerrada: true };
    },
  },

  // ---------------------------------------------------------------------------
  // PÚBLICO
  // ---------------------------------------------------------------------------
  {
    metodo: 'GET',
    caminho: /^\/api\/public\/catalogo$/,
    area: 'publica',
    autenticada: false,
    async tratar(ctx) {
      return withArea(ctx.db, { area: 'publica' }, async (tx) => ({
        planos: await catalogo.planos(tx),
        modulos: await catalogo.modulos(tx),
        assuntos: await catalogo.assuntos(tx),
      }));
    },
  },

  // ---------------------------------------------------------------------------
  // ASSINANTE — cada rota usa comAssinante, sem caminhos privilegiados paralelos
  // ---------------------------------------------------------------------------
  {
    metodo: 'GET',
    caminho: /^\/api\/subscriber\/provas$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      return comAssinante(ctx, async (tx) => ({ provas: await provas.disponiveis(tx) }));
    },
  },
  {
    metodo: 'GET',
    caminho: /^\/api\/subscriber\/provas\/([a-z0-9-]+)\/questoes$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const formId = ctx.parametros[1];
      return comAssinante(ctx, async (tx) => ({ questoes: await provas.questoes(tx, formId) }));
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/subscriber\/provas\/([a-z0-9-]+)\/tentativa$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const formId = ctx.parametros[1];
      return comAssinante(ctx, async (tx) => ({ tentativa: await provas.iniciar(tx, formId) }));
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/subscriber\/tentativas\/([a-z0-9-]+)\/respostas$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const tentativa = ctx.parametros[1];
      const ordinal = numeroDe(ctx.corpo, 'ordinal');
      const opcao = campo(ctx.corpo, 'opcao');
      if (ordinal < 1) throw new Error('Posição inválida.');
      if (!/^[A-E]$/i.test(opcao)) throw new Error('Alternativa inválida.');
      return comAssinante(ctx, async (tx) => {
        await provas.responder(tx, tentativa, ordinal, opcao.toUpperCase());
        // O gabarito/veredito NÃO sai enquanto a tentativa está aberta.
        return { registrada: true };
      });
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/subscriber\/tentativas\/([a-z0-9-]+)\/finalizar$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const tentativa = ctx.parametros[1];
      return comAssinante(ctx, async (tx) => {
        const t = await provas.finalizar(tx, tentativa);
        return {
          tentativa: t.id,
          status: t.status,
          respondidas: t.answered_count,
          corretas: t.correct_count,
          erradas: t.wrong_count,
          anuladas: t.annulled_count,
        };
      });
    },
  },
  {
    metodo: 'GET',
    caminho: /^\/api\/subscriber\/tentativas\/([a-z0-9-]+)\/caderno-erros$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const tentativa = ctx.parametros[1];
      return comAssinante(ctx, async (tx) => {
        const erros = await provas.cadernoDeErros(tx, tentativa);
        return { tentativa, total_erros: erros.length, erros };
      });
    },
  },
  {
    metodo: 'POST',
    caminho: /^\/api\/subscriber\/tentativas\/([a-z0-9-]+)\/revelar$/,
    area: 'assinante',
    autenticada: true,
    async tratar(ctx) {
      const tentativa = ctx.parametros[1];
      return comAssinante(ctx, async (tx) => ({ respostas: await provas.revelar(tx, tentativa) }));
    },
  },
];
