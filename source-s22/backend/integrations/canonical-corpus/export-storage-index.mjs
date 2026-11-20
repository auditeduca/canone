#!/usr/bin/env node
// Consulta de inventário governada: metadados apenas, por 249 fontes de ACCOUNTING_AUDIT.
// Nunca executa DDL/DML, não lê blobs nem publica conteúdo.
import {writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {digest,indexSchema,inspectTriadIndex} from './storage-triad.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const doRun=args.includes('--execute');
const ref='pgsybzggewhinaniybiy';
const output=resolve(process.env.CANONE_ARTIFACT_INDEX_DIR||join(here,'../../.local-bridge/storage-index'));
if(!doRun){console.log(JSON.stringify({status:'DRY_RUN',ref,metadata_only:true,expected_documents:249,output,required_secret:'CANONE_SOURCE_DATABASE_URL'}));process.exit(0);}
const url=process.env.CANONE_SOURCE_DATABASE_URL;
if(!url || !new URL(url).hostname.includes(ref)){
 await rm(join(output,'artifact-index.private.json'),{force:true});
 throw Error('HOLD_SOURCE_DATABASE_REF_AND_CREDENTIAL');
}
const {Client}=await import('pg');
const client=new Client({connectionString:url,application_name:'canone-corpus-triad-index-readonly'});
const activeIndex=join(output,'artifact-index.private.json');
const temporaryIndex=activeIndex+'.'+randomUUID()+'.tmp';
const temporarySummary=join(output,'index-summary.private.json.')+randomUUID()+'.tmp';
// Um único snapshot evita comparar metadados de momentos diferentes.
const sql=`SELECT e.instrument_id,
 e.raw_evidence_id::text AS raw_evidence_id, a.instrument_id AS acquisition_instrument_id,
 a.sha256 AS acquisition_sha256, a.byte_count::bigint AS acquisition_size,
 a.content_type, a.identity_gate, a.normative_text_gate, a.provenance_gate,
 a.gate_status AS acquisition_gate_status, a.promotion_eligible,
 e.publication_mode, e.canonical_promotion,
 a.raw_payload->>'storage_bucket' AS raw_bucket,
 a.raw_payload->>'storage_path' AS raw_path,
 e.raw_sha256, e.raw_byte_count::bigint AS raw_bytes,
 e.text_storage_bucket AS text_bucket,e.text_storage_path AS text_path,e.text_sha256,
 e.mask_storage_bucket AS mask_bucket,e.mask_storage_path AS mask_path,e.mask_sha256,
 r.id::text AS raw_storage_object_id,(r.metadata->>'size')::bigint AS raw_storage_size,
 t.id::text AS text_storage_object_id,(t.metadata->>'size')::bigint AS text_storage_size,
 m.id::text AS mask_storage_object_id,(m.metadata->>'size')::bigint AS mask_storage_size
 FROM account_palm.normative_extractions e
 JOIN account_palm.acquisition_evidence a ON a.evidence_id=e.raw_evidence_id
 LEFT JOIN storage.objects r ON r.bucket_id=a.raw_payload->>'storage_bucket' AND r.name=a.raw_payload->>'storage_path'
 LEFT JOIN storage.objects t ON t.bucket_id=e.text_storage_bucket AND t.name=e.text_storage_path
 LEFT JOIN storage.objects m ON m.bucket_id=e.mask_storage_bucket AND m.name=e.mask_storage_path
 WHERE e.instrument_id LIKE 'CFC-%'
 ORDER BY e.instrument_id`;
try{
 await client.connect();
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const {rows}=await client.query(sql);
 const normalized=rows.map(r=>({instrument_id:r.instrument_id,raw_evidence_id:r.raw_evidence_id,
  acquisition_instrument_id:r.acquisition_instrument_id,acquisition_sha256:r.acquisition_sha256,acquisition_size:Number(r.acquisition_size),
  content_type:r.content_type,identity_gate:r.identity_gate,normative_text_gate:r.normative_text_gate,
  provenance_gate:r.provenance_gate,promotion_eligible:r.promotion_eligible,
  acquisition_gate_status:r.acquisition_gate_status,publication_mode:r.publication_mode,canonical_promotion:r.canonical_promotion,
  original:{bucket:r.raw_bucket,path:r.raw_path,sha256:r.raw_sha256,bytes:Number(r.raw_storage_size),storage_object_id:r.raw_storage_object_id},
  extracted_text:{bucket:r.text_bucket,path:r.text_path,sha256:r.text_sha256,bytes:Number(r.text_storage_size),storage_object_id:r.text_storage_object_id},
  extraction_mask:{bucket:r.mask_bucket,path:r.mask_path,sha256:r.mask_sha256,bytes:Number(r.mask_storage_size),storage_object_id:r.mask_storage_object_id},
 }));
 const inspection=inspectTriadIndex(normalized,{expectedCount:249});
 // Campo size de origem separado, para detectar discrepâncias mesmo se Storage tiver número válido.
 for(const [i,r] of normalized.entries())if(Number(rows[i].raw_bytes)!==r.original.bytes){
   inspection.blockers.push({severity:'P0',code:'EXTRACTION_RAW_SIZE_MISMATCH',instrument_id:r.instrument_id});
 }
 inspection.critical_count=inspection.blockers.length;
 inspection.index_gate=inspection.critical_count?'FAIL':'PASS';
 await client.query('COMMIT');
 await mkdir(output,{recursive:true,mode:0o700});
 const payload={schema:indexSchema,source_project_ref:ref,mode:'READ_ONLY_METADATA_ONLY',exported_at:new Date().toISOString(),
  index_gate:inspection.index_gate,index_sha256:digest(Buffer.from(JSON.stringify(normalized))),rows:normalized};
 // Não gerar índice aproveitável caso a inspeção falhe.
 if(inspection.index_gate!=='PASS'){
   await writeFile(join(output,'index-findings.json'),JSON.stringify(inspection,null,2)+'\n',{mode:0o600});
   throw Error(`INDEX_VALIDATION_FAIL ${inspection.critical_count}`);
 }
 await writeFile(temporaryIndex,JSON.stringify(payload,null,2)+'\n',{flag:'wx',mode:0o600});
 await writeFile(temporarySummary,JSON.stringify(inspection,null,2)+'\n',{flag:'wx',mode:0o600});
 await rename(temporarySummary,join(output,'index-summary.private.json'));
 // Índice validado é o ÚLTIMO artefato promovido para uso pelo recuperador.
 await rename(temporaryIndex,activeIndex);
 console.log(JSON.stringify({status:'INDEX_VALID__BYTES_NOT_VERIFIED',sources:normalized.length,triad_objects:normalized.length*3,
   index_gate:inspection.index_gate,publication_gate:'HOLD_HUMAN',mode:'READ_ONLY',output}));
} catch(e){
 try{await client.query('ROLLBACK');}catch{}
 // Falha de exportação nunca deixa um índice antigo como se fosse o atual.
 await Promise.allSettled([rm(activeIndex,{force:true}),rm(temporaryIndex,{force:true}),rm(temporarySummary,{force:true})]);
 console.error('SOURCE_INDEX_HOLD:',e.message);process.exitCode=2;
}
finally{await client.end().catch(()=>{});}
