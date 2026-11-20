// Cânone V5 — trilha verificável do ORIGINAL PDF, TXT derivado e MASK derivada.
// Regras: índice é apenas evidência de existência; somente SHA dos BYTES dá integridade.
// Não gera claim nem altera banco; não confunde PDF com um extrato textual.
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, chmod} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {TextDecoder} from 'node:util';

export const digest = b => createHash('sha256').update(b).digest('hex');
const SHA = /^[a-f0-9]{64}$/;
const REF = /^CFC-[A-Za-z0-9._:-]+$/;
const KINDS = ['ORIGINAL','EXTRACTED_TEXT','EXTRACTION_MASK'];
const safePath = p => typeof p==='string' && p.length>0 && p.length<=1024 &&
  !p.startsWith('/') && !p.endsWith('/') && !p.includes('\\') && !p.includes('%') && !/[?#\x00-\x1f]/.test(p) &&
  p.split('/').every(s=>s.length>0 && s!=='.' && s!=='..');
const safeBucket = b => typeof b==='string' && /^[A-Za-z0-9_-]+$/.test(b);
const int=n => Number.isSafeInteger(n) && n>=0;
export const indexSchema='canone.source-storage-triad.v1';

export function inspectTriadIndex(rows, {expectedCount=null}={}) {
  const findings=[], ids=new Set(), paths=new Map();
  if(!Array.isArray(rows))throw Error('TRIAD_NOT_ARRAY');
  const bad=(code,instrument_id)=>findings.push({severity:'P0',code,instrument_id:instrument_id||null});
  if(rows.length===0)bad('NO_SOURCE_INDEX');
  if(expectedCount!==null && rows.length!==expectedCount)bad('INVENTORY_COUNT_DRIFT');
  for(const row of rows){
    if(!row || typeof row!=='object'){bad('INDEX_ROW_INVALID');continue;}
    const id=row.instrument_id;
    if(!REF.test(id||'')){bad('SOURCE_ID_OUT_OF_SCOPE');continue;}
    if(ids.has(id))bad('DUPLICATE_INSTRUMENT',id);
    ids.add(id);
    if(!row.raw_evidence_id)bad('MISSING_ACQUISITION_REFERENCE',id);
    if(row.acquisition_instrument_id!==id)bad('ACQUISITION_INSTRUMENT_MISMATCH',id);
    if(row.acquisition_sha256!==row.original?.sha256)bad('ACQUISITION_SHA_MISMATCH',id);
    if(row.acquisition_size!==row.original?.bytes)bad('ACQUISITION_BYTES_MISMATCH',id);
    if(row.content_type!=='application/pdf')bad('ORIGINAL_FORMAT_NOT_PDF',id);
    if(row.identity_gate!==true || row.provenance_gate!==true || row.normative_text_gate!==true)bad('ACQUISITION_GATES_INCOMPLETE',id);
    if(row.canonical_promotion!==false || row.promotion_eligible!==false || row.publication_mode!=='INTERNAL_ONLY')bad('UNEXPECTED_PUBLICATION_STATUS',id);
    if(!['BLOCKED','HOLD'].includes(row.acquisition_gate_status))bad('SOURCE_GATE_STATE_UNEXPECTED',id);
    for(const kind of KINDS){
      const o=row[{ORIGINAL:'original',EXTRACTED_TEXT:'extracted_text',EXTRACTION_MASK:'extraction_mask'}[kind]];
      if(!o || !safeBucket(o.bucket) || !safePath(o.path) || !o.storage_object_id || !SHA.test(o.sha256||'')){
        bad('ARTIFACT_REFERENCE_OR_HASH_INVALID:'+kind,id);continue;
      }
      if(!int(o.bytes))bad('ARTIFACT_SIZE_INVALID:'+kind,id);
      const key=o.bucket+'/'+o.path;
      if(paths.has(key) && paths.get(key)!==o.sha256)bad('STORAGE_PATH_MULTI_HASH',id);
      paths.set(key,o.sha256);
      if(kind==='ORIGINAL' && o.bytes!==row.acquisition_size)bad('ORIGINAL_STORAGE_SIZE_MISMATCH',id);
    }
  }
  return {schema:indexSchema,checked_instruments:ids.size,storage_objects_expected:rows.length*3,
    blockers:findings,critical_count:findings.length,index_gate:findings.length?'FAIL':'PASS',
    byte_verified:0,semantic_claims_approved:0,publication_gate:'HOLD_HUMAN'};
}

function mustUtf8(bytes){return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
export function verifyTriadBytes(row, blobs){
  const r={instrument_id:row.instrument_id,status:'BYTES_VERIFIED__HOLD_SEMANTIC_REVIEW',artifacts:[]};
  for(const [i,kind] of KINDS.entries()){
    const a=row[{ORIGINAL:'original',EXTRACTED_TEXT:'extracted_text',EXTRACTION_MASK:'extraction_mask'}[kind]];
    const bytes=blobs[i];
    if(!Buffer.isBuffer(bytes) || bytes.length===0)throw Error(`EMPTY_OR_INVALID_BYTES:${kind}`);
    if(bytes.length!==a.bytes)throw Error(`ARTIFACT_BYTES_LENGTH_MISMATCH:${kind}`);
    const actual=digest(bytes);
    if(actual!==a.sha256)throw Error(`ARTIFACT_SHA256_MISMATCH:${kind}`);
    if(kind==='ORIGINAL' && !bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('SOURCE_PDF_MAGIC_INVALID');
    if(kind==='EXTRACTED_TEXT' && !mustUtf8(bytes).trim())throw Error('EXTRACTED_TEXT_UTF8_INVALID');
    r.artifacts.push({kind,sha256:actual,bytes:bytes.length,verified:true});
  }
  r.publication_eligible=false;r.rights_reviewed=false;r.semantic_claims_generated=0;
  return r;
}

async function persistIfValid(root,kind,bytes,expected){
  // Nunca formar caminhos locais a partir do caminho vindo do Storage.
  const dest=join(root,kind.toLowerCase(),expected);
  await mkdir(dirname(dest),{recursive:true,mode:0o700});
  const prior=await readFile(dest).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(prior){if(digest(prior)!==expected)throw Error('ARCHIVE_CONTENT_COLLISION');}
  else await writeFile(dest,bytes,{flag:'wx',mode:0o600});
  await chmod(dest,0o600);
  return dest;
}

export async function archiveVerifiedTriad(row,{fetchObject,root}){
  if(typeof fetchObject!=='function')throw Error('FETCH_OBJECT_REQUIRED');
  if(!root)throw Error('PRIVATE_ROOT_REQUIRED');
  const gate=inspectTriadIndex([row]);
  if(gate.index_gate!=='PASS')throw Error('INDEX_GATE_FAILED:'+gate.blockers[0].code);
  const objects=[row.original,row.extracted_text,row.extraction_mask];
  // Efetuar TODOS os downloads e testes primeiro; nunca produzir manifesto de
  // sucesso parcial ou um claim quando apenas um artefato foi recuperado.
  const buffers=[];
  for(const artifact of objects){
    const received=await fetchObject(artifact);
    buffers.push(received);
  }
  const evidence=verifyTriadBytes(row,buffers);
  const privateRoot=resolve(root);
  for(let i=0;i<objects.length;i++)await persistIfValid(privateRoot,KINDS[i],buffers[i],objects[i].sha256);
  const manifest={...evidence,raw_evidence_id:row.raw_evidence_id,source_system:'Calculadoras-Smart',
    source_ref:'account_palm.normative_extractions',published:false,claims:[],release_status:'HOLD_HUMAN'};
  await mkdir(join(privateRoot,'manifests'),{recursive:true,mode:0o700});
  await writeFile(join(privateRoot,'manifests',digest(Buffer.from(row.instrument_id))+'.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  return manifest;
}

export function makePrivateStorageFetcher({projectRef,apiKey,accessToken,fetchImpl=fetch,maxBytes=20_000_000}){
  if(!/^[a-z0-9]{20}$/.test(projectRef||''))throw Error('PROJECT_REF_INVALID');
  if(!apiKey || !accessToken)throw Error('AUTHENTICATED_STORAGE_CREDENTIALS_REQUIRED');
  return async artifact=>{
    if(!safeBucket(artifact.bucket)||!safePath(artifact.path)||!int(artifact.bytes)||artifact.bytes>maxBytes)
      throw Error('STORAGE_REFERENCE_OR_LIMIT_INVALID');
    const path=artifact.path.split('/').map(encodeURIComponent).join('/');
    const url=`https://${projectRef}.supabase.co/storage/v1/object/authenticated/${encodeURIComponent(artifact.bucket)}/${path}`;
    const response=await fetchImpl(url,{headers:{apikey:apiKey,Authorization:`Bearer ${accessToken}`},redirect:'error'});
    if(!response.ok)throw Error(`STORAGE_HTTP_${response.status}`);
    const reported=Number(response.headers.get('content-length'));
    if(Number.isFinite(reported)&&reported>maxBytes)throw Error('STORAGE_CONTENT_EXCEEDS_LIMIT');
    const chunks=[];let size=0;
    for await(const chunk of response.body){
      size+=chunk.length;
      if(size>maxBytes)throw Error('STORAGE_CONTENT_EXCEEDS_LIMIT');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks,size);
  };
}
