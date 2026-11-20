/* ============================================================================
   FONTE DE VERDADE — Exame de Suficiência CFC
   Cada campo `fonte` aponta para a origem oficial. Nada aqui é de memória:
   foi conferido em cfc.org.br e conhecimento.fgv.br em 2026-10-23.
   O gate de integridade (integridade/gate.mjs) valida estes campos.
   ========================================================================== */

export type Verificado = 'verificado' | 'a_confirmar';

export interface Fonte {
  titulo: string;
  url: string;
  consultadoEm: string;
}

export const EXAME = {
  nome: 'Exame de Suficiência',
  orgao: 'Conselho Federal de Contabilidade (CFC)',
  banca: 'FGV Conhecimento',
  finalidade:
    'Prova de equalização que comprova conhecimentos médios, requisito para a obtenção de ' +
    'registro profissional em Conselho Regional de Contabilidade (CRC), categoria Contador.',
  baseLegal: {
    // ATENÇÃO — citação conferida na fonte, não de memória:
    // o art. 76 pertence à LEI 12.249/2010, e não ao Decreto-Lei.
    // O artigo ALTERADO é o art. 12 do DL 9.295/1946.
    // Fonte: Planalto (del9295) + CFC (lei12249.pdf) + preâmbulo da Res. 1.486/2015.
    decreto: 'Decreto-Lei nº 9.295/1946, art. 12, com redação dada pelo art. 76 da Lei nº 12.249/2010',
    lei: 'Lei nº 12.249/2010, de 11 de junho de 2010',
    resolucao: 'Resolução CFC nº 1.486/2015, com as alterações posteriores',
    alteracoes: [
      { res: 'Resolução CFC nº 1.789, de 5 de fevereiro de 2026',
        dou: '26/02/2026',
        efeito: 'alterou o art. 9º e o § 2º do art. 12; revogou o art. 13 da Res. 1.486/2015' },
      { res: 'Resolução CFC nº 1.798, de 13 de agosto de 2026',
        dou: '31/08/2026',
        efeito: 'alterou o parágrafo único do art. 1º: incluídos estudantes matriculados a partir do 5º semestre; vigência retroativa a 08/07/2026' },
    ],
    historico: [
      'Resolução CFC nº 853/1999 (instituiu o Exame)',
      'Resolução CFC nº 1.301/2010 (regulamentou; revogada)',
      'Resolução CFC nº 1.373/2011 (revogada)',
      'Resolução CFC nº 1.486/2015 (vigente, com alterações)',
    ],
  },

  prova: {
    tipo: 'Objetiva de múltipla escolha',
    questoes: 50,
    pontosPorQuestao: 1,
    opcoes: 4, // A, B, C, D
    criteriosCorreta: 'Uma única resposta correta por questão',
    pontosAprovacao: 25, // 50% de 50
    percentualAprovacao: 50,
    modalidade: 'Presencial',
    duracaoHoras: 4,
    horario: '10h00 às 14h00 (horário oficial de Brasília/DF)',
    // Art. 4º da Res. CFC 1.486/2015
    aprovacaoLiteral: 'O candidato será aprovado se obtiver, no mínimo, 50% (cinquenta por cento) dos pontos possíveis.',
    caracteristicas: [
      'Conteúdos programáticos definidos no edital vigente',
      'Pode abordar temas de forma interdisciplinar, associados às etapas do processo contábil',
      'Normas editadas até noventa dias antes da realização do Exame',
      'Art. 3º: aplicação semestral. Em 2026 houve três edições — situação excepcional',
    ],
  },

  // Redação dada pela Res. CFC nº 1.798/2026 ao parágrafo único do art. 1º da
  // Res. 1.486/2015. Antes: bacharéis e estudantes do ÚLTIMO ano letivo.
  quemPodeFazer: 'Bacharéis em Ciências Contábeis e estudantes regularmente matriculados a partir do quinto semestre do curso.',
  quemPodeFazerObservacao:
    'Redação dada pela Resolução CFC nº 1.798/2026. A aprovação no exame não substitui a conclusão da graduação.',

  /** Edições 2026 — datas conferidas em edital FGV. A 3ª edição precisa de
   *  confirmação da data de aplicação no edital publicado em 05/10/2026. */
  edicoes2026: [
    { edicao: '1/2026', aplicacao: '24 de maio de 2026', inscricoes: '23/02 a 24/03/2026', taxa: 'R$ 130,00', situacao: 'realizada' },
    { edicao: '2/2026', aplicacao: '27 de setembro de 2026', inscricoes: '09/07 a 07/08/2026', taxa: 'R$ 130,00', situacao: 'realizada' },
    { edicao: '3/2026', aplicacao: '13 de dezembro de 2026', inscricoes: '05/10 a 30/10/2026', taxa: 'R$ 199,00',
      situacao: 'inscrições encerradas, prova a realizar',
      observacao: 'Terceira edição em um mesmo ano — situação excepcional ao padrão semestral do art. 3º.' },
  ],

  /** Os 13 conteúdos programáticos do Bacharel em Ciências Contábeis,
   *  na ordem em que aparecem no edital. */
  conteudos: [
    'Língua Portuguesa Aplicada',
    'Matemática Financeira e Estatística',
    'Noções de Direito e Legislação Aplicada',
    'Legislação e Ética Profissional',
    'Teoria da Contabilidade',
    'Princípios de Contabilidade e Normas Brasileiras de Contabilidade',
    'Contabilidade Geral',
    'Contabilidade de Custos',
    'Contabilidade Gerencial',
    'Contabilidade Aplicada ao Setor Público',
    'Controladoria',
    'Auditoria Contábil',
    'Perícia Contábil',
  ],

  fontes: [
    {
      titulo: 'CFC — Exame de Qualificação Técnica (página oficial)',
      url: 'https://cfc.org.br/desenvolvimento-profissional-e-institucional/exames/exame-de-qualificacao-tecnica/',
      consultadoEm: '2026-10-23',
    },
    {
      titulo: 'FGV — Edital Exame de Suficiência nº 1/2026',
      url: 'https://conhecimento.fgv.br/sites/default/files/concursos/cfc-edital-2026.1-versao-final.pdf',
      consultadoEm: '2026-10-23',
    },
    {
      titulo: 'FGV — Edital Exame de Suficiência nº 2/2026',
      url: 'https://conhecimento.fgv.br/sites/default/files/concursos/cfc-edital-2026.2-08.07.2026.pdf',
      consultadoEm: '2026-10-23',
    },
    {
      titulo: 'CFC — 3º Exame de Suficiência de 2026 (data de aplicação, inscrições e taxa)',
      url: 'https://cfc.org.br/exame-de-suficiencia-anteriores/3o-exame-de-suficiencia-de-2026/',
      consultadoEm: '2026-10-23',
    },
    {
      titulo: 'CFC — Resolução nº 1.486/2015 (texto integral)',
      url: 'https://cfc.org.br/wp-content/uploads/2016/01/RES_1486.doc',
      consultadoEm: '2026-10-23',
    },
    {
      titulo: 'Presidência da República — Lei nº 12.249/2010 e DL nº 9.295/1946 consolidados',
      url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del9295.htm',
      consultadoEm: '2026-10-23',
    },
  ],
} as const;

/* ---------------------------------------------------------------------------
   NÃO AFILIAÇÃO
   Linha vermelha da marca. Cânone é edtech independente; não é produto
   oficial do CFC, de CRC, de CVC nem da FGV, e não tem qualquer vínculo
   ou endosso dessas instituições. Precisa estar visível em TODO material
   que cite o nome do exame ou de órgão oficial.
   ------------------------------------------------------------------------- */
export const NAO_AFILIACAO =
  'Cânone é uma plataforma de estudos independente. Não é produto oficial do Conselho Federal ' +
  'de Contabilidade, de Conselhos Regionais, nem da FGV Conhecimento, e não possui vínculo, ' +
  'parceria ou endosso dessas instituições. Exame de Suficiência é uma marca e um programa ' +
  'do CFC. A aprovação do candidato depende do seu desempenho e do resultado da prova.';

/* Ledger de alegações REJEITADAS.
   ---------------------------------------------------------------------------
   Estes são os números que aparecem no material de referência e que o Cânone
   NÃO publica. Eles ficam registrados aqui — com o nome do campo carregando a
   semântica — para que: (a) ninguém os reintroduza "só para preencher" e
   (b) o gate de integridade saiba que este bloco é recusa, não alegação.
   Uso em tela: o valor vai para a coluna "Origem na referência" com status
   explícito de "não publicado" — nunca como número da marca.
   ========================================================================= */
export const CLAIMS_PENDENTES = [
  { chave: 'N_ALUNOS', rotulo: 'Número de alunos', exemploRejeitadoNasReferencias: '+40 mil alunos em preparação' },
  { chave: 'RATING', rotulo: 'Avaliação nas lojas', exemploRejeitadoNasReferencias: '4.9 ★ na App Store e Play Store' },
  { chave: 'N_QUESTOES', rotulo: 'Banco de questões', exemploRejeitadoNasReferencias: '1.240 questões resolvidas / 320 flashcards' },
  { chave: 'TAXA_APROVACAO', rotulo: 'Taxa de aprovação', exemploRejeitadoNasReferencias: '+62% evolução no desempenho' },
  { chave: 'HORAS', rotulo: 'Horas de estudo registradas', exemploRejeitadoNasReferencias: '320h de estudo registrado' },
] as const;