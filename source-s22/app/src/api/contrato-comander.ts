/* eslint-disable */
/**
 * CONTRATO DO COMANDER — ARQUIVO GERADO. NÃO EDITE.
 * ============================================================================
 * Fonte: backend/src/areas/admin/comander.ts
 * Gerador: backend/scripts/gerar-contrato-comander.mjs
 *
 * O app consome este arquivo em DOIS momentos:
 *   · offline (demonstração) — o catálogo vem daqui;
 *   · online — o catálogo do servidor é conferido contra o daqui, e a
 *     divergência aparece na tela em vez de aparecer no formulário quebrado.
 *
 * A verificação de que este arquivo está em dia é o teste
 * backend/tests/11-comander.test.mjs.
 */
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
  dica?: string;
  opcoes?: OpcaoCampo[];
}

export type NivelComando = 'staff' | 'admin';

export interface CatalogoComando {
  id: string;
  titulo: string;
  descricao: string;
  regra: string;
  nivel: NivelComando;
  exige: CampoComando[];
}

export interface ResumoComando {
  linhas: string[];
  dados?: Record<string, unknown>;
}

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

/* --------------------------------------------------------------------------
 * OS TIPOS DA GOVERNANÇA — extraídos das declarações do backend.
 * ----------------------------------------------------------------------- */
export interface ItemDaFila {
    id: string;
    queue: string;
    priority: number;
    reason: string;
    detail: Record<string, unknown>;
    assigned_to: string | null;
    opened_at: string;
    due_at: string | null;
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
    granted_at: string;
    expires_at: string;
    revoked_at: string | null;
    revoke_reason: string | null;
    /** Derivado, mas pelo banco: a concessão está expirada e ainda não revogada. */
    expirada: boolean;
    /** A concessão ainda dá acesso agora. */
    vigente: boolean;
}

export interface EventoAuditado {
    seq: number;
    occurred_at: string;
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
    amostra: {
        seq: number;
        esperado: string;
        encontrado: string;
    }[];
}

export interface Concessao {
    id: string;
    staff_user_id: string;
    subject_user_id: string;
    scope: 'progresso' | 'conta' | 'assinatura' | 'completo';
    reason: string;
    ticket_ref: string | null;
    granted_at: string;
    expires_at: string;
    revoked_at: string | null;
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
    updated_at: string;
    verification_state: string | null;
    valid_until: string | null;
    verified_at: string | null;
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
    updated_at: string;
    verification_state: string;
    refusal_reason: string | null;
    verified_at: string | null;
    source_id: string | null;
    source_title: string | null;
    source_url: string | null;
}

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

/** O formato que o endpoint /api/comander/estado devolve. */
export interface EstadoComander {
  saude: SaudeConteudo[];
  provas: SituacaoProva[];
  recusas: AlegacaoRecusada[];
  fila: ItemDaFila[];
  concessoes: ConcessaoGovernada[];
  auditoria: EventoAuditado[];
  cadeia: EstadoCadeia;
}

/** O catálogo, gerado do backend. */
export const COMANDOS: CatalogoComando[] = [
  {
    "id": "conceder_acesso",
    "titulo": "Conceder acesso ao progresso de um aluno",
    "descricao": "Abre, por prazo curto e com motivo, a leitura do progresso de um aluno. Cada leitura feita depois disso fica registrada.",
    "regra": "O banco recusa motivo com menos de 10 caracteres e prazo acima de 72 horas. A concessão expira sozinha — não depende de alguém lembrar de revogar.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "subjectUserId",
        "rotulo": "Aluno (uuid)",
        "tipo": "uuid",
        "obrigatorio": true,
        "dica": "O id do aluno cujo progresso será lido."
      },
      {
        "nome": "motivo",
        "rotulo": "Motivo",
        "tipo": "texto",
        "obrigatorio": true,
        "dica": "Mínimo de 10 caracteres. É o que fica no registro."
      },
      {
        "nome": "ticketRef",
        "rotulo": "Chamado (opcional)",
        "tipo": "texto",
        "obrigatorio": false,
        "dica": "Referência do ticket de suporte, se houver."
      },
      {
        "nome": "horasValidade",
        "rotulo": "Validade (horas)",
        "tipo": "inteiro",
        "obrigatorio": false,
        "dica": "Padrão 24. O banco recusa acima de 72."
      }
    ]
  },
  {
    "id": "revogar_acesso",
    "titulo": "Revogar uma concessão",
    "descricao": "Encerra antes do prazo uma concessão de leitura de progresso.",
    "regra": "O banco exige o motivo da revogação e registra quem revogou e quando.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "grantId",
        "rotulo": "Concessão (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "motivo",
        "rotulo": "Motivo",
        "tipo": "texto",
        "obrigatorio": true,
        "dica": "Por que a concessão está sendo encerrada."
      }
    ]
  },
  {
    "id": "ler_progresso",
    "titulo": "Ler o progresso de um aluno",
    "descricao": "A leitura do progresso de um aluno é feita como o aluno, sob concessão válida. Não existe caminho lateral: esta é a única porta.",
    "regra": "O banco recusa a leitura sem concessão válida, e registra cada leitura com quem, quando e de qual concessão.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "subjectUserId",
        "rotulo": "Aluno (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "grantId",
        "rotulo": "Concessão (uuid)",
        "tipo": "uuid",
        "obrigatorio": true,
        "dica": "A concessão que abre a porta. Precisa estar válida."
      }
    ]
  },
  {
    "id": "mover_conteudo",
    "titulo": "Mover o conteúdo no fluxo editorial",
    "descricao": "Move um conteúdo de estado. A sequência é rascunho → em revisão → verificado → publicado; o que muda de um passo para o outro está no banco.",
    "regra": "O banco recusa transição fora da tabela de transições, e recusa publicar sem verificação vigente com trecho literal da fonte.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "contentItemId",
        "rotulo": "Conteúdo (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "destino",
        "rotulo": "Estado de destino",
        "tipo": "selecao",
        "obrigatorio": true,
        "opcoes": [
          {
            "valor": "em_revisao",
            "rotulo": "Em revisão"
          },
          {
            "valor": "verificado",
            "rotulo": "Verificado"
          },
          {
            "valor": "publicado",
            "rotulo": "Publicado"
          },
          {
            "valor": "necessita_atualizacao",
            "rotulo": "Norma mudou"
          },
          {
            "valor": "rejeitado",
            "rotulo": "Rejeitado"
          }
        ]
      }
    ]
  },
  {
    "id": "registrar_verificacao",
    "titulo": "Registrar a verificação na fonte",
    "descricao": "Registra que o conteúdo foi conferido na fonte, com o TRECHO LITERAL que sustenta a conferência. É o que permite a um terceiro auditar sem refazer o trabalho.",
    "regra": "O banco recusa verificação sem trecho literal. Verificada com validade vencida não habilita publicação.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "contentItemId",
        "rotulo": "Conteúdo (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "sourceId",
        "rotulo": "Fonte (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "quote",
        "rotulo": "Trecho literal da fonte",
        "tipo": "area-texto",
        "obrigatorio": true,
        "dica": "Copiado da fonte, na íntegra. \"Conferi\" não é auditável."
      },
      {
        "nome": "method",
        "rotulo": "Método",
        "tipo": "selecao",
        "obrigatorio": true,
        "opcoes": [
          {
            "valor": "manual",
            "rotulo": "Manual"
          },
          {
            "valor": "conferencia_dupla",
            "rotulo": "Conferência dupla"
          },
          {
            "valor": "automatizada",
            "rotulo": "Automatizada"
          },
          {
            "valor": "importacao",
            "rotulo": "Importação"
          }
        ]
      },
      {
        "nome": "validUntil",
        "rotulo": "Válido até (opcional)",
        "tipo": "texto",
        "obrigatorio": false,
        "dica": "Data. Norma técnica expira — a verificação de 2019 não vale em 2026."
      }
    ]
  },
  {
    "id": "selar_gabarito",
    "titulo": "Selar o gabarito definitivo de uma prova",
    "descricao": "Sela o gabarito de uma variante de prova, com a letra de cada posição. O * marca questão anulada pelo CFC.",
    "regra": "O banco recusa o selo se a prova não estiver inteira, se faltar posição ou se a letra não existir entre as alternativas — a prova desalinhada não entra. Depois de selado, o gabarito é imutável e a prova não se move.",
    "nivel": "staff",
    "exige": [
      {
        "nome": "answerKeyId",
        "rotulo": "Gabarito (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "entradas",
        "rotulo": "Entradas (JSON)",
        "tipo": "area-texto",
        "obrigatorio": true,
        "dica": "Ex.: [{\"posicao\":1,\"letra\":\"C\"},{\"posicao\":2,\"letra\":\"*\"}]"
      }
    ]
  },
  {
    "id": "anular_questao",
    "titulo": "Anular uma questão do gabarito",
    "descricao": "Marca uma posição como anulada pelo CFC. A questão deixa de ter resposta: ninguém pode errá-la.",
    "regra": "O banco recusa anular questão já publicada — quem praticou precisa ver a retração. E recusa anular posição de gabarito DEFINITIVO: o selo é imutável, e a anulação pertence à fase preliminar (é assim que o acervo do CFC traz as questões anuladas).",
    "nivel": "staff",
    "exige": [
      {
        "nome": "answerKeyId",
        "rotulo": "Gabarito (uuid)",
        "tipo": "uuid",
        "obrigatorio": true
      },
      {
        "nome": "posicao",
        "rotulo": "Posição",
        "tipo": "inteiro",
        "obrigatorio": true
      },
      {
        "nome": "motivo",
        "rotulo": "Motivo",
        "tipo": "texto",
        "obrigatorio": true,
        "dica": "Por que a questão está sendo anulada (erro de gabarito, questão cancelada…)."
      }
    ]
  },
  {
    "id": "importar_acervo",
    "titulo": "Importar uma prova do acervo",
    "descricao": "Carrega uma variante de prova (T01..T04) a partir do JSON do acervo: questões, gabarito e fonte.",
    "regra": "O banco recusa enunciado ausente (perda silenciosa é proibida) e conflito de número de questões contra a trilha — em qualquer status de gabarito. A importação é idempotente: rodar duas vezes não duplica.",
    "nivel": "admin",
    "exige": [
      {
        "nome": "payload",
        "rotulo": "Acervo (JSON)",
        "tipo": "area-texto",
        "obrigatorio": true,
        "dica": "O JSON do acervo: id, ano, edicao, tipo_prova, exam_type, banca, gabarito_type, questoes[]"
      }
    ]
  }
];

/** Índice por id — o app não busca na lista toda. */
export const COMANDOS_POR_ID: Record<string, CatalogoComando> = Object.fromEntries(
  COMANDOS.map((c) => [c.id, c])
);
