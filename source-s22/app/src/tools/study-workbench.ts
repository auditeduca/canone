/**
 * Cânone S18 — cinco estúdios metodológicos de autoria pessoal.
 * Não afirma atualização, validade jurídica, conformidade CPC/CFC, perícia ou auditoria.
 * Sem conexão, gabarito, evidência anexada ou autoridade de publicação.
 */
export const WORKBENCH_CONFIG = {
  'contabilidade-ilustrada': {
    name: 'Contabilidade Ilustrada — caderno de conceitos',
    description: 'Organize dois lados de uma comparação conceitual escrita por você.',
    fields: ['Contexto do exemplo', 'Explicação e comparação', 'Observações/limitações'],
    prompts: ['Exemplo fictício que você deseja estudar', 'Sua explicação e o contraste entre situações', 'Pontos que ainda precisam ser conferidos'],
  },
  'cpc-visual': {
    name: 'CPC Visual — mapa de referências autoral',
    description: 'Monte fichas sobre tópicos e referências declaradas por você; não exibe textos ou versões CPC oficiais.',
    fields: ['Tema e escopo declarados', 'Interpretação pessoal', 'Questões para validação'],
    prompts: ['Descreva o assunto e o escopo que pretende estudar', 'Descreva seu entendimento (ainda não verificado)', 'Registre dúvidas e pontos que exigem texto oficial'],
  },
  'auditoria-pratica': {
    name: 'Auditoria na Prática — papel de trabalho fictício',
    description: 'Documente objetivo, procedimentos e evidências declaradas em um exercício de auditoria.',
    fields: ['Objetivo/contexto', 'Procedimento proposto', 'Evidências e pendências'],
    prompts: ['Defina uma situação inteiramente fictícia', 'Escreva as etapas de sua proposta de teste', 'Liste evidências que ainda precisariam ser obtidas'],
  },
  'pericia': {
    name: 'Perícia Contábil — roteiro de quesitos fictícios',
    description: 'Organize quesitos de estudo, método proposto e limitações sem gerar laudos.',
    fields: ['Quesito de estudo', 'Método proposto', 'Observações e limitações'],
    prompts: ['Escreva o quesito fictício', 'Descreva como investigaria o quesito', 'Registre documentos faltantes e hipóteses'],
  },
  'contabilidade-publica': {
    name: 'Contabilidade Pública — fichas de estudo',
    description: 'Registre eventos sintéticos e dúvidas sobre classificação, sem validar MCASP ou LRF.',
    fields: ['Evento sintético', 'Classificação proposta', 'Dúvidas de referência'],
    prompts: ['Descreva um evento totalmente fictício', 'Indique sua interpretação pessoal', 'Liste as fontes oficiais a conferir'],
  },
} as const;
export type WorkbenchDomain = keyof typeof WORKBENCH_CONFIG;
export const WORKBENCH_IDS = Object.keys(WORKBENCH_CONFIG) as WorkbenchDomain[];
export type WorkbenchFields = Readonly<[string,string,string]>;
export interface WorkbenchEntry {
  readonly id: number;
  readonly domain: WorkbenchDomain;
  readonly title: string;
  readonly fields: WorkbenchFields;
  readonly source: string;
  readonly provenance: 'user-authored-unverified';
}
export type WorkbenchDraft = {title:string;fields:readonly string[];source:string};
export type SourceGate = 'HOLD_SOURCE'|'USER_DECLARED_UNVERIFIED';
const MAX_PER_DOMAIN = 25;
const MAX_ALL = 100;
function clean(value:unknown,name:string,min:number,max:number):string {
  if(typeof value!=='string')throw Error(`${name}: somente texto.`);
  const result=value.trim().replace(/\s+/g,' ');
  if(result.length<min || result.length>max)throw Error(`${name}: de ${min} a ${max} caracteres.`);
  return result;
}
export function validDomain(value:unknown):value is WorkbenchDomain {
  return typeof value==='string' && Object.hasOwn(WORKBENCH_CONFIG,value);
}
export function gateForSource(source:string):SourceGate {
  return source.trim() ? 'USER_DECLARED_UNVERIFIED' : 'HOLD_SOURCE';
}
export function makeWorkbenchEntry(id:number,domain:WorkbenchDomain,draft:WorkbenchDraft,existing:readonly WorkbenchEntry[]=[]):WorkbenchEntry {
  if(!validDomain(domain))throw Error('Módulo não registrado no contrato S18.');
  if(!Number.isSafeInteger(id)||id<1||existing.some(e=>e.id===id))throw Error('ID inválido ou duplicado.');
  if(existing.length>=MAX_ALL || existing.filter(e=>e.domain===domain).length>=MAX_PER_DOMAIN)throw Error('Limite de 25 por módulo ou 100 por sessão.');
  if(!draft||!Array.isArray(draft.fields)||draft.fields.length!==3)throw Error('Os três campos metodológicos são obrigatórios.');
  const fields=draft.fields.map((text,i)=>clean(text,`Campo ${i+1}`,i===2?0:10,900)) as [string,string,string];
  return Object.freeze({id,domain,title:clean(draft.title,'Título',3,120),fields:Object.freeze(fields),source:clean(draft.source,'Fonte declarada',0,400),provenance:'user-authored-unverified' as const});
}
export function updateWorkbenchEntry(entries:readonly WorkbenchEntry[],id:number,domain:WorkbenchDomain,draft:WorkbenchDraft):WorkbenchEntry[] {
  const item=entries.find(e=>e.id===id);
  if(!item||item.domain!==domain)throw Error('Registro ausente ou de outro módulo.');
  const remainder=entries.filter(e=>e.id!==id);
  const revised=makeWorkbenchEntry(id,domain,draft,remainder);
  return entries.map(e=>e.id===id?revised:e);
}
export function removeWorkbenchEntry(entries:readonly WorkbenchEntry[],id:number,domain:WorkbenchDomain):WorkbenchEntry[] {
  if(!validDomain(domain)||!Number.isSafeInteger(id))throw Error('Referência inválida.');
  const current=entries.find(x=>x.id===id);
  if(!current || current.domain!==domain)throw Error('Não é possível apagar registro de outro módulo.');
  return entries.filter(x=>x.id!==id);
}
export function workbenchSummary(entries:readonly WorkbenchEntry[],domain:WorkbenchDomain){
  if(!validDomain(domain))throw Error('Módulo inválido.');
  const relevant=entries.filter(x=>x.domain===domain);
  return {total:relevant.length,declared:relevant.filter(x=>gateForSource(x.source)==='USER_DECLARED_UNVERIFIED').length,missing:relevant.filter(x=>gateForSource(x.source)==='HOLD_SOURCE').length,verified:0};
}
export function exportWorkbench(entries:readonly WorkbenchEntry[],domain:WorkbenchDomain):string {
  if(!validDomain(domain))throw Error('Módulo inválido.');
  if(entries.length>MAX_ALL)throw Error('Acervo excede o limite.');
  const ids=new Set<number>();
  const filtered=entries.filter(e=>e.domain===domain).map(e=>{
    if(e.provenance!=='user-authored-unverified'||ids.has(e.id))throw Error('Proveniência ou ID inválido.');
    ids.add(e.id);
    const value=makeWorkbenchEntry(e.id,e.domain,{title:e.title,fields:[...e.fields],source:e.source});
    return {id:value.id,domain:value.domain,title:value.title,fields:value.fields,source:value.source,provenance:value.provenance,sourceGate:gateForSource(value.source)};
  });
  if(filtered.length>MAX_PER_DOMAIN)throw Error('Máximo de 25 por módulo.');
  return JSON.stringify({schema:'canone.user-authored.workbench.s18',release:'PREVIEW_NO_GO',verified:false,scope:'memory-only',module:domain,records:filtered},null,2);
}
