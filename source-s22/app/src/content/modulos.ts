/* AUTO-GERADO. Fonte única: backend/contracts/product/catalog.v1.json.
 * Rodar: node backend/contracts/product/generate.mjs --write
 * Não alterar o catálogo de 26 módulos manualmente neste arquivo.
 */
import type { ComponentType } from 'react';
import { IcArchive, IcBook, IcBookOpen, IcCalculator, IcCalendar, IcCards, IcFile, IcGem, IcLayers, IcLock, IcMap, IcMic, IcPlay, IcScale, IcShield, IcSwords, IcTarget, IcZap } from "../brand/icons";
import { IcGauge, IcTrendingIn } from "./icones-internos";

export type Fase = 'Estudar' | 'Praticar' | 'Evoluir' | 'Aprovar';

export interface Modulo {
  n: number;
  id: string;
  nome: string;
  curto: string;
  descricao: string;
  fase: Fase;
  icone: ComponentType<{ className?: string }>;
  telas?: string[];
}

export const FASES: { nome: Fase; lema: string }[] = [
  { nome: "Estudar", lema: "Fixar o essencial com o menor esforço possível." },
  { nome: "Praticar", lema: "Converter conhecimento em acerto sob pressão." },
  { nome: "Evoluir", lema: "Descobrir a lacuna antes da prova." },
  { nome: "Aprovar", lema: "Simular o dia e chegar pronto." },
];

export const MODULOS: Modulo[] = [
  { n: 2, id: "flashcards", nome: "Flashcards", curto: "Flashcards", fase: "Estudar", icone: IcCards,
    descricao: "Revisão espaçada com repetição em intervalos crescentes." },
  { n: 3, id: "mapas-mentais", nome: "Mapas Mentais", curto: "Mapas", fase: "Estudar", icone: IcMap,
    descricao: "Visualização completa e organizada dos temas." },
  { n: 4, id: "contabilidade-ilustrada", nome: "Contabilidade Ilustrada", curto: "C. Ilustrada", fase: "Estudar", icone: IcBookOpen,
    descricao: "Conceitos complexos explicados de forma visual." },
  { n: 5, id: "guia-de-bolso", nome: "Guia de Bolso", curto: "Guia", fase: "Estudar", icone: IcFile,
    descricao: "Conteúdo essencial para consulta rápida e objetiva." },
  { n: 6, id: "plano-de-estudos", nome: "Plano de Estudos", curto: "Plano", fase: "Estudar", icone: IcCalendar,
    descricao: "Cronograma personalizado até a prova." },
  { n: 7, id: "laboratorio", nome: "Laboratório Contábil", curto: "Lab", fase: "Estudar", icone: IcCalculator,
    descricao: "Pratique lançamentos contábeis e DFs." },
  { n: 9, id: "cpc-visual", nome: "CPC Visual", curto: "CPC", fase: "Estudar", icone: IcFile,
    descricao: "Normas ilustradas e atualizadas." },
  { n: 10, id: "dre-interativa", nome: "DRE Interativa", curto: "DRE", fase: "Estudar", icone: IcTrendingIn,
    descricao: "Monte e analise a DRE passo a passo." },
  { n: 11, id: "balanco-3d", nome: "Balanço Patrimonial 3D", curto: "BP 3D", fase: "Estudar", icone: IcLayers,
    descricao: "Visualize a estrutura e a composição das contas." },
  { n: 12, id: "diario-e-razao", nome: "Diário e Razão", curto: "D&R", fase: "Estudar", icone: IcBook,
    descricao: "Escrituração contábil interativa." },
  { n: 13, id: "auditoria-pratica", nome: "Auditoria na Prática", curto: "Auditoria", fase: "Estudar", icone: IcShield,
    descricao: "Procedimentos, evidências e papéis de trabalho." },
  { n: 14, id: "pericia", nome: "Perícia Contábil", curto: "Perícia", fase: "Estudar", icone: IcScale,
    descricao: "Casos reais e laudos práticos." },
  { n: 15, id: "contabilidade-publica", nome: "Contabilidade Pública", curto: "Pública", fase: "Estudar", icone: IcGem,
    descricao: "MCASP, LRF e demais normas em linguagem clara." },
  { n: 21, id: "podcast", nome: "Podcast de Revisão", curto: "Podcast", fase: "Estudar", icone: IcMic,
    descricao: "Conteúdos em áudio para estudar em qualquer lugar." },
  { n: 22, id: "videodulas", nome: "Vídeoaulas Interativas", curto: "Vídeo", fase: "Estudar", icone: IcPlay,
    descricao: "Assista, anote e pratique no mesmo lugar." },
  { n: 24, id: "caderno-erros", nome: "Caderno de Erros", curto: "Erros", fase: "Estudar", icone: IcSwords,
    descricao: "Transforme erros em aprendizado dirigido." },
  { n: 1, id: "simulados", nome: "Simulados", curto: "Simulados", fase: "Praticar", icone: IcTarget,
    descricao: "Questões comentadas e adaptativas." },
  { n: 16, id: "matematica", nome: "Matemática Financeira", curto: "Mat. Fin.", fase: "Praticar", icone: IcCalculator,
    descricao: "Fórmulas, exemplos e exercícios iterativos." },
  { n: 17, id: "duelo", nome: "Duelo de Questões", curto: "Duelo", fase: "Praticar", icone: IcSwords,
    descricao: "Desafie outro estudante em tempo real." },
  { n: 18, id: "simulado-adaptativo", nome: "Simulado Adaptativo", curto: "Adaptativo", fase: "Praticar", icone: IcZap,
    descricao: "Acompanhe seu nível em tempo real." },
  { n: 8, id: "calculadoras", nome: "Calculadoras Contábeis", curto: "Calculadoras", fase: "Praticar", icone: IcCalculator,
    descricao: "Valor presente, taxa de juros, depreciação e mais." },
  { n: 19, id: "reposicao", nome: "Banco de Dados de Questões", curto: "Banco Q", fase: "Praticar", icone: IcArchive,
    descricao: "Questões filtradas por edital." },
  { n: 20, id: "glossario", nome: "Glossário Contábil", curto: "Glossário", fase: "Evoluir", icone: IcBook,
    descricao: "Termos, conceitos e exemplos sempre à mão." },
  { n: 25, id: "dashboard", nome: "Dashboard de Aprovação", curto: "Dashboard", fase: "Evoluir", icone: IcGauge,
    descricao: "Acompanhe sua evolução até a prova." },
  { n: 23, id: "casos", nome: "Casos Práticos", curto: "Casos", fase: "Evoluir", icone: IcFile,
    descricao: "Situações reais com resolução passo a passo." },
  { n: 26, id: "offline", nome: "Cânone Offline", curto: "Offline", fase: "Aprovar", icone: IcLock,
    descricao: "Estude sem conexão com pacotes baixados." },
];

export const porFase = (f: Fase) => MODULOS.filter((m) => m.fase === f);
export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);
