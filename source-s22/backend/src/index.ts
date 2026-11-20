/**
 * CÂNONE — backend.
 *
 * Ponto de entrada. Monta as peças e expõe a área pública e a área do
 * assinante. A área administrativa é montada à parte, porque exige
 * identidade de staff.
 *
 * A ASSINATURA É O CONTRATO: cada método já vem com o contexto correto
 * (transação + papel + usuário). Não existe um método que aceite
 * "userId" — a identidade vem do contexto da requisição, nunca do
 * argumento, e por isso não pode ser confundida com a de outra pessoa.
 */
import { createDb } from './db/index.js';
import type { Db } from './db/driver.js';
import { withArea } from './db/rls-context.js';
import { readEnv } from './config/env.js';
import { Vault, EnvSecretProvider, FileSecretProvider } from './config/secrets.js';
import { catalogo } from './areas/public/catalogo.js';
import { progresso } from './areas/subscriber/progresso.js';
import { provas } from './areas/subscriber/provas.js';
import { visaoDeUsuario, governanca } from './areas/admin/suporte.js';
import {
  catalogo as catalogoComandos,
  comandoPorId,
  executar as executarComando,
  previsualizar as previsualizarComando,
} from './areas/admin/comander.js';
import { governancaEstado } from './areas/admin/estado.js';
import type {
  CatalogoComando,
  EntradaComando,
  ResultadoComando,
} from './areas/admin/comander.js';
import type {
  ConcessaoGovernada,
  EstadoCadeia,
  EventoAuditado,
  ItemDaFila,
} from './areas/admin/estado.js';
import type {
  PlanoPublico, AssuntoPublico, ModuloPublico, ConteudoPublico
} from './areas/public/catalogo.js';
import type {
  ProgressoAssunto, ItemDevido, EventoHistorico, Grade, Base
} from './areas/subscriber/progresso.js';
import type {
  ProvaDisponivel, VereditoTentativa, RespostaRevelada, Tentativa
} from './areas/subscriber/provas.js';
import type {
  Concessao, ProgressoDoAluno, SaudeConteudo, AlegacaoRecusada, SituacaoProva
} from './areas/admin/suporte.js';

export interface ContextoUsuario {
  userId: string;
  requestId?: string;
}

export interface AreaPublica {
  planos(): Promise<PlanoPublico[]>;
  assuntos(): Promise<AssuntoPublico[]>;
  modulos(): Promise<ModuloPublico[]>;
  conteudos(filtros?: { contentTypeKey?: string; subjectKey?: string }): Promise<ConteudoPublico[]>;
}

export interface AreaAssinante {
  porAssunto(): Promise<ProgressoAssunto[]>;
  devidos(limite?: number): Promise<ItemDevido[]>;
  historico(limite?: number): Promise<EventoHistorico[]>;
  registrar(entrada: {
    itemId: string;
    grade: Grade;
    basis: Base;
    correct?: boolean | null;
    durationMs?: number | null;
  }): Promise<{ state: string; due_at: Date | null; last_grade: string }>;
  recalcularMaestria(subjectId: string): Promise<void>;
  /** As provas já aplicadas. */
  provasDisponiveis(): Promise<ProvaDisponivel[]>;
  /** Abre uma tentativa de prova. */
  iniciarProva(examFormId: string): Promise<string>;
  /** Responde e recebe o VEREDITO do servidor. */
  responderProva(attemptId: string, ordinal: number, opcao: string): Promise<VereditoTentativa>;
  /** Encerra a tentativa. */
  finalizarProva(attemptId: string): Promise<Tentativa>;
  /** Revela o gabarito — só depois de a tentativa terminar. */
  revelarGabarito(attemptId: string): Promise<RespostaRevelada[]>;
}

export interface AreaAdmin {
  conceder(entrada: {
    staffUserId: string;
    subjectUserId: string;
    reason: string;
    ticketRef?: string | null;
    scope?: Concessao['scope'];
    horasValidade?: number;
  }): Promise<Concessao>;
  revogar(grantId: string, motivo: string): Promise<void>;
  /** O CATÁLOGO de comandos — o contrato da área do administrador. */
  comandos(): CatalogoComando[];
  /** PRÉVIA: a mesma execução, desfeita. O que o banco faria. */
  previa(id: string, entrada: EntradaComando): Promise<ResultadoComando>;
  /** EXECUÇÃO: a mesma função, confirmada. */
  executar(id: string, entrada: EntradaComando): Promise<ResultadoComando>;
  /** O ESTADO: fila, concessões, auditoria e a verificação da cadeia. */
  estado(): Promise<{
    fila: ItemDaFila[];
    concessoes: ConcessaoGovernada[];
    auditoria: EventoAuditado[];
    cadeia: EstadoCadeia;
  }>;
  lerProgresso(entrada: {
    staffUserId: string;
    subjectUserId: string;
    grantId: string;
  }): Promise<ProgressoDoAluno[]>;
  concessoesAtivas(): Promise<Concessao[]>;
  saudeConteudo(): Promise<SaudeConteudo[]>;
  alegacoesRecusadas(): Promise<AlegacaoRecusada[]>;
  situacaoProvas(): Promise<SituacaoProva[]>;
}

export interface Canone {
  db: Db;
  vault: Vault;
  publico: AreaPublica;
  assinante(ctx: ContextoUsuario): AreaAssinante;
  admin(ctx: ContextoUsuario): AreaAdmin;
}

export interface CreateCanoneOptions {
  /** Banco já pronto (testes, servidor já iniciado). */
  db?: Db;
  /** Cofre já pronto. */
  vault?: Vault;
}

export async function createCanone(opts: CreateCanoneOptions = {}): Promise<Canone> {
  // Quando o banco já vem pronto (teste, servidor já iniciado), a
  // validação de ambiente de conexão não se aplica — exigir DATABASE_URL
  // para usar um banco injetado só faria o teste depender do deploy.
  const env = opts.db ? null : readEnv();
  const db = opts.db ?? (await createDb(env!));

  const vault =
    opts.vault ??
    new Vault(
      env && env.pgliteDataDir && !env.databaseUrl
        ? new FileSecretProvider(`${env.pgliteDataDir}/secrets`)
        : new EnvSecretProvider()
    );

  const publica = <T>(fn: (tx: Db) => Promise<T>) =>
    withArea(db, { area: 'publica' }, fn);

  const doAssinante = <T>(ctx: ContextoUsuario, fn: (tx: Db) => Promise<T>) =>
    withArea(
      db,
      { area: 'assinante', userId: ctx.userId, requestId: ctx.requestId ?? null },
      fn
    );

  const doStaff = <T>(ctx: ContextoUsuario, fn: (tx: Db) => Promise<T>) =>
    withArea(db, { area: 'staff', userId: ctx.userId, requestId: ctx.requestId ?? null }, fn);

  return {
    db,
    vault,
    publico: {
      planos: () => publica((tx) => catalogo.planos(tx)),
      assuntos: () => publica((tx) => catalogo.assuntos(tx)),
      modulos: () => publica((tx) => catalogo.modulos(tx)),
      conteudos: (filtros) => publica((tx) => catalogo.conteudos(tx, filtros)),
    },
    assinante: (ctx) => ({
      porAssunto: () => doAssinante(ctx, (tx) => progresso.porAssunto(tx)),
      devidos: (limite = 50) => doAssinante(ctx, (tx) => progresso.devidos(tx, limite)),
      historico: (limite = 100) => doAssinante(ctx, (tx) => progresso.historico(tx, limite)),
      registrar: (entrada) => doAssinante(ctx, (tx) => progresso.registrar(tx, entrada)),
      recalcularMaestria: (subjectId) =>
        doAssinante(ctx, (tx) => progresso.recalcularMaestria(tx, subjectId)),
      provasDisponiveis: () => doAssinante(ctx, (tx) => provas.disponiveis(tx)),
      iniciarProva: (examFormId) => doAssinante(ctx, (tx) => provas.iniciar(tx, examFormId)),
      responderProva: (attemptId, ordinal, opcao) =>
        doAssinante(ctx, (tx) => provas.responder(tx, attemptId, ordinal, opcao)),
      finalizarProva: (attemptId) => doAssinante(ctx, (tx) => provas.finalizar(tx, attemptId)),
      revelarGabarito: (attemptId) => doAssinante(ctx, (tx) => provas.revelar(tx, attemptId)),
    }),
    admin: (ctx) => ({
      conceder: (entrada) => doStaff(ctx, (tx) => visaoDeUsuario.conceder(tx, entrada)),
      revogar: (grantId, motivo) =>
        doStaff(ctx, (tx) => visaoDeUsuario.revogar(tx, grantId, ctx.userId, motivo)),
      lerProgresso: (entrada) => doStaff(ctx, (tx) => visaoDeUsuario.lerProgresso(tx, entrada)),
      concessoesAtivas: () => doStaff(ctx, (tx) => visaoDeUsuario.concessoesAtivas(tx, ctx.userId)),
      saudeConteudo: () => doStaff(ctx, (tx) => governanca.saudeConteudo(tx)),
      alegacoesRecusadas: () => doStaff(ctx, (tx) => governanca.alegacoesRecusadas(tx)),
      situacaoProvas: () => doStaff(ctx, (tx) => governanca.situacaoProvas(tx)),
      // O COMANDER: a área do administrador como console de comandos.
      comandos: () => catalogoComandos(),
      previa: (id, entrada) => {
        const cmd = comandoPorId(id);
        if (!cmd) throw new Error(`Comando desconhecido: ${id}`);
        return previsualizarComando(db, cmd, entrada, {
          userId: ctx.userId,
          requestId: ctx.requestId ?? null,
        });
      },
      executar: (id, entrada) => {
        const cmd = comandoPorId(id);
        if (!cmd) throw new Error(`Comando desconhecido: ${id}`);
        return executarComando(db, cmd, entrada, {
          userId: ctx.userId,
          requestId: ctx.requestId ?? null,
        });
      },
      estado: () =>
        doStaff(ctx, async (tx) => {
          const [fila, concessoes, auditoria, cadeia] = await Promise.all([
            governancaEstado.fila(tx),
            governancaEstado.concessoes(tx),
            governancaEstado.auditoria(tx),
            governancaEstado.cadeia(tx),
          ]);
          return { fila, concessoes, auditoria, cadeia };
        }),
    }),
  };
}

export { withArea, withSystem } from './db/rls-context.js';
export type { RequestContext } from './db/rls-context.js';
export * from './config/secrets.js';
export { readEnv, type Env } from './config/env.js';
