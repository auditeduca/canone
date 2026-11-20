#!/usr/bin/env node
/**
 * V9: reconciles official-page metadata into review-only, source-addressed candidates.
 * This does NOT ingest HTML bytes, establish normative atoms, or assert consolidated law.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateCatalog} from './client.mjs';
import {buildArticleQueue} from './article-queue.mjs';

const sourceUrlPattern=/^https:\/\/legis\.senado\.leg\.br\/norma\/[1-9][0-9]*(?:\/publicacao\/[1-9][0-9]*)?$/;
const allowedStates=new Set(['HOLD_SOURCE_BYTES_AND_TEMPORAL_REVIEW','HOLD_NEW_ACT_ENROLLMENT_AND_TEMPORAL_REVIEW']);
const acceptedKinds=new Set(['SENADO_HTML_METADATA_ONLY','SENADO_HTML_PUBLISHED_TEXT_DISPLAY','SENADO_HTML_POSTERIOR_CHANGE_METADATA']);
const expectedPriorUnits=[...new Set(['art.176','art.177','art.178','art.179','art.181','art.182','art.182.caput.c','art.182.caput.d','art.183','art.184','art.187','art.187.par2','art.188','art.195-A','art.197','art.199','art.226','art.248'])];
const externalAct='BR-FED-LEI-14039-2020';

function checksum(text){return createHash('sha256').update(text).digest('hex');}
function itemKey(from,to,locator,unit){return [from,to,locator,unit].join('\u0000');}

export function reconcilePageObservations(catalog,observations) {
  validateCatalog(catalog);
  if(observations?.schema!=='canone.senado.page-observations.v1'||observations.global_publication_eligible!==false||!Array.isArray(observations.observations))throw new Error('INVALID_PAGE_OBSERVATIONS');
  if(observations.observed_on!=='2026-11-14'||observations.observations.length!==4)throw new Error('UNREVIEWED_OBSERVATION_SET');
  const base=buildArticleQueue(catalog);
  if(base.length!==26)throw new Error('V8_SCOPE_BASELINE_CHANGED');
  const previous=new Map(base.map(x=>[itemKey(x.source_id,x.target_id,x.source_locator,x.target_unit),x]));
  const seenGroups=new Set(),seenKeys=new Set(),result=[];
  for(const group of observations.observations){
    if(typeof group.group_id!=='string'||!/^SENADO-[0-9]{4}-[A-Z0-9-]+$/.test(group.group_id)||seenGroups.has(group.group_id))throw new Error('DUPLICATE_OR_INVALID_OBSERVATION_GROUP');
    seenGroups.add(group.group_id);
    if(!sourceUrlPattern.test(group.source_url)||!acceptedKinds.has(group.record_kind)||!allowedStates.has(group.status)||
      group.source_bytes_verified!==false||group.atom_verified!==false||group.publication_eligible!==false||
      !Array.isArray(group.target_units)||!group.target_units.length||new Set(group.target_units).size!==group.target_units.length||
      !Array.isArray(group.observed_lines_hint)||group.observed_lines_hint.length!==2||
      !group.observed_lines_hint.every(x=>Number.isSafeInteger(x)&&x>0)||group.observed_lines_hint[0]>group.observed_lines_hint[1])throw new Error('UNVERIFIED_PAGE_METADATA');
    const isNew=group.source_id===externalAct;
    if(isNew){
      if(group.target_id!=='BR-FED-DL-9295-1946'||group.source_locator!=='NOT_ATOMIZED'||
         group.source_url!=='https://legis.senado.leg.br/norma/534334'||
         group.relationship_type!=='ADDS'||group.record_kind!=='SENADO_HTML_POSTERIOR_CHANGE_METADATA'||
         group.status!=='HOLD_NEW_ACT_ENROLLMENT_AND_TEMPORAL_REVIEW'||
         JSON.stringify(group.target_units)!==JSON.stringify(['art.25.par1','art.25.par2']))throw new Error('UNVERIFIED_POSTERIOR_CHANGE');
    } else {
      const scope=catalog.device_scope_candidates.find(x=>x.from===group.source_id&&x.to===group.target_id&&x.source_locator===group.source_locator);
      if(!scope||group.source_url!==scope.evidence_page||JSON.stringify(group.target_units)!==JSON.stringify(scope.target_units)||
        (group.source_locator==='art.77'?group.relationship_type!=='ADDS':group.relationship_type!=='AMENDS')||
        group.status!=='HOLD_SOURCE_BYTES_AND_TEMPORAL_REVIEW') throw new Error('V8_SCOPE_EVIDENCE_DRIFT');
      if(group.source_locator==='alteracao_de_dispositivos'&&JSON.stringify(group.target_units)!==JSON.stringify(expectedPriorUnits))throw new Error('WRONG_2007_SCOPE');
    }
    for(const target_unit of group.target_units){
      const k=itemKey(group.source_id,group.target_id,group.source_locator,target_unit);
      if(seenKeys.has(k))throw new Error('DUPLICATE_SOURCE_ANCHOR');seenKeys.add(k);
      const prior=previous.get(k);
      if(!isNew&&!prior)throw new Error('MISSING_V8_BASELINE');
      const candidate_id=prior?.candidate_id??checksum(k).slice(0,24);
      result.push({candidate_id,source_id:group.source_id,source_locator:group.source_locator,target_id:group.target_id,target_unit,
        relation_kind:group.relationship_type,source_page:group.source_url,source_observation_group:group.group_id,
        rendered_line_hint_start:group.observed_lines_hint[0],rendered_line_hint_end:group.observed_lines_hint[1],
        evidence_level:'OFFICIAL_WEB_PAGE_RENDERED_METADATA',source_bytes_verified:false,atom_verified:false,
        source_temporal_validity:'UNVERIFIED',editorial_review:'HOLD_HUMAN',legal_review:'HOLD_HUMAN',
        publication_eligible:false,canonical_promotion:false,review_priority:group.source_locator==='art.76'&&['art.6','art.12'].includes(target_unit)?'P0':'P1',
        status:group.status});
    }
  }
  if(seenKeys.size!==28||[...previous.keys()].some(k=>!seenKeys.has(k)))throw new Error('INCOMPLETE_OR_EXTRA_SOURCE_ANCHORS');
  result.sort((a,b)=>a.source_id.localeCompare(b.source_id)||a.source_locator.localeCompare(b.source_locator)||a.target_unit.localeCompare(b.target_unit));
  return result;
}

const columns=['candidate_id','source_id','source_locator','target_id','target_unit','relation_kind','source_page','source_observation_group','rendered_line_hint_start','rendered_line_hint_end','evidence_level','source_bytes_verified','atom_verified','source_temporal_validity','editorial_review','legal_review','publication_eligible','canonical_promotion','review_priority','status'];
function csvCell(v){const s=String(v);return /[,\n\r"]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
export function outputs(catalog,observation){
  const rows=reconcilePageObservations(catalog,observation);
  const csv=[columns.join(','),...rows.map(r=>columns.map(k=>csvCell(r[k])).join(','))].join('\n')+'\n';
  const report={schema:'canone.senado.page-scope-reconciliation.v1',observed_on:observation.observed_on,total_candidates:rows.length,
    v8_reconciled:26,posterior_change_candidates:2,high_priority_exame_suficiencia:2,
    backed_by_preserved_source_bytes:0,canonical_claims:0,publication_eligible:false,
    gates:['HOLD_RAW_SOURCE_BYTES','HOLD_CURRENT_TEXT_AND_TEMPORAL_VALIDITY','HOLD_LEGAL_REVIEW','HOLD_EDITORIAL_REVIEW'],
    evidence_source:'OFFICIAL_SENATE_PAGES_RENDERED_TEXT__NOT_API_JSON',csv_sha256:checksum(csv)};
  return {rows,csv,report:JSON.stringify(report,null,2)+'\n'};
}

const isCli=Boolean(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]);
if(isCli){
  const catalog=JSON.parse(await readFile(new URL('./catalog.v1.json',import.meta.url),'utf8'));
  const observation=JSON.parse(await readFile(new URL('./source-observations.v1.json',import.meta.url),'utf8'));
  const {csv,report,rows}=outputs(catalog,observation);
  const outDir=new URL('./generated/',import.meta.url);
  if(process.argv.includes('--write')){
    await mkdir(outDir,{recursive:true});await writeFile(new URL('source-backed-review.csv',outDir),csv);await writeFile(new URL('source-backed-report.json',outDir),report);
    console.log(JSON.stringify({state:'WRITTEN_REVIEW_ONLY',candidates:rows.length,publication_eligible:false}));
  }else if(process.argv.includes('--check')){
    const [a,b]=await Promise.all([readFile(new URL('source-backed-review.csv',outDir),'utf8'),readFile(new URL('source-backed-report.json',outDir),'utf8')]);
    if(a!==csv||b!==report){console.error('BLOCK_SENADO_SOURCE_ANCHOR_DRIFT');process.exitCode=3;}
    else console.log(JSON.stringify({state:'PASS_SOURCE_ANCHORS_NO_DRIFT__HOLD_HUMAN',candidates:rows.length,publication_eligible:false}));
  }else console.log(JSON.stringify({state:'DRY_RUN_REVIEW_ONLY',candidates:rows.length,publication_eligible:false}));
}
