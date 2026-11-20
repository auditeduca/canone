#!/usr/bin/env node
/** Deterministic review queue for Senate legislative *scope candidates*, never canonical knowledge. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateCatalog} from './client.mjs';

export function buildArticleQueue(catalog) {
  validateCatalog(catalog);
  const result=[];const ids=new Set();
  for(const spec of catalog.device_scope_candidates || []) for(const target_unit of spec.target_units) {
    const id=createHash('sha256').update([spec.from,spec.to,spec.source_locator,target_unit].join('\u0000')).digest('hex').slice(0,24);
    if(ids.has(id))throw new Error('DUPLICATE_ARTICLE_CANDIDATE');ids.add(id);
    result.push({candidate_id:id,source_id:spec.from,source_locator:spec.source_locator,target_id:spec.to,
      target_unit,evidence_page:spec.evidence_page,evidence_kind:spec.evidence_kind,
      source_bytes_verified:false,atom_verified:false,legal_temporal_review:'HOLD_HUMAN',
      editorial_review:'HOLD_HUMAN',status:spec.status,canonical_promotion:false});
  }
  result.sort((a,b)=>a.source_id.localeCompare(b.source_id)||a.source_locator.localeCompare(b.source_locator)||a.target_unit.localeCompare(b.target_unit));
  return result;
}
const headers=['candidate_id','source_id','source_locator','target_id','target_unit','evidence_page','evidence_kind','source_bytes_verified','atom_verified','legal_temporal_review','editorial_review','status','canonical_promotion'];
function csvField(value) {const str=String(value);return /[,\n\r"]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;}
export function queueCsv(catalog) {return [headers.join(','),...buildArticleQueue(catalog).map(x=>headers.map(k=>csvField(x[k])).join(','))].join('\n')+'\n';}
const isCli=process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1];
if(isCli) {
  const catalog=JSON.parse(await readFile(new URL('./catalog.v1.json',import.meta.url),'utf8'));
  const content=queueCsv(catalog);
  const filepath=new URL('./generated/article-review-queue.csv',import.meta.url);
  if(process.argv.includes('--write')) {await writeFile(filepath,content);console.log(JSON.stringify({state:'WRITTEN_HOLD_HUMAN',candidates:buildArticleQueue(catalog).length}));}
  else if(process.argv.includes('--check')) {
    const existing=await readFile(filepath,'utf8');
    if(existing!==content) {console.error('BLOCK_ARTICLE_QUEUE_DRIFT');process.exitCode=3;}
    else console.log(JSON.stringify({state:'PASS_NO_DRIFT__HOLD_HUMAN',candidates:buildArticleQueue(catalog).length}));
  } else console.log(JSON.stringify({state:'DRY_RUN_HOLD_HUMAN',candidates:buildArticleQueue(catalog).length}));
}
