#!/usr/bin/env node
/**
 * GERADOR DO CONTRATO DO COMANDER
 * ============================================================================
 * O app NÃO escreve o catálogo de comandos. O catálogo é gerado do código do
 * backend — o mesmo código que executa — e versionado no app.
 *
 * Por que gerar em vez de escrever à mão: um contrato escrito à mão mente.
 * O dia em que o backend ganha um campo novo e o app não sabe, ninguém
 * percebe até o formulário quebrar em produção. Gerado, o drift é
 * visível: o teste `11-comander` regenera o arquivo e compara com o que
 * está no app.
 *
 * Uso:  node scripts/gerar-contrato-comander.mjs [destino]
 *        (default: ../app/src/api/contrato-comander.ts)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const destino = resolve(
  raiz,
  process.argv[2] ?? '../app/src/api/contrato-comander.ts'
);

const mod = await import(resolve(raiz, 'dist/areas/admin/comander.js'));
const catalogo = mod.catalogo();

/**
 * Extrai as interfaces exportadas de um .d.ts.
 *
 * As declarações são geradas pelo tsc — não são escritas à mão — então
 * extraí-las é o mesmo que copiar o contrato do código, sem reescrever
 * nada. A tradução é explícita: `Date` vira `string`, porque o que chega
 * por HTTP é ISO 8601, não um objeto Date.
 */
function extrairInterfaces(caminhoDts) {
  const src = readFileSync(caminhoDts, 'utf8');
  const saida = [];
  const re = /export interface (\w+)(<[^>]*>)? \{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const nome = m[1];
    let i = src.indexOf('{', m.index);
    let nivel = 0;
    let fim = i;
    for (; fim < src.length; fim++) {
      if (src[fim] === '{') nivel++;
      else if (src[fim] === '}') {
        nivel--;
        if (nivel === 0) { fim++; break; }
      }
    }
    let bloco = src.slice(m.index, fim);
    bloco = bloco.replace(/\bDate\b/g, 'string');
    saida.push(bloco);
  }
  return saida;
}

const tiposEstado = [
  ...extrairInterfaces(resolve(raiz, 'dist/areas/admin/estado.d.ts')),
  ...extrairInterfaces(resolve(raiz, 'dist/areas/admin/suporte.d.ts')),
];

const corpo = `/* eslint-disable */
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
${tiposEstado.join('\n\n')}

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
export const COMANDOS: CatalogoComando[] = ${JSON.stringify(catalogo, null, 2)};

/** Índice por id — o app não busca na lista toda. */
export const COMANDOS_POR_ID: Record<string, CatalogoComando> = Object.fromEntries(
  COMANDOS.map((c) => [c.id, c])
);
`;

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, corpo, 'utf8');

const bytes = Buffer.byteLength(corpo, 'utf8');
console.log(
  `Contrato do comander gerado: ${catalogo.length} comando(s) → ${destino} (${bytes} bytes)`
);
