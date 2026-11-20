/**
 * PRÉVIA S7 — SOMENTE DEMONSTRAÇÃO SINTÉTICA DE UI.
 *
 * A amostra editorial anterior (incluindo alegações legais e respostas)
 * foi retirada do bundle do navegador e preservada para revisão em
 * extras/editorial-review/questoes-s6-pendente.ts.
 *
 * Estas duas fixtures NÃO são banco de questões, NÃO representam um exame,
 * NÃO alimentam nota/progresso. A autoridade futura é learning.item no
 * banco, após fonte normativa/editorial + homologação humana.
 */
export type Opcao = 'A' | 'B' | 'C' | 'D';
export interface Questao {
  id: string;
  disciplina: string;
  topico: string;
  nivel: 'facil' | 'medio' | 'dificil';
  enunciado: string;
  alternativas: Record<Opcao, string>;
  correta: Opcao; // APENAS fixture sintética; nunca usar para provas reais
  justificativa: string;
  porQueErram: Partial<Record<Opcao, string>>;
  base: string;
  verificacao: 'verificado' | 'a_confirmar';
}
export const QUESTOES: Questao[] = [
  {
    id: 'DEMO-SINTETICA-001', disciplina: 'Navegação (demonstração)',
    topico: 'Fluxo da interface', nivel: 'facil',
    enunciado: 'Exemplo fictício: qual botão apresenta as alternativas de um exercício?',
    alternativas: { A:'Mostrar opções', B:'Fechar janela', C:'Sair do sistema', D:'Limpar a tela' },
    correta: 'A', justificativa: 'Exercício sintético exclusivamente para visualizar a interface; não contém regra contábil.',
    porQueErram: {}, base: 'Demonstração sintética — sem fonte normativa', verificacao: 'a_confirmar'
  },
  {
    id: 'DEMO-SINTETICA-002', disciplina: 'Navegação (demonstração)',
    topico: 'Estado de carregamento', nivel: 'facil',
    enunciado: 'Exemplo fictício: qual mensagem deve aparecer quando um serviço ainda não está disponível?',
    alternativas: { A:'Tudo aprovado', B:'Indisponível até homologação', C:'Compra concluída', D:'Gabarito oficial publicado' },
    correta: 'B', justificativa: 'Uma interface deve indicar a indisponibilidade do serviço; nenhum resultado real é registrado.',
    porQueErram: {}, base: 'Demonstração sintética — sem fonte normativa', verificacao: 'a_confirmar'
  },
];
export const Q_POR_ID = (id: string) => QUESTOES.find(q=>q.id===id);
export const Q_VERIFICADAS = () => QUESTOES.filter(q=>q.verificacao==='verificado');
export const Q_PENDENTES = () => QUESTOES.filter(q=>q.verificacao==='a_confirmar');
