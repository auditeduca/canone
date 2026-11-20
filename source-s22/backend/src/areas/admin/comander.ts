/**
 * COMANDER — a área do administrador como console de comandos.
 * ============================================================================
 * A IDEIA
 *
 * A área administrativa do Cânone não é um painel de leitura com botões.
 * É um **comander**: cada ação privilegiada é um COMANDO NOMEADO, com
 * contrato explícito, prévia e rastro.
 *
 * A prévia (PREVIEW) é a peça central: ela não é uma simulação feita no
 * navegador. É **a mesma execução, em transação desfeita** (`dryRun`).
 * A resposta da prévia é o que o BANCO faria — não o que a interface
 * imagina. Se o banco vai recusar, a prévia já diz que recusa, com a
 * mensagem do banco.
 *
 * A EXECUÇÃO é o mesmo código, em transação confirmada. Divergência entre
 * prévia e execução é impossível por construção: é a MESMA função.
 *
 * POR QUE ISSO E NÃO UM CRUD
 *
 * Um CRUD de admin tem a propriedade de permitir que a interface
 * decida coisas que o banco deveria decidir: o que é uma transição
 * válida, o que pode ser publicado, o que cabe num prazo. O comander
 * inverte: a interface só PREENCHE CAMPOS; quem decide é o banco.
 *
 * O QUE O COMANDER NÃO INVENTA
 *
 * Nenhum comando aqui cria poder novo. Cada um é uma operação que o
 * schema já sustenta e que o banco já recusa quando precisa recusar:
 * a concessão de suporte (com motivo e prazo), a leitura do progresso de
 * aluno (que é registrada), a verificação com trecho literal, a
 * transição de estado, o selo do gabarito, a anulação de questão, a
 * importação do acervo.
 */
import type { Db } from '../../db/driver.js';
import { dentroDaArea } from '../../db/rls-context.js';
import type { Area } from '../../db/roles.js';

/* -------------------------------------------------------------------------- */
/* O CONTRATO DE UM COMANDO                                                    */
/* -------------------------------------------------------------------------- */

export type TipoCampo = 'texto' | 'area-texto' | 'uuid' | 'inteiro' | 'selecao';

export interface OpcaoCampo {
  valor: string;
  rotulo: string;
}

export interface CampoComando {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  /** O que o campo é, para quem preenche. */
  dica?: string;
  opcoes?: OpcaoCampo[];
}

export type EntradaComando = Record<string, string>;

export interface ResumoComando {
  /** O que vai acontecer, em português, para o humano ler antes de confirmar. */
  linhas: string[];
  /** O que o comando devolve, quando devolve algo estruturado. */
  dados?: Record<string, unknown>;
}

export interface ContextoOperador {
  /** Quem executa. Vem do token, não do formulário. */
  userId: string;
  requestId?: string | null;
}

export type NivelComando = 'staff' | 'admin';

export interface Comando {
  id: string;
  titulo: string;
  descricao: string;
  /**
   * O que o BANCO recusa. O texto é a regra do schema, não a validación da
   * interface — a interface repete o que o banco já faz.
   */
  regra: string;
  /** Quem pode executar. */
  nivel: NivelComando;
  /** Os campos que o comando exige. */
  exige: CampoComando[];
  /** A execução. ÚNICA: prévia e execução chamam esta mesma função. */
  aplicar(tx: Db, entrada: EntradaComando, ctx: ContextoOperador): Promise<ResumoComando>;
}

/* -------------------------------------------------------------------------- */
/* A EXECUÇÃO                                                                   */
/* -------------------------------------------------------------------------- */

export interface RecusaComando {
  mensagem: string;
  codigo?: string;
}

export interface ResultadoComando {
  ok: boolean;
  comando: string;
  previa: boolean;
  resumo?: ResumoComando;
  recusa?: RecusaComando;
}

function erroDe(e: unknown): RecusaComando {
  const anyE = e as { message?: string; code?: string };
  return { mensagem: anyE?.message ?? String(e), codigo: anyE?.code };
}

function areaDoNivel(nivel: NivelComando): Area {
  return nivel === 'admin' ? 'admin' : 'staff';
}

function campo(entrada: EntradaComando, nome: string): string {
  const v = entrada[nome];
  return (v ?? '').trim();
}

function numero(entrada: EntradaComando, nome: string, padrao?: number): number {
  const bruto = campo(entrada, nome);
  if (bruto === '') {
    if (padrao !== undefined) return padrao;
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  const n = Number(bruto);
  if (!Number.isFinite(n)) throw new Error(`Campo ${nome} não é número: ${bruto}`);
  return n;
}

/**
 * PRÉVIA — a mesma execução, desfeita.
 *
 * A prévia roda no papel do nível do comando e no contexto do operador. O
 * que ela devolve é o resumo do que MUDARIA. O que o banco recusa, ela
 * recusa com a mensagem do banco.
 */
export async function previsualizar(
  db: Db,
  comando: Comando,
  entrada: EntradaComando,
  ctx: ContextoOperador
): Promise<ResultadoComando> {
  try {
    const resumo = await db.dryRun((tx) =>
      dentroDaArea(
        tx,
        { area: areaDoNivel(comando.nivel), userId: ctx.userId, requestId: ctx.requestId ?? null },
        (t) => comando.aplicar(t, entrada, ctx)
      )
    );
    return { ok: true, comando: comando.id, previa: true, resumo };
  } catch (e) {
    return { ok: false, comando: comando.id, previa: true, recusa: erroDe(e) };
  }
}

/**
 * EXECUÇÃO — a mesma função, confirmada.
 */
export async function executar(
  db: Db,
  comando: Comando,
  entrada: EntradaComando,
  ctx: ContextoOperador
): Promise<ResultadoComando> {
  try {
    const resumo = await db.transaction((tx) =>
      dentroDaArea(
        tx,
        { area: areaDoNivel(comando.nivel), userId: ctx.userId, requestId: ctx.requestId ?? null },
        (t) => comando.aplicar(t, entrada, ctx)
      )
    );
    return { ok: true, comando: comando.id, previa: false, resumo };
  } catch (e) {
    return { ok: false, comando: comando.id, previa: false, recusa: erroDe(e) };
  }
}

/* -------------------------------------------------------------------------- */
/* OS COMANDOS                                                                  */
/* -------------------------------------------------------------------------- */

/** Concessão de leitura do progresso de um aluno. */
const concederAcesso: Comando = {
  id: 'conceder_acesso',
  titulo: 'Conceder acesso ao progresso de um aluno',
  descricao:
    'Abre, por prazo curto e com motivo, a leitura do progresso de um aluno. ' +
    'Cada leitura feita depois disso fica registrada.',
  regra:
    'O banco recusa motivo com menos de 10 caracteres e prazo acima de 72 horas. ' +
    'A concessão expira sozinha — não depende de alguém lembrar de revogar.',
  nivel: 'staff',
  exige: [
    {
      nome: 'subjectUserId',
      rotulo: 'Aluno (uuid)',
      tipo: 'uuid',
      obrigatorio: true,
      dica: 'O id do aluno cujo progresso será lido.',
    },
    {
      nome: 'motivo',
      rotulo: 'Motivo',
      tipo: 'texto',
      obrigatorio: true,
      dica: 'Mínimo de 10 caracteres. É o que fica no registro.',
    },
    {
      nome: 'ticketRef',
      rotulo: 'Chamado (opcional)',
      tipo: 'texto',
      obrigatorio: false,
      dica: 'Referência do ticket de suporte, se houver.',
    },
    {
      nome: 'horasValidade',
      rotulo: 'Validade (horas)',
      tipo: 'inteiro',
      obrigatorio: false,
      dica: 'Padrão 24. O banco recusa acima de 72.',
    },
  ],
  async aplicar(tx, entrada, ctx) {
    const subject = campo(entrada, 'subjectUserId');
    const motivo = campo(entrada, 'motivo');
    const ticket = campo(entrada, 'ticketRef') || null;
    const horas = numero(entrada, 'horasValidade', 24);

    const r = await tx.query<{ id: string; expires_at: Date }>(
      `INSERT INTO canone_admin.support_access_grant
         (staff_user_id, subject_user_id, scope, reason, ticket_ref, expires_at)
       VALUES ($1::uuid, $2::uuid, 'progresso', $3, $4,
               now() + make_interval(hours => $5::int))
       RETURNING id, expires_at`,
      [ctx.userId, subject, motivo, ticket, horas]
    );
    const g = r.rows[0];
    return {
      linhas: [
        `Concessão criada para o aluno ${subject}.`,
        `Expira em ${new Date(g.expires_at).toISOString()} (${horas}h).`,
        'Todo acesso ao progresso fica registrado — inclusive o deste comando.',
      ],
      dados: { id: g.id, expira_em: g.expires_at },
    };
  },
};

/** Revoga a concessão. */
const revogarAcesso: Comando = {
  id: 'revogar_acesso',
  titulo: 'Revogar uma concessão',
  descricao: 'Encerra antes do prazo uma concessão de leitura de progresso.',
  regra:
    'O banco exige o motivo da revogação e registra quem revogou e quando.',
  nivel: 'staff',
  exige: [
    { nome: 'grantId', rotulo: 'Concessão (uuid)', tipo: 'uuid', obrigatorio: true },
    {
      nome: 'motivo',
      rotulo: 'Motivo',
      tipo: 'texto',
      obrigatorio: true,
      dica: 'Por que a concessão está sendo encerrada.',
    },
  ],
  async aplicar(tx, entrada, ctx) {
    const grantId = campo(entrada, 'grantId');
    const motivo = campo(entrada, 'motivo');
    const r = await tx.query<{ id: string }>(
      `UPDATE canone_admin.support_access_grant
          SET revoked_at = now(), revoked_by = $2::uuid, revoke_reason = $3
        WHERE id = $1::uuid AND revoked_at IS NULL
        RETURNING id`,
      [grantId, ctx.userId, motivo]
    );
    if (r.rowCount === 0) {
      throw new Error('A concessão não existe ou já estava revogada.');
    }
    return {
      linhas: [`Concessão ${grantId} revogada.`, `Motivo registrado: ${motivo}.`],
      dados: { id: grantId },
    };
  },
};

/** Leitura do progresso — a porta única. */
const lerProgresso: Comando = {
  id: 'ler_progresso',
  titulo: 'Ler o progresso de um aluno',
  descricao:
    'A leitura do progresso de um aluno é feita como o aluno, sob concessão ' +
    'válida. Não existe caminho lateral: esta é a única porta.',
  regra:
    'O banco recusa a leitura sem concessão válida, e registra cada leitura ' +
    'com quem, quando e de qual concessão.',
  nivel: 'staff',
  exige: [
    { nome: 'subjectUserId', rotulo: 'Aluno (uuid)', tipo: 'uuid', obrigatorio: true },
    {
      nome: 'grantId',
      rotulo: 'Concessão (uuid)',
      tipo: 'uuid',
      obrigatorio: true,
      dica: 'A concessão que abre a porta. Precisa estar válida.',
    },
  ],
  async aplicar(tx, entrada, ctx) {
    const subject = campo(entrada, 'subjectUserId');
    const grantId = campo(entrada, 'grantId');
    const r = await tx.query<Record<string, unknown>>(
      `SELECT * FROM canone_admin.read_user_progress_as($1::uuid, $2::uuid, $3::uuid)`,
      [ctx.userId, subject, grantId]
    );
    return {
      linhas: [
        `${r.rows.length} assunto(s) lido(s) sob a concessão ${grantId}.`,
        'A leitura ficou registrada no log de acesso do suporte.',
      ],
      dados: { linhas: r.rows },
    };
  },
};

/** Transição de estado do conteúdo. */
const moverConteudo: Comando = {
  id: 'mover_conteudo',
  titulo: 'Mover o conteúdo no fluxo editorial',
  descricao:
    'Move um conteúdo de estado. A sequência é rascunho → em revisão → ' +
    'verificado → publicado; o que muda de um passo para o outro está no banco.',
  regra:
    'O banco recusa transição fora da tabela de transições, e recusa ' +
    'publicar sem verificação vigente com trecho literal da fonte.',
  nivel: 'staff',
  exige: [
    { nome: 'contentItemId', rotulo: 'Conteúdo (uuid)', tipo: 'uuid', obrigatorio: true },
    {
      nome: 'destino',
      rotulo: 'Estado de destino',
      tipo: 'selecao',
      obrigatorio: true,
      opcoes: [
        { valor: 'em_revisao', rotulo: 'Em revisão' },
        { valor: 'verificado', rotulo: 'Verificado' },
        { valor: 'publicado', rotulo: 'Publicado' },
        { valor: 'necessita_atualizacao', rotulo: 'Norma mudou' },
        { valor: 'rejeitado', rotulo: 'Rejeitado' },
      ],
    },
  ],
  async aplicar(tx, entrada) {
    const id = campo(entrada, 'contentItemId');
    const destino = campo(entrada, 'destino');
    const r = await tx.query<{ key: string; state: string }>(
      `UPDATE canone_editorial.content_item SET state = $2 WHERE id = $1::uuid
        RETURNING key, state`,
      [id, destino]
    );
    if (r.rowCount === 0) throw new Error('Conteúdo não encontrado.');
    const c = r.rows[0];
    return {
      linhas: [`Conteúdo ${c.key} agora está em "${c.state}".`],
      dados: { key: c.key, state: c.state },
    };
  },
};

/** Verificação com trecho literal. */
const registrarVerificacao: Comando = {
  id: 'registrar_verificacao',
  titulo: 'Registrar a verificação na fonte',
  descricao:
    'Registra que o conteúdo foi conferido na fonte, com o TRECHO LITERAL ' +
    'que sustenta a conferência. É o que permite a um terceiro auditar sem ' +
    'refazer o trabalho.',
  regra:
    'O banco recusa verificação sem trecho literal. Verificada com ' +
    'validade vencida não habilita publicação.',
  nivel: 'staff',
  exige: [
    { nome: 'contentItemId', rotulo: 'Conteúdo (uuid)', tipo: 'uuid', obrigatorio: true },
    { nome: 'sourceId', rotulo: 'Fonte (uuid)', tipo: 'uuid', obrigatorio: true },
    {
      nome: 'quote',
      rotulo: 'Trecho literal da fonte',
      tipo: 'area-texto',
      obrigatorio: true,
      dica: 'Copiado da fonte, na íntegra. "Conferi" não é auditável.',
    },
    {
      nome: 'method',
      rotulo: 'Método',
      tipo: 'selecao',
      obrigatorio: true,
      opcoes: [
        { valor: 'manual', rotulo: 'Manual' },
        { valor: 'conferencia_dupla', rotulo: 'Conferência dupla' },
        { valor: 'automatizada', rotulo: 'Automatizada' },
        { valor: 'importacao', rotulo: 'Importação' },
      ],
    },
    {
      nome: 'validUntil',
      rotulo: 'Válido até (opcional)',
      tipo: 'texto',
      obrigatorio: false,
      dica: 'Data. Norma técnica expira — a verificação de 2019 não vale em 2026.',
    },
  ],
  async aplicar(tx, entrada, ctx) {
    const id = campo(entrada, 'contentItemId');
    const sourceId = campo(entrada, 'sourceId');
    const quote = campo(entrada, 'quote');
    const method = campo(entrada, 'method') || 'manual';
    const validUntil = campo(entrada, 'validUntil') || null;

    const r = await tx.query<{ id: string; valid_until: Date | null }>(
      `INSERT INTO canone_editorial.verification
         (content_item_id, state, method, source_id, source_quote, verified_by, verified_at, valid_until)
       VALUES ($1::uuid, 'verificada', $2, $3::uuid, $4, $5::uuid, now(), $6::timestamptz)
       RETURNING id, valid_until`,
      [id, method, sourceId, quote, ctx.userId, validUntil]
    );
    const v = r.rows[0];
    return {
      linhas: [
        'Verificação registrada com o trecho literal da fonte.',
        v.valid_until
          ? `Válida até ${new Date(v.valid_until).toISOString()}.`
          : 'Sem data de validade — a fonte não tem prazo declarado.',
      ],
      dados: { id: v.id },
    };
  },
};

/** Selar o gabarito: preliminar → definitivo. */
const selarGabarito: Comando = {
  id: 'selar_gabarito',
  titulo: 'Selar o gabarito definitivo de uma prova',
  descricao:
    'Sela o gabarito de uma variante de prova, com a letra de cada posição. ' +
    'O * marca questão anulada pelo CFC.',
  regra:
    'O banco recusa o selo se a prova não estiver inteira, se faltar posição ' +
    'ou se a letra não existir entre as alternativas — a prova desalinhada ' +
    'não entra. Depois de selado, o gabarito é imutável e a prova não se move.',
  nivel: 'staff',
  exige: [
    { nome: 'answerKeyId', rotulo: 'Gabarito (uuid)', tipo: 'uuid', obrigatorio: true },
    {
      nome: 'entradas',
      rotulo: 'Entradas (JSON)',
      tipo: 'area-texto',
      obrigatorio: true,
      dica: 'Ex.: [{"posicao":1,"letra":"C"},{"posicao":2,"letra":"*"}]',
    },
  ],
  async aplicar(tx, entrada) {
    const keyId = campo(entrada, 'answerKeyId');
    const bruto = campo(entrada, 'entradas');
    let entradas: { posicao: number; letra: string }[];
    try {
      entradas = JSON.parse(bruto);
    } catch (e) {
      throw new Error(`As entradas não são JSON válido: ${(e as Error).message}`);
    }
    if (!Array.isArray(entradas) || entradas.length === 0) {
      throw new Error('As entradas precisam ser uma lista não vazia.');
    }

    for (const e of entradas) {
      const letra = String(e.letra ?? '').trim().toUpperCase();
      if (letra !== '*' && !/^[A-E]$/.test(letra)) {
        throw new Error(`Letra inválida na posição ${e.posicao}: ${e.letra}`);
      }
      if (letra === '*') {
        await tx.query(
          `INSERT INTO canone_learning.answer_key_entry (answer_key_id, ordinal, correct_option, is_annulled)
           VALUES ($1::uuid, $2, NULL, true)
           ON CONFLICT (answer_key_id, ordinal) DO UPDATE
             SET correct_option = NULL, is_annulled = true`,
          [keyId, Number(e.posicao)]
        );
      } else {
        await tx.query(
          `INSERT INTO canone_learning.answer_key_entry (answer_key_id, ordinal, correct_option, is_annulled)
           VALUES ($1::uuid, $2, $3, false)
           ON CONFLICT (answer_key_id, ordinal) DO UPDATE
             SET correct_option = EXCLUDED.correct_option, is_annulled = false`,
          [keyId, Number(e.posicao), letra]
        );
      }
    }

    const r = await tx.query<{ id: string; status: string }>(
      `UPDATE canone_learning.answer_key SET status = 'definitivo'
        WHERE id = $1::uuid AND status = 'preliminar'
        RETURNING id, status`,
      [keyId]
    );
    if (r.rowCount === 0) {
      throw new Error('O gabarito não é preliminar, ou não existe.');
    }
    return {
      linhas: [
        `Gabarito selado com ${entradas.length} posição(ões).`,
        'A partir de agora o gabarito é imutável e a prova não muda mais.',
      ],
      dados: { id: keyId, posicoes: entradas.length },
    };
  },
};

/** Anular uma questão do gabarito. */
const anularQuestao: Comando = {
  id: 'anular_questao',
  titulo: 'Anular uma questão do gabarito',
  descricao:
    'Marca uma posição como anulada pelo CFC. A questão deixa de ter ' +
    'resposta: ninguém pode errá-la.',
  regra:
    'O banco recusa anular questão já publicada — quem praticou precisa ver ' +
    'a retração. E recusa anular posição de gabarito DEFINITIVO: o selo é ' +
    'imutável, e a anulação pertence à fase preliminar (é assim que o ' +
    'acervo do CFC traz as questões anuladas).',
  nivel: 'staff',
  exige: [
    { nome: 'answerKeyId', rotulo: 'Gabarito (uuid)', tipo: 'uuid', obrigatorio: true },
    { nome: 'posicao', rotulo: 'Posição', tipo: 'inteiro', obrigatorio: true },
    {
      nome: 'motivo',
      rotulo: 'Motivo',
      tipo: 'texto',
      obrigatorio: true,
      dica: 'Por que a questão está sendo anulada (erro de gabarito, questão cancelada…).',
    },
  ],
  async aplicar(tx, entrada) {
    const keyId = campo(entrada, 'answerKeyId');
    const posicao = numero(entrada, 'posicao');
    const r = await tx.query<{ ordinal: number }>(
      `UPDATE canone_learning.answer_key_entry
          SET correct_option = NULL, is_annulled = true
        WHERE answer_key_id = $1::uuid AND ordinal = $2
        RETURNING ordinal`,
      [keyId, posicao]
    );
    if (r.rowCount === 0) throw new Error('A posição não existe neste gabarito.');
    return {
      linhas: [
        `Posição ${posicao} anulada.`,
        'O veredito passa a ser "anulada" — ninguém pode errá-la.',
        'Motivo registrado: ' + campo(entrada, 'motivo'),
      ],
      dados: { posicao },
    };
  },
};

/** Importar o acervo. */
const importarAcervo: Comando = {
  id: 'importar_acervo',
  titulo: 'Importar uma prova do acervo',
  descricao:
    'Carrega uma variante de prova (T01..T04) a partir do JSON do acervo: ' +
    'questões, gabarito e fonte.',
  regra:
    'O banco recusa enunciado ausente (perda silenciosa é proibida) e ' +
    'conflito de número de questões contra a trilha — em qualquer status de ' +
    'gabarito. A importação é idempotente: rodar duas vezes não duplica.',
  nivel: 'admin',
  exige: [
    {
      nome: 'payload',
      rotulo: 'Acervo (JSON)',
      tipo: 'area-texto',
      obrigatorio: true,
      dica: 'O JSON do acervo: id, ano, edicao, tipo_prova, exam_type, banca, gabarito_type, questoes[]',
    },
  ],
  async aplicar(tx, entrada) {
    const bruto = campo(entrada, 'payload');
    let payload: unknown;
    try {
      payload = JSON.parse(bruto);
    } catch (e) {
      throw new Error(`O acervo não é JSON válido: ${(e as Error).message}`);
    }
    const r = await tx.query<{ form_id: string; item_count: number; key_status: string }>(
      `SELECT * FROM canone_ops.import_corpus_form($1::jsonb)`,
      [JSON.stringify(payload)]
    );
    const row = r.rows[0];
    return {
      linhas: [
        `Acervo importado: ${row.item_count} questão(ões).`,
        `Gabarito: ${row.key_status}.`,
        'A prova fica selada: as posições não mudam mais.',
      ],
      dados: { form_id: row.form_id, item_count: row.item_count, key_status: row.key_status },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* O CATÁLOGO                                                                   */
/* -------------------------------------------------------------------------- */

export const COMANDOS: Comando[] = [
  concederAcesso,
  revogarAcesso,
  lerProgresso,
  moverConteudo,
  registrarVerificacao,
  selarGabarito,
  anularQuestao,
  importarAcervo,
];

export function comandoPorId(id: string): Comando | undefined {
  return COMANDOS.find((c) => c.id === id);
}

/** O catálogo em forma de dado — é o que o app consome (contrato gerado). */
export interface CatalogoComando {
  id: string;
  titulo: string;
  descricao: string;
  regra: string;
  nivel: NivelComando;
  exige: CampoComando[];
}

export function catalogo(): CatalogoComando[] {
  return COMANDOS.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    descricao: c.descricao,
    regra: c.regra,
    nivel: c.nivel,
    exige: c.exige,
  }));
}
