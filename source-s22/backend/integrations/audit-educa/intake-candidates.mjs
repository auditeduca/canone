#!/usr/bin/env node
// Adapta snapshots para CANDIDATOS; não escreve no banco e não promove conteúdo.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sha256,mapRows} from './map-candidates.mjs';
import {reconcileRegulatory} from './reconcile-regulatory.mjs';
import {inspectGraph} from '../metadata-auto/graph-gate.mjs';
import {inspectReadiness,buildEvidenceQueue} from '../canonical-corpus/readiness.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const input=process.env.CANONE_BRIDGE_EXPORT_DIR || path.resolve(here,'../../.local-bridge/export');
const output=process.env.CANONE_BRIDGE_CANDIDATE_DIR || path.resolve(here,'../../.local-bridge/candidates');
const contract=JSON.parse(await readFile(path.join(here,'contract.v1.json'),'utf8'));
if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({status:'DRY_RUN',input,output,candidate_only:true,remote_writes:0},null,2));process.exit(0);
}
let sourceManifest;try{sourceManifest=JSON.parse(await readFile(path.join(input,'manifest.json'),'utf8'));}
catch{console.error('HOLD: falta manifest.json da extração de origem');process.exit(2);}
if(sourceManifest.contract!==contract.contract_id || sourceManifest.source_project_ref!==contract.source_project_ref) {
  throw new Error('SOURCE_CONTRACT_MISMATCH');
}
await mkdir(output,{recursive:true});
// FAIL-CLOSED: impedir que resultado de uma execução antiga seja lido após erro no novo lote.
await rm(path.join(output,'candidates.ndjson'),{force:true});
await rm(path.join(output,'intake-report.json'),{force:true});
await rm(path.join(output,'evidence-queue.json'),{force:true});
const report={contract:contract.contract_id,generated_at:new Date().toISOString(),candidate_only:true,
  promotions:0,remote_writes:0,tables:[],candidate_count:0};
const all=[];
const regulatorySources={};
for(const item of contract.tables) {
  const sourceMeta=sourceManifest.tables.find(t=>t.source===item.source);
  if(!sourceMeta) throw new Error(`MISSING_SOURCE_TABLE ${item.source}`);
  const filePath=path.join(input,sourceMeta.file);
  if(path.dirname(filePath)!==path.resolve(input))throw new Error('PATH_TRAVERSAL');
  const raw=await readFile(filePath,'utf8');
  if(sha256(raw)!==sourceMeta.sha256)throw new Error(`SOURCE_HASH_MISMATCH ${item.source}`);
  const records=raw.trim()?raw.trimEnd().split('\n').map(x=>JSON.parse(x)):[];
  if(records.length!==sourceMeta.rows)throw new Error(`ROW_COUNT_MISMATCH ${item.source}`);
  if(item.source==='account_palm.regulatory_instruments'||item.source==='public.regulatory_instruments') regulatorySources[item.source]=records;
  const mapped=mapRows(item,records);
  all.push(...mapped);
  report.tables.push({source:item.source,rows:mapped.length,gate:item.gate});
  report.candidate_count+=mapped.length;
}
report.regulatory_crosscheck=reconcileRegulatory(regulatorySources['account_palm.regulatory_instruments']||[],regulatorySources['public.regulatory_instruments']||[]);
// Gate obrigatório antes de gravar o lote: FKs físicas/lógicas, órfãos,
// identidade de origem e proibição de publicação prematura.
report.semantic_readiness=inspectReadiness(all);
report.graph_integrity=inspectGraph(all);
await writeFile(path.join(output,'graph-findings.json'), JSON.stringify(report.graph_integrity,null,2)+'\n',{mode:0o600});
if(report.graph_integrity.integrity_gate!=='PASS') {
  console.error('CROSS_TABLE_INTEGRITY_FAIL:',report.graph_integrity.critical_count,'encontrados; lote não publicado e candidatos não escritos');
  process.exit(3);
}
const content=all.map(x=>JSON.stringify(x)).join('\n')+'\n';
const dest=path.join(output,'candidates.ndjson');
await writeFile(dest+'.tmp',content,{mode:0o600});
await rename(dest+'.tmp',dest);
report.sha256=sha256(content);
await writeFile(path.join(output,'evidence-queue.json'),JSON.stringify(buildEvidenceQueue(all),null,2)+'\n',{mode:0o600});
await writeFile(path.join(output,'intake-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
