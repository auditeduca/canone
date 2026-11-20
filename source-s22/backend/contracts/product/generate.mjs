#!/usr/bin/env node
/*
 * A single declarative product catalog generates UI metadata and delivery mapping.
 * This does not create operational engines, migrate tables, or publish content.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const catalogFile = resolve(here, 'catalog.v1.json');
const featureTemplateFile = resolve(here, 'feature-template.v1.json');
const allowedPhase = ['Estudar', 'Praticar', 'Evoluir', 'Aprovar'];
const allowedWaves = ['V1 núcleo', 'V1.1 extensão', 'V2 avançado'];

function assert(condition, message) {
  if (!condition) throw new Error(`BLOCK_PRODUCT_CANONICAL_DRIFT: ${message}`);
}
export function validateCatalog(c, { exists = existsSync } = {}) {
  assert(c.schema_version === 'canone.product-catalog.v1', 'version');
  assert(c.canonical_ownership?.catalog === 'backend/contracts/product/catalog.v1.json', 'canonical ownership');
  assert(c.product_gate === 'HOLD_HUMAN_NO_GO', 'release gate cannot be silently removed');
  assert(c.canonical_ownership?.semantic_provenance_status === 'HOLD_SOURCE', 'semantic provenance gate');
  assert(c.canonical_ownership?.database_status === 'NOT_MIGRATED', 'migrations cannot be marked complete by product generator');
  assert(Array.isArray(c.modules) && c.modules.length === 26, 'exact 26 modules required');
  assert(Array.isArray(c.engines) && c.engines.length > 0, 'shared engine manifest required');
  assert(JSON.stringify(c.phases?.map(x => x.id)) === JSON.stringify(allowedPhase), 'phases');
  assert(new Set(c.phases.map(x => x.id)).size === 4, 'duplicate phase');
  const engineKeys = c.engines.map(x => x.id);
  assert(new Set(engineKeys).size === engineKeys.length, 'duplicate engine id or competing engine');
  for (const e of c.engines) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id), `invalid engine key ${e.id}`);
    assert(typeof e.purpose === 'string' && e.purpose.length > 12, `engine purpose ${e.id}`);
    assert(['PARTIAL_BACKEND','PARTIAL_INFRASTRUCTURE','DDL_NOT_APPLIED','EMPTY_CORPUS','PLANNED'].includes(e.implementation_state), `implementation evidence ${e.id}`);
    if (e.authority_path) {
      assert(!e.authority_path.includes('..') && exists(resolve(root, e.authority_path)), `missing owner path ${e.id}`);
    } else assert(e.implementation_state === 'PLANNED', `unowned implementation ${e.id}`);
  }
  const ids = new Set(), ordinals = new Set();
  for (const m of c.modules) {
    assert(!ids.has(m.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.id), `duplicate/invalid module ID ${m.id}`);
    ids.add(m.id);
    assert(Number.isInteger(m.n) && m.n >= 1 && m.n <= 26 && !ordinals.has(m.n), `duplicate ordinal ${m.n}`);
    ordinals.add(m.n);
    assert(allowedPhase.includes(m.phase) && allowedWaves.includes(m.wave), `phase or wave ${m.id}`);
    assert(m.review_state === 'NOT_HOMOLOGATED', `unapproved product claim ${m.id}`);
    for (const field of ['name','short_name','description','icon']) {
      assert(typeof m[field] === 'string' && m[field].length > 1, `required ${field} ${m.id}`);
    }
    assert(/^Ic[A-Za-z]+$/.test(m.icon), `invalid icon ${m.id}`);
    assert(['../brand/icons','./icones-internos'].includes(m.icon_source), `unapproved icon source ${m.id}`);
    assert(Array.isArray(m.engine_ids) && m.engine_ids.length > 0, `engine binding missing ${m.id}`);
    assert(new Set(m.engine_ids).size === m.engine_ids.length, `duplicate engine binding ${m.id}`);
    for (const key of m.engine_ids) assert(engineKeys.includes(key), `unknown engine ${key} in ${m.id}`);
  }
  assert(ordinals.size === 26, 'missing ordinals');
  for (const alias of c.aliases_pending_human_review || []) {
    assert(ids.has(alias.current_id), `alias for unknown module ${alias.current_id}`);
    assert(!ids.has(alias.proposed_alias), `alias collides with canonical module ${alias.current_id}`);
  }
  return { moduleCount: ids.size, engineCount: engineKeys.length };
}

const js = value => JSON.stringify(value); // generates safe TS string literals
export function renderModuloTs(c) {
  const group = new Map();
  for (const m of c.modules) {
    const icons = group.get(m.icon_source) || new Set();
    icons.add(m.icon); group.set(m.icon_source, icons);
  }
  const imports = [...group.entries()].map(([from, icons]) =>
    `import { ${[...icons].sort().join(', ')} } from ${js(from)};`).join('\n');
  const phases = c.phases.map(p => `  { nome: ${js(p.id)}, lema: ${js(p.lema)} },`).join('\n');
  const modules = c.modules.map(m =>
    `  { n: ${m.n}, id: ${js(m.id)}, nome: ${js(m.name)}, curto: ${js(m.short_name)}, fase: ${js(m.phase)}, icone: ${m.icon},\n    descricao: ${js(m.description)} },`).join('\n');
  return `/* AUTO-GERADO. Fonte única: backend/contracts/product/catalog.v1.json.\n * Rodar: node backend/contracts/product/generate.mjs --write\n * Não alterar o catálogo de 26 módulos manualmente neste arquivo.\n */\nimport type { ComponentType } from 'react';\n${imports}\n\nexport type Fase = 'Estudar' | 'Praticar' | 'Evoluir' | 'Aprovar';\n\nexport interface Modulo {\n  n: number;\n  id: string;\n  nome: string;\n  curto: string;\n  descricao: string;\n  fase: Fase;\n  icone: ComponentType<{ className?: string }>;\n  telas?: string[];\n}\n\nexport const FASES: { nome: Fase; lema: string }[] = [\n${phases}\n];\n\nexport const MODULOS: Modulo[] = [\n${modules}\n];\n\nexport const porFase = (f: Fase) => MODULOS.filter((m) => m.fase === f);\nexport const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);\n`;
}
export function renderCapabilityCsv(c) {
  const cell = x => String(x).replaceAll(';', ',').replaceAll('\n', ' ');
  return [
    'numero;id;modulo;fase;onda;engines_compartilhados;homologacao;go_live',
    ...c.modules.slice().sort((a,b)=>a.n-b.n).map(m =>
      [m.n,m.id,m.name,m.phase,m.wave,m.engine_ids.join(' | '),m.review_state,'NO_GO'].map(cell).join(';')),
  ].join('\n') + '\n';
}
export function renderEngineMarkdown(c) {
  const mdCell = x => String(x ?? 'A definir').replaceAll('|','/');
  const count = new Map(c.engines.map(e=>[e.id,0]));
  for(const m of c.modules)for(const key of m.engine_ids)count.set(key,count.get(key)+1);
  return `# Cânone — motores compartilhados e autoridade única\n\nGerado de \`backend/contracts/product/catalog.v1.json\`. **Não constitui implementação dos motores nem GO de produto.**\n\n| Motor único | Módulos consumidores | Autoridade de código | Evidência de implementação |\n|---|---:|---|---|\n${c.engines.map(e=>`| ${mdCell(e.id)} | ${count.get(e.id)} | \`${mdCell(e.authority_path)}\` | \`${e.implementation_state}\` |`).join('\n')}\n\n**Regra de não concorrência:** um serviço por capacidade; módulos compõem o mesmo motor através de contratos. O pacote editorial/normativo tem autoridade separada do catálogo de produto; o DB ainda não recebeu as 30 migrations.\n\n**Gates globais obrigatórios:** ${c.cross_cutting_guards.join(', ')}.\n\n**Aliases pendentes:** ${c.aliases_pending_human_review.map(a=>`${a.current_id} → ${a.proposed_alias} (sem renomeação automática)`).join('; ')}.\n\n**Status:** \`HOLD_HUMAN_NO_GO\`.\n`;
}

export function validateTemplate(t) {
  assert(t.schema_version === 'canone.feature-acceptance.v1', 'feature template schema');
  assert(t.provenance === 'backend/contracts/product/catalog.v1.json', 'feature template source');
  assert(t.release_status === 'HOLD_HUMAN_NO_GO' && t.gate_status_default === 'PENDING', 'feature rollout gate');
  assert(Array.isArray(t.gates) && t.gates.length === 7, 'seven gates required');
  const ids = t.gates.map(x => x.key);
  assert(new Set(ids).size === 7, 'duplicate gate definition');
  for(const g of t.gates) assert(g.definition.length > 35, `incomplete gate ${g.key}`);
  return t;
}
export function renderAcceptanceCsv(c,t) {
  const rows=['id_subtarefa;id_modulo;nome_modulo;motor;gate;estado;criterio_de_aceite'];
  const cell = x => String(x ?? '').replaceAll(';', ',').replaceAll('\n', ' ');
  for(const m of c.modules.slice().sort((a,b) => a.n-b.n)){
    for(const gate of t.gates){
      rows.push([`CAN-S6-${String(m.n).padStart(2,'0')}-${gate.key}`,m.id,m.name,m.engine_ids.join(' | '),gate.key,t.gate_status_default,gate.definition].map(cell).join(';'));
    }
  }
  return rows.join('\n')+'\n';
}

const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const counts = validateCatalog(catalog);
const featureTemplate = validateTemplate(JSON.parse(readFileSync(featureTemplateFile, 'utf8')));
const outputs = [
  ['app/src/content/modulos.ts', renderModuloTs(catalog)],
  ['docs/generated/canone-modulos-capacidades.csv', renderCapabilityCsv(catalog)],
  ['docs/generated/canone-motores-reutilizaveis.md', renderEngineMarkdown(catalog)],
  ['docs/generated/canone-aceite-26-modulos.csv', renderAcceptanceCsv(catalog, featureTemplate)],
];
const mode = process.argv.includes('--write') ? 'write' : 'check';
const drift = [];
for(const [relative, value] of outputs){
  const p=resolve(root,relative);
  if(mode==='write') {mkdirSync(dirname(p),{recursive:true});writeFileSync(p,value,'utf8');}
  else if(!existsSync(p)||readFileSync(p,'utf8')!==value) drift.push(relative);
}
if(drift.length){console.error('BLOCK_PRODUCT_DRIFT '+drift.join(', '));process.exitCode=4;}
else console.log(`PASS_PRODUCT_CANONICAL_${mode.toUpperCase()} modules=${counts.moduleCount} shared_engines=${counts.engineCount} generated=${outputs.length} release=HOLD_HUMAN_NO_GO`);
