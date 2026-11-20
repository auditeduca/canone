export interface FaqItem { q: string; a: string }

/* Todo item de FAQ que fala do produto responde a uma pergunta sobre a qual
   existe resposta verificável. Quando a resposta é "depende de dado que
   ainda não temos", o texto DIZ isso em vez de preencher o espaço. */
export const FAQ: FaqItem[] = [
  {
    q: 'O Cânone é oficial do CFC?',
    a:
      'Não. Cânone é uma plataforma de estudos independente. Não é produto oficial do Conselho Federal ' +
      'de Contabilidade, de Conselhos Regionais nem da FGV Conhecimento, e não possui vínculo, parceria ' +
      'ou endosso dessas instituições. O Exame de Suficiência é um programa do CFC.',
  },
  {
    q: 'O conteúdo acompanha o edital vigente?',
    a:
      'Sim. Os módulos são organizados a partir dos conteúdos programáticos publicados no edital do ' +
      'Exame de Suficiência, que hoje são treze assuntos para a prova de Bacharel em Ciências Contábeis. ' +
      'Cada disciplina do app mapeia para um ou mais desses assuntos. Quando o edital muda, o mapeamento é ' +
      'revisado e a data da última verificação aparece dentro do app.',
  },
  {
    q: 'Quantas questões o Cânone tem?',
    a:
      'Esse número ainda não foi definido e por isso não aparece no site. Preferimos exibir um placeholder ' +
      'marcado a um número inventado. Assim que o banco real estiver fechado e auditado, o valor aparece ' +
      'junto com a data de conferência.',
  },
  {
    q: 'O Cânone garante aprovação?',
    a:
      'Não, e nenhuma plataforma honesta pode garantir. O que o Cânone oferece é um método de estudo ' +
      'estruturado, conteúdo alinhado ao edital e ferramentas de acompanhamento. A aprovação depende do ' +
      'desempenho do candidato na prova.',
  },
  {
    q: 'O Cânone funciona sem internet?',
    a:
      'Sim. O módulo Cânone Offline baixa pacotes de conteúdo para uso sem conexão. O app web também foi ' +
      'construído para funcionar sem rede depois do primeiro carregamento.',
  },
  {
    q: 'Como funciona o modo de resposta dos flashcards?',
    a:
      'São quatro estados autorrelatados: "acertei facilmente", "acertei com esforço", "errei" e "não sabia". ' +
      'A diferença entre os dois primeiros é proposital — acertar com esforço significa que o conteúdo está ' +
      'frágil e precisa voltar mais cedo. "Não sabia" é diferente de "errei": o primeiro indica conteúdo ainda ' +
      'não visto, o segundo indica conteúdo visto e não consolidado. O algoritmo de repetição espaçada usa ' +
      'essa distinção para agendar a próxima revisão.',
  },
  {
    q: 'As questões têm justificativa?',
    a:
      'Sim. Cada questão declara a base normativa usada e explica por que cada alternativa errada está ' +
      'errada — não apenas por que a correta está certa. A erros mais frequentes em contabilidade vêm de ' +
      'distrator conceitual, e é o distrator que o material precisa explicar.',
  },
  {
    q: 'Quais são as regras de integridade editorial do Cânone?',
    a:
      'Três. Primeira: nenhum número é publicado sem fonte auditável —o número de alunos, a taxa de acerto, horas de ' +
      'estudo e avaliação em loja só aparecem com dado real e data de conferência. Segunda: nenhuma afirmação ' +
      'sobre o exame, sobre normas ou sobre datas é feita de memória; vem do edital ou do texto da norma. ' +
      'Terceira: nenhuma afiliação com CFC, CVC, CRC ou FGV é sugerida em qualquer material.',
  },
  {
    q: 'Quais métodos o Cânone usa?',
    a:
      'Repetição espaçada com agendamento adaptativo, revisão ativa por autoavaliação em quatro estados, ' +
      'recuperação ativa por questões, interleaving de disciplinas e visualização estruturada por mapas ' +
      'mentais e quadros comparativos.',
  },
  {
    q: 'O conteúdo está atualizado com as normas vigentes?',
    a:
      'O app referencia normas por código e por item, e a data de verificação é exibida junto ao conteúdo. ' +
      'Normas técnicas são editadas periodicamente; quando uma norma muda, os itens afetados entram na fila ' +
      'de revisão editorial e sinalizam até que a conferência seja concluída.',
  },
  {
    q: 'O Cânone substitui o CFC?',
    a:
      'Não substitui nada. O Cânone é material de estudo. A prova, o gabarito, o resultado e o registro são ' +
      'exclusivamente do CFC e da banca aplicadora.',
  },
  {
    q: 'Como o Cânone trata meus dados?',
    a:
      'O progresso de estudo é mantido localmente no dispositivo por padrão. Nada é compartilhado com ' +
      'terceiros para publicidade ou perfilamento. A política de privacidade completa, com base na LGPD, é ' +
      'publicada no rodapé do site e descreve item a item o que é coletado, por quê e por quanto tempo.',
  },
]