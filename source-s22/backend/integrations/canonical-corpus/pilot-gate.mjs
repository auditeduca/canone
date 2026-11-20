/**
 * CANONE V6 — piloto estratificado e gate de recuperação completa.
 * O piloto não promove conteúdo: verifica APENAS os bytes arquivados.
 * O universo esperado permanece uma invariável auditável, sem auto-ajuste.
 */
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {digest, indexSchema, inspectTriadIndex, verifyTriadBytes} from './storage-triad.mjs';

const kinds=[['original','original'],['extracted_text','extracted_text'],['extraction_mask','extraction_mask']];
const cmp=(a,b)=>a<b?-1:a>b?1:0;
export const pilotSchema='canone.pilot-selection.v1';

export function checkSourceIndex(index,{expectedCount=249}={}){
  if(!index || index.schema!==indexSchema || index.source_project_ref!=='pgsybzggewhinaniybiy')
    throw Error('PILOT_SOURCE_INDEX_CONTRACT_INVALID');
  if(!Array.isArray(index.rows)||digest(Buffer.from(JSON.stringify(index.rows)))!==index.index_sha256)
    throw Error('PILOT_SOURCE_INDEX_SHA256_INVALID');
  const check=inspectTriadIndex(index.rows,{expectedCount});
  if(check.index_gate!=='PASS')throw Error(`PILOT_SOURCE_INDEX_GATE_FAIL:${check.blockers[0]?.code}`);
  return true;
}

export function selectPilotRows(rows,{size=5}={}){
  if(!Array.isArray(rows)||!Number.isSafeInteger(size)||size<1||rows.length<size)
    throw Error('PILOT_SIZE_OR_UNIVERSE_INVALID');
  const unique=new Set(rows.map(x=>x.instrument_id));
  if(unique.size!==rows.length)throw Error('PILOT_DUPLICATED_SOURCE');
  const ordered=[...rows].sort((a,b)=>a.original.bytes-b.original.bytes||cmp(a.instrument_id,b.instrument_id));
  // Primeiro item de cada estrato, reproduzível a partir da ordenação de bytes/ID.
  return Array.from({length:size},(_,i)=>ordered[Math.ceil(i*ordered.length/size)]);
}

export function pilotPlan(index,{size=5,expectedCount=249}={}){
  checkSourceIndex(index,{expectedCount});
  const selected=selectPilotRows(index.rows,{size});
  return {schema:pilotSchema,source_project_ref:index.source_project_ref,
    source_index_sha256:index.index_sha256,method:'SIZE_STRATA_FIRST_BY_BYTES_THEN_ID',
    index_count:index.rows.length,pilot_count:selected.length,
    byte_verified:0,release_gate:'HOLD_HUMAN',
    instruments:selected.map((row,i)=>({stratum:i+1,instrument_id:row.instrument_id,original_bytes:row.original.bytes}))};
}

/**
 * Exige a integridade do manifesto e recalcula 3 hashes sobre os 3 blobs de
 * CADA documento do piloto. A mera presença do manifesto nunca é suficiente.
 */
export async function verifyPilotArchives(index,root,{size=5,expectedCount=249}={}){
  const plan=pilotPlan(index,{size,expectedCount});
  const selected=selectPilotRows(index.rows,{size});
  if(!root)throw Error('PILOT_ARCHIVE_ROOT_MISSING');
  const archiveRoot=resolve(root);
  let verified=0;
  for(const row of selected){
    let manifest;
    try{
      manifest=JSON.parse(await readFile(join(archiveRoot,'manifests',digest(Buffer.from(row.instrument_id))+'.json'),'utf8'));
    }catch{throw Error(`HOLD_PILOT_MANIFEST_MISSING:${row.instrument_id}`);}
    if(manifest.instrument_id!==row.instrument_id || manifest.raw_evidence_id!==row.raw_evidence_id ||
       manifest.release_status!=='HOLD_HUMAN' || manifest.published!==false ||
       manifest.rights_reviewed!==false || manifest.semantic_claims_generated!==0 ||
       !Array.isArray(manifest.claims) || manifest.claims.length!==0 ||
       !Array.isArray(manifest.artifacts) || manifest.artifacts.length!==3)
      throw Error(`HOLD_PILOT_MANIFEST_INCONSISTENT:${row.instrument_id}`);
    const buffers=[];
    for(let i=0;i<kinds.length;i++){
      const [field,directory]=kinds[i], a=row[field];
      if(manifest.artifacts[i].kind!==['ORIGINAL','EXTRACTED_TEXT','EXTRACTION_MASK'][i] || manifest.artifacts[i].sha256!==a.sha256 || manifest.artifacts[i].bytes!==a.bytes ||
         manifest.artifacts[i].verified!==true)
        throw Error(`HOLD_PILOT_ARTIFACT_MANIFEST_MISMATCH:${row.instrument_id}`);
      try{buffers.push(await readFile(join(archiveRoot,directory,a.sha256)));}
      catch{throw Error(`HOLD_PILOT_ARCHIVED_BLOB_MISSING:${row.instrument_id}`);}
    }
    try{verifyTriadBytes(row,buffers);}catch(e){throw Error(`HOLD_PILOT_BLOB_RECHECK_FAILED:${row.instrument_id}:${e.message}`);}
    verified++;
  }
  return {...plan,byte_verified:verified,archive_gate:'PASS_BYTES__HOLD_HUMAN',release_gate:'HOLD_HUMAN'};
}
