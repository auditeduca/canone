// Biblioteca determinística de metadados. JSON de origem -> artefatos gerados.
// Nunca edita tabelas ou promove conteúdo: a base é a autoridade, os artefatos são derivados.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const stable = object => JSON.stringify(sortObject(object),null,2)+'\n';
export function sortObject(obj) {
  if(Array.isArray(obj))return obj.map(sortObject);
  if(obj&&typeof obj==='object')return Object.fromEntries(Object.keys(obj).sort().map(k=>[k,sortObject(obj[k])]));
  return obj;
}
export const identifier = name => name.replace(/[^a-zA-Z0-9_]/g,'__');
export const quotedCsv = v => '"'+String(v??'').replaceAll('"','""')+'"';
export const escMermaid = v => String(v).replaceAll('"',"'").replaceAll('\n',' ');
export const escapeMd = v => String(v??'').replaceAll('|','\\|').replaceAll('\n',' ');

export function parseCanoneERD(text) {
  const tables=[];
  let table=null;
  for(const line of text.split(/\r?\n/)) {
    const start=line.match(/^\s{2}((?:identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit)\.[A-Za-z0-9_]+)\s+\{$/);
    if(start) { table={id:start[1], columns:[]};tables.push(table);continue; }
    if(table && /^\s*\}$/.test(line)){table=null;continue;}
    if(table){const col=line.trim().match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_[\]]+)/); if(col)table.columns.push({name:col[1],type:col[2]});}
  }
  return tables;
}

export function validateSnapshot(snapshot, contract, targetTables) {
  const issues=[];
  const byName=new Map(snapshot.tables.map(t=>[t.id,t]));
  if(byName.size!==snapshot.tables.length)issues.push('DUPLICATE_ENTITY');
  for(const t of snapshot.tables) {
    if(!/^[a-z_]+\.[a-z_0-9]+$/.test(t.id))issues.push('INVALID_ENTITY '+t.id);
    if(t.primary_key?.some(k=>t.columns.length&&!t.columns.some(c=>c.name===k))) issues.push('PK_MISSING_COLUMN '+t.id);
    if(t.object_kind==='VIEW'&&t.primary_key.length) issues.push('VIEW_PRETENDS_PHYSICAL_PK '+t.id);
    if(t.object_kind==='VIEW'&&!t.view_base) issues.push('VIEW_BASE_NOT_DOCUMENTED '+t.id);
  }
  const relNames=new Set();
  for(const r of snapshot.relationships) {
    if(relNames.has(r.id))issues.push('DUPLICATE_RELATION '+r.id);
    relNames.add(r.id);
    if(!byName.has(r.from)||!byName.has(r.to))issues.push('RELATION_ENDPOINT_MISSING '+r.id);
    if(r.from_columns.length!==r.to_columns.length||r.from_columns.length===0)issues.push('FK_COLUMN_ARITY '+r.id);
    if(r.kind==='FOREIGN_KEY'&&r.validated!==true)issues.push('UNVALIDATED_FK '+r.id);
    if(r.kind!=='FOREIGN_KEY'&&r.validated===true)issues.push('LOGICAL_RELATION_MISLABELED '+r.id);
  }
  for(const v of snapshot.tables.filter(t=>t.object_kind==='VIEW')) {
    if(snapshot.relationships.some(r=>r.kind==='FOREIGN_KEY'&&r.from===v.id))issues.push('VIEW_PRETENDS_PHYSICAL_FK '+v.id);
    if(!snapshot.relationships.some(r=>r.kind==='VIEW_DEPENDENCY'&&r.from===v.id&&r.to===v.view_base))issues.push('VIEW_DEPENDENCY_MISSING '+v.id);
  }
  const actualFks=snapshot.relationships.filter(x=>x.kind==='FOREIGN_KEY');
  const expected=(snapshot.constraints_count?.account_palm?.foreign_keys||0)+(snapshot.constraints_count?.contabilidade_cfc?.foreign_keys||0);
  if(expected!==actualFks.length) issues.push(`FK_COUNT_MISMATCH expected=${expected} actual=${actualFks.length}`);
  const mapped=new Set(contract.tables.map(x=>x.source));
  if(mapped.size!==contract.tables.length)issues.push('DUPLICATE_CONTRACT_SOURCE');
  const allowlist=['contabilidade_cfc.','account_palm.','public.regulatory_instruments'];
  for(const entry of contract.tables) {
    if(!allowlist.some(prefix=>entry.source===prefix||entry.source.startsWith(prefix)&&prefix!=='public.regulatory_instruments'))issues.push('UNAUTHORIZED_SOURCE '+entry.source);
    if(!byName.has(entry.source))issues.push('CONTRACT_TABLE_MISSING '+entry.source);
    if(!entry.key)issues.push('CONTRACT_PK_UNDEFINED '+entry.source);
  }
  const targets=new Set(targetTables.map(t=>t.id));
  for(const must of ['editorial.source','editorial.content_item','editorial.content_item_version','norms.norm','norms.norm_version','norms.norm_item','learning.item']) {
    if(!targets.has(must))issues.push('CANONE_TARGET_MISSING '+must);
  }
  const obs=snapshot.observations;
  const blockers=[];
  if(obs.questions_missing_official_answer>0)blockers.push(`GABARITO_PENDENTE:${obs.questions_missing_official_answer}`);
  if(obs.regulatory_public_only>0)blockers.push(`NORMAS_NAO_CONCILIADAS:${obs.regulatory_public_only}`);
  if(obs.normative_segments_editorial_pending>0)blockers.push(`SEGMENTOS_SEM_REVISAO:${obs.normative_segments_editorial_pending}`);
  if(obs.normative_scope_publication_eligible===0)blockers.push('NENHUMA_NORMA_APTA_A_PUBLICAR');
  return {structural_issues:issues,release_blockers:blockers,structurally_valid:issues.length===0,release_gate:'HOLD_HUMAN', relationships_count:snapshot.relationships.length,foreign_keys:actualFks.length,logical_relations:snapshot.relationships.filter(r=>r.kind==='LOGICAL_CROSSWALK').length,view_dependencies:snapshot.relationships.filter(r=>r.kind==='VIEW_DEPENDENCY').length};
}

export function buildArtifacts(snapshot,contract,targetTables) {
  const validation=validateSnapshot(snapshot,contract,targetTables);
  if(validation.structural_issues.length)throw new Error('METADATA_INVALID '+validation.structural_issues.join(' | '));
  const sourceTables=[...snapshot.tables].sort((a,b)=>a.id.localeCompare(b.id));
  const rels=[...snapshot.relationships].sort((a,b)=>a.id.localeCompare(b.id));
  const targetIndex=new Map(targetTables.map(x=>[x.id,x]));
  const crosswalk=contract.tables.map(e=>({source:e.source,source_pk:e.key,target_candidate:e.target,source_type:e.type,gate:e.gate,status:'HOLD_HUMAN',target_exists_in_core:[...targetIndex.keys()].some(t=>e.target.startsWith(t)),published:false}));
  const dictionaryRows=[['schema','entity','object_kind','view_base','column','data_type','nullable','physical_primary_key','source_of_truth','completeness']];
  for(const t of sourceTables) for(const c of t.columns){ dictionaryRows.push([t.schema,t.name,t.object_kind??'UNKNOWN',t.view_base??'',c.name,c.type,c.nullable===null?'UNKNOWN':c.nullable===true?'YES':'NO',t.primary_key.includes(c.name)?'YES':'NO','SUPABASE_AUDIT_EDUCA',t.introspection_level]); }
  const dictionary=dictionaryRows.map(row=>row.map(quotedCsv).join(';')).join('\n')+'\n';
  const md=[
    '# Dicionário de dados — Cânone / Audit Educa',
    '',
    `> Gerado de snapshot **${snapshot.scope}**. Não preencher colunas não verificadas por inferência. Fonte: ${snapshot.source}.`,
    '',
    '| Objeto | Tipo físico | Chave PK (não aplicável a view) | Colunas descritas | Linhas observadas | Cobertura |',
    '|---|---|---|---:|---:|---|',
    ...sourceTables.map(t=>`| \`${escapeMd(t.id)}\` | ${t.object_kind} | ${escapeMd(t.object_kind==='VIEW'?'N/A (identidade lógica: '+(t.logical_identity||[]).join(', ')+')':t.primary_key.join(', ')||'NÃO VERIFICADA')} | ${t.columns.length} | ${t.row_count??'não medida'} | ${escapeMd(t.introspection_level)} |`),
    '',
    '## Relacionamentos físicos observados',
    '',
    '| Origem | Coluna | Referência | Coluna | Prova |', '|---|---|---|---|---|',
    ...rels.filter(r=>r.kind==='FOREIGN_KEY').map(r=>`| \`${r.from}\` | \`${r.from_columns}\` | \`${r.to}\` | \`${r.to_columns}\` | FK validada no catálogo |`),
    '',
    '## Relações de view e lógicas — NÃO são FKs',
    '',
    ...rels.filter(r=>r.kind!=='FOREIGN_KEY').map(r=>`- [${r.kind}] \`${r.from}\` → \`${r.to}\` (${r.evidence})`),
    '',
    '## Bloqueios da promoção', '', ...validation.release_blockers.map(b=>`- ${b}`),
    '', 'O arquivo CSV é o dicionário por coluna. O modo `--live --check` verifica drift físico contra o banco.'
  ].join('\n')+'\n';
  const nodes=[...new Set(rels.flatMap(r=>[r.from,r.to]))].sort();
  const diagram=[`%% GERADO; ${rels.length} relações (${validation.foreign_keys} FKs físicas, ${validation.view_dependencies} dependências de views).`,`%% Linhas com marcador “lógico” não são constraints SQL.`,`flowchart LR`,...nodes.map(n=>`  ${identifier(n)}["${escMermaid(n)}"]`),...rels.map(r=>`  ${identifier(r.from)} ${r.kind==='FOREIGN_KEY'?'-->':'-.->'}|"${escMermaid(r.from_columns.join('+')+' → '+r.to_columns.join('+')+(r.kind==='FOREIGN_KEY'?' [FK]':r.kind==='VIEW_DEPENDENCY'?' [VIEW]':' [LÓGICO]'))}"| ${identifier(r.to)}`)].join('\n')+'\n';
  const mapDoc=['# Mapa de integração e entidades', '', 'Arestas de integração são candidatas, **não FKs remotas entre projetos**.', '', '| Origem | Identidade origem | Destino Cânone | Gate |', '|---|---|---|---|', ...crosswalk.map(x=>`| \`${x.source}\` | \`${x.source_pk}\` | \`${x.target_candidate}\` | \`${x.gate}\` |`), '', '## Modelo Cânone identificado no ERD do pacote', '', `Tabelas declaradas no ERD fornecido: ${targetTables.length}. Reexecutar o gerador sobre PostgreSQL real em homologação para confirmar contagem e FKs.`, '', ...targetTables.map(t=>`- \`${t.id}\`: ${t.columns.length} colunas registradas no diagrama original`)].join('\n')+'\n';
  const graph = {version:'canone.metamodel.observed.v1',source_ref:snapshot.project_ref,scope:snapshot.scope, entities:sourceTables.map(t=>({id:t.id,object_kind:t.object_kind,view_base:t.view_base??null,attributes:t.columns,primary_key:t.primary_key,logical_identity:t.logical_identity||[],observed_rows:t.row_count,completeness:t.introspection_level})),relations:rels,targets:targetTables.map(t=>({id:t.id,columns:t.columns})),integration:crosswalk,publication_policy:'HOLD_HUMAN'};
  const typing= ['// GERADO. NÃO EDITAR. Tipos unknown são campos não introspectados no snapshot parcial.',
    'export interface CanoneExternalMetadata {',
    ...sourceTables.map(t=>{
      const fields=t.columns.map(c=>{
        const x=c.type; const type=/^(int|bigint|numeric|double|real|float)/.test(x)?'number':/^(bool)/.test(x)?'boolean':/(json)/.test(x)?'unknown':x==='unknown'?'unknown':'string';
        return `    '${c.name}'?: ${type};`;
      });
      return [`  '${t.id}': {`,...fields,'  };'].join('\n');
    }),
    '}',''].join('\n');
  const integrationGraph = ['%% GERADO · source of record -> candidato canônico','flowchart LR',...crosswalk.map((c,i)=>`  SRC${i}[\"${escMermaid(c.source)}\"] -.->|\"${escMermaid(c.gate)}\"| DEST${i}[\"${escMermaid(c.target_candidate)}\"]`),''].join('\n');
  const integrity=stable({snapshot_sha256:sha256(stable(snapshot)),contract_sha256:sha256(stable(contract)),target_erd_sha256:sha256(stable(targetTables)),...validation});
  return {
    'dicionario-dados.csv':dictionary,
    'dicionario-dados.md':md,
    'relacionamentos.mmd':diagram,
    'mapa-crosswalk.md':mapDoc,
    'crosswalk.generated.json':stable({contract:contract.contract_id,source:contract.source_project_ref,policy:'HOLD_HUMAN',links:crosswalk}),
    'integrity-gate.generated.json':integrity,
    'metadata.generated.json':stable({snapshot,sources:sourceTables.map(t=>t.id),targets:targetTables.map(t=>t.id),foreign_keys:validation.foreign_keys,logical_relations:validation.logical_relations,view_dependencies:validation.view_dependencies}),
    'metamodel.generated.json':stable(graph),
    'metadata.types.generated.d.ts':typing,
    'integracao-crosswalk.mmd':integrationGraph,
  };
}

export function readInputs(root, snapshotPath) {
  const snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));
  const contract=JSON.parse(readFileSync(new URL('../audit-educa/contract.v1.json',import.meta.url),'utf8'));
  const targetTables=parseCanoneERD(readFileSync(new URL('../../docs/03-erd.mmd',import.meta.url),'utf8'));
  return {snapshot,contract,targetTables};
}
