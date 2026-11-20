/**
 * HTTP — a superfície que o comander fala.
 * ============================================================================
 * Sem framework, sem mágica: `node:http` e quatro rotas. A escolha é
 * deliberada — o que a área do administrador FAZ não é o que o projeto
 * querReads bonito; é o que o projeto quer que seja AUDITÁVEL.
 *
 * A AUTENTICAÇÃO
 *
 * O operador chega com um token Bearer. O token NÃO é uma senha de
 * usuário: ele identifica o OPERADOR e o NÍVEL (staff ou admin) a partir
 * da configuração, e o id do usuário staff vem da mesma configuração. É
 * uma simplificação honesta e explícita: o Cânone ainda não tem diretório
 * de Staff, e fingir que tem seria inventar.
 *
 * O NÍVEL decide o PAPEL com que o comando roda (canone_staff ou
 * canone_admin) — e o banco decide o resto. Um token de staff que tenta
 * executar um comando de admin não é barrado pelo HTTP: é barrado pelo
 * banco, porque o comando roda como staff.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ
 *
 * Não corrige provas nem decide conteúdo. Implementa apenas proteções
 * HTTP de fronteira (origem permitida, 64 KiB de corpo e cabeçalhos seguros),
 * encaminhando a operação às regras do backend e do PostgreSQL.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Db } from '../db/driver.js';
import { withArea } from '../db/rls-context.js';
import {
  catalogo,
  comandoPorId,
  executar,
  previsualizar,
  type EntradaComando,
  type NivelComando,
  type ResultadoComando,
} from '../areas/admin/comander.js';
import { governanca } from '../areas/admin/suporte.js';
import { acesso } from '../areas/auth/conta.js';
import { rotasApi, type ContextoApi } from './api.js';
import { governancaEstado } from '../areas/admin/estado.js';

export interface Operador {
  userId: string;
  nivel: NivelComando;
}

export interface ConfigHttp {
  db: Db;
  /** Token do nível staff. */
  tokenStaff: string;
  /** Token do nível admin. */
  tokenAdmin: string;
  /** Id do usuário staff que assume as ações. */
  staffUserId: string;
  /** Id do usuário admin que assume as ações. */
  adminUserId: string;
  /**
   * Origem do app permitida (CORS). SEM ela, o comander não responde a
   * outra origem: o padrão é não abrir porta.
   */
  origem?: string;
  porta?: number;
  /**
   * Entrega do link de acesso (e-mail). SEM ela, /api/auth/link recusa:
   * devolver o link na resposta seria entregar o acesso a quem o pediu.
   */
  entregarLink?: (email: string, link: string, expiraEm: Date) => Promise<void>;
}

interface Rota {
  metodo: string;
  caminho: RegExp;
  tratar(ctx: ContextoHttp): Promise<unknown>;
}

interface ContextoHttp {
  db: Db;
  req: IncomingMessage;
  res: ServerResponse;
  operador: Operador | null;
  corpo: unknown;
  parametros: Record<string, string>;
  /** A sessão do assinante (o Bearer de identity.session). */
  sessao: { userId: string; token: string } | null;
}

function json(res: ServerResponse, status: number, dados: unknown): void {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  res.end(corpo);
}

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  let tamanho = 0;
  const LIMITE_CORPO = 64 * 1024;
  for await (const p of req) {
    const bloco = p as Buffer;
    tamanho += bloco.length;
    if (tamanho > LIMITE_CORPO) {
      throw new Error('Corpo da requisição excede 64 KiB.');
    }
    partes.push(bloco);
  }
  if (partes.length === 0) return {};
  const bruto = Buffer.concat(partes).toString('utf8');
  try {
    return JSON.parse(bruto);
  } catch {
    throw new Error('O corpo da requisição não é JSON válido.');
  }
}

function tokenDe(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
}

/**
 * Reconhece o operador pelo token.
 *
 * O tokenstaff e o tokenadmin são separados de propósito: um token de
 * staff não é "quase" um token de admin, é outra coisa.
 */
export function reconhecerOperador(
  token: string | null,
  cfg: Pick<ConfigHttp, 'tokenStaff' | 'tokenAdmin' | 'staffUserId' | 'adminUserId'>
): Operador | null {
  if (!token) return null;
  if (token === cfg.tokenAdmin) return { userId: cfg.adminUserId, nivel: 'admin' };
  if (token === cfg.tokenStaff) return { userId: cfg.staffUserId, nivel: 'staff' };
  return null;
}

function entradaDe(corpo: unknown): EntradaComando {
  if (corpo && typeof corpo === 'object' && 'entrada' in (corpo as object)) {
    const e = (corpo as { entrada: unknown }).entrada;
    if (e && typeof e === 'object') return e as EntradaComando;
  }
  return {};
}

export function criarServidor(cfg: ConfigHttp): Server {
  const rotas: Rota[] = [
    {
      metodo: 'GET',
      caminho: /^\/api\/comander\/comandos$/,
      async tratar(ctx) {
        return { comandos: catalogo() };
      },
    },
    {
      metodo: 'GET',
      caminho: /^\/api\/comander\/estado$/,
      async tratar(ctx) {
        if (!ctx.operador) throw new Error('Não autenticado.');
        const [saude, provas, recusas, fila, concessoes, auditoria, cadeia] = await Promise.all([
          governanca.saudeConteudo(ctx.db),
          governanca.situacaoProvas(ctx.db),
          governanca.alegacoesRecusadas(ctx.db),
          governancaEstado.fila(ctx.db),
          governancaEstado.concessoes(ctx.db),
          governancaEstado.auditoria(ctx.db),
          governancaEstado.cadeia(ctx.db),
        ]);
        return { saude, provas, recusas, fila, concessoes, auditoria, cadeia };
      },
    },
    {
      metodo: 'POST',
      caminho: /^\/api\/comander\/comandos\/([a-z_]+)\/previa$/,
      async tratar(ctx) {
        if (!ctx.operador) throw new Error('Não autenticado.');
        const id = ctx.parametros[1];
        const cmd = comandoPorId(id);
        if (!cmd) throw new Error(`Comando desconhecido: ${id}`);
        const r: ResultadoComando = await previsualizar(
          ctx.db,
          cmd,
          entradaDe(ctx.corpo),
          { userId: ctx.operador.userId }
        );
        return r;
      },
    },
    {
      metodo: 'POST',
      caminho: /^\/api\/comander\/comandos\/([a-z_]+)$/,
      async tratar(ctx) {
        if (!ctx.operador) throw new Error('Não autenticado.');
        const id = ctx.parametros[1];
        const cmd = comandoPorId(id);
        if (!cmd) throw new Error(`Comando desconhecido: ${id}`);
        const r: ResultadoComando = await executar(
          ctx.db,
          cmd,
          entradaDe(ctx.corpo),
          { userId: ctx.operador.userId }
        );
        return r;
      },
    },
  ];

  // As rotas do produto (público, acesso e assinante).
  for (const r of rotasApi) {
    rotas.push({
      metodo: r.metodo,
      caminho: r.caminho,
      async tratar(ctx) {
        const api: ContextoApi = {
          db: ctx.db,
          corpo: ctx.corpo,
          parametros: ctx.parametros,
          sessao: ctx.sessao,
          token: tokenDe(ctx.req),
          entregarLink: cfg.entregarLink,
        };
        if (r.autenticada && !api.sessao) throw new Error('Não autenticado.');
        return r.tratar(api);
      },
    });
  }

  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = tokenDe(req);
      const operador = reconhecerOperador(token, cfg);

      // CORS SÓ QUANDO A ORIGEM É CONFIGURADA. Sem `origem`, o comander
      // não responde a outra origem — o padrão seguro é o que não abre
      // porta. A origem do app é sempre uma decisão de implantação.
      // A origem recebida deve corresponder à configuração. CORS sozinho
      // é uma política do navegador e não impede o servidor de executar POST.
      const requestOrigin = req.headers.origin;
      if (requestOrigin && requestOrigin !== cfg.origem) {
        json(res, 403, { erro: 'Origem não autorizada.' });
        return;
      }
      if (cfg.origem) {
        res.setHeader('access-control-allow-origin', cfg.origem);
        res.setHeader('access-control-allow-headers', 'authorization, content-type');
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
        res.setHeader('vary', 'origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // A sessão do assinante: o Bearer resolve no identity.session.
      // Nenhuma consulta com o papel técnico — a resolução também é feita
      // no papel de acesso, dentro da área.
      let sessao: { userId: string; token: string } | null = null;
      if (token && token !== cfg.tokenStaff && token !== cfg.tokenAdmin) {
        const usuario = await withArea(cfg.db, { area: 'acesso' }, (tx) =>
          acesso.usuarioDaSessao(tx, token)
        );
        if (usuario) sessao = { userId: usuario, token };
      }

      const rota = rotas.find((r) => r.metodo === req.method && r.caminho.test(url.pathname));
      if (!rota) {
        json(res, 404, { erro: 'Rota não encontrada.' });
        return;
      }

      let corpo: unknown = {};
      if (req.method === 'POST') {
        try {
          corpo = await lerCorpo(req);
        } catch (e) {
          const mensagem = (e as Error).message;
          json(res, /64 KiB/.test(mensagem) ? 413 : 400, { erro: mensagem });
          return;
        }
      }

      const parametros = (rota.caminho.exec(url.pathname) ?? []).slice(1) as string[];
      const par = {} as Record<string, string>;
      parametros.forEach((v, i) => {
        par[String(i + 1)] = v;
      });

      try {
        const dados = await rota.tratar({
          db: cfg.db, req, res, operador, corpo, parametros: par, sessao,
        });
        json(res, 200, dados);
      } catch (e) {
        const anyE = e as { message?: string; code?: string };
        const mensagem = anyE?.message ?? String(e);
        const status = /Não autenticado/i.test(mensagem) ? 401 : 400;
        json(res, status, { erro: mensagem, codigo: anyE?.code });
      }
    })();
  });
}

export interface ServidorHttp {
  server: Server;
  /** Porta efetivamente usada. */
  porta: number;
  fechar(): Promise<void>;
}

export async function subirServidor(cfg: ConfigHttp): Promise<ServidorHttp> {
  const server = criarServidor(cfg);
  const porta = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(cfg.porta ?? 8787, () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : (cfg.porta ?? 8787));
    });
  });
  return {
    server,
    porta,
    fechar: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
