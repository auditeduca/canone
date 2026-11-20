import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {digest,archiveVerifiedTriad,indexSchema} from '../storage-triad.mjs';
import {selectPilotRows,pilotPlan,checkSourceIndex,verifyPilotArchives} from '../pilot-gate.mjs';

const payload=id=>[
  Buffer.from(`%PDF-1.7\nfonte sintética ${id}\n`),
  Buffer.from(`texto sintético ${id}\n`),
  Buffer.from(`{"synthetic":true,"id":"${id}"}\n`)
];
const row=(i)=>{
 const id=`CFC-TEST-${String(i).padStart(3,'0')}`;
 const buffers=payload(id);
 const obj=(b,k)=>({bucket:'ingest-private',path:`test/${id}/${k}`,sha256:digest(b),bytes:b.length,storage_object_id:`object-${id}-${k}`});
 return {instrument_id:id,raw_evidence_id:`uuid-${id}`,acquisition_instrument_id:id,
  acquisition_sha256:digest(buffers[0]),acquisition_size:buffers[0].length,content_type:'application/pdf',
  identity_gate:true,provenance_gate:true,normative_text_gate:true,
  canonical_promotion:false,promotion_eligible:false,publication_mode:'INTERNAL_ONLY',acquisition_gate_status:'BLOCKED',
  original:obj(buffers[0],'original'),extracted_text:obj(buffers[1],'text'),extraction_mask:obj(buffers[2],'mask')};
};
const mkIndex=(n=249)=>{
 const rows=Array.from({length:n},(_,i)=>row(i));
 return {schema:indexSchema,source_project_ref:'pgsybzggewhinaniybiy',rows,index_sha256:digest(Buffer.from(JSON.stringify(rows)))};
};
const sandbox=async f=>{const root=await mkdtemp(join(tmpdir(),'canone-v6-'));try{return await f(root);}finally{await rm(root,{recursive:true,force:true});}};

test('piloto estratificado seleciona cinco fontes distintas e determinísticas',()=>{
 const index=mkIndex();const a=pilotPlan(index);
 assert.equal(a.pilot_count,5);assert.equal(a.index_count,249);assert.equal(a.byte_verified,0);
 assert.equal(new Set(a.instruments.map(x=>x.instrument_id)).size,5);
 assert.deepEqual(selectPilotRows(index.rows),selectPilotRows([...index.rows].reverse()));
});
test('inventário e assinatura SHA256 não podem ser modificados silenciosamente',()=>{
 const index=mkIndex(); index.rows[0].original.bytes++;
 assert.throws(()=>checkSourceIndex(index),/SOURCE_INDEX_SHA256_INVALID/);
});
test('alteração de contagem do universo exige revisão, não auto-ajuste',()=>{
 const index=mkIndex(248);
 assert.throws(()=>pilotPlan(index),/SOURCE_INDEX_GATE_FAIL:INVENTORY_COUNT_DRIFT/);
});
test('identificador de aquisição falso bloqueia a seleção',()=>{
 const index=mkIndex();index.rows[1].acquisition_instrument_id='CFC-FAKE';
 index.index_sha256=digest(Buffer.from(JSON.stringify(index.rows)));
 assert.throws(()=>pilotPlan(index),/SOURCE_INDEX_GATE_FAIL:ACQUISITION_INSTRUMENT_MISMATCH/);
});
test('cinco PDFs sintéticos + textos + máscaras autenticados geram gate de bytes em HOLD',()=>sandbox(async root=>{
 const index=mkIndex(),selected=selectPilotRows(index.rows);
 for(const r of selected){
   const blobs=payload(r.instrument_id);
   const fetchObject=async a=>blobs[[r.original,r.extracted_text,r.extraction_mask].indexOf(a)];
   await archiveVerifiedTriad(r,{fetchObject,root});
 }
 const attestation=await verifyPilotArchives(index,root);
 assert.equal(attestation.byte_verified,5);
 assert.equal(attestation.archive_gate,'PASS_BYTES__HOLD_HUMAN');
 assert.equal(attestation.release_gate,'HOLD_HUMAN');
}));
test('piloto não autoriza --all se faltar um dos cinco manifestos',()=>sandbox(async root=>{
 const index=mkIndex();
 await assert.rejects(verifyPilotArchives(index,root),/HOLD_PILOT_MANIFEST_MISSING/);
}));
test('arquivo de PDF alterado é detectado mesmo com manifesto prévio correto',()=>sandbox(async root=>{
 const index=mkIndex(),selected=selectPilotRows(index.rows);
 for(const r of selected){
  const blobs=payload(r.instrument_id);
  await archiveVerifiedTriad(r,{fetchObject:async a=>blobs[[r.original,r.extracted_text,r.extraction_mask].indexOf(a)],root});
 }
 const item=selected[0];
 const path=join(root,'original',item.original.sha256);
 await writeFile(path,Buffer.from('%PDF-1.7\nADULTERADO\n'));
 await assert.rejects(verifyPilotArchives(index,root),/HOLD_PILOT_BLOB_RECHECK_FAILED/);
}));
test('manifesto forjado para aprovar direitos é rejeitado',()=>sandbox(async root=>{
 const index=mkIndex(),selected=selectPilotRows(index.rows);
 for(const r of selected){
  const blobs=payload(r.instrument_id);
  await archiveVerifiedTriad(r,{fetchObject:async a=>blobs[[r.original,r.extracted_text,r.extraction_mask].indexOf(a)],root});
 }
 const path=join(root,'manifests',digest(Buffer.from(selected[0].instrument_id))+'.json');
 const manifest=JSON.parse(await readFile(path,'utf8'));
 manifest.rights_reviewed=true;
 await writeFile(path,JSON.stringify(manifest));
 await assert.rejects(verifyPilotArchives(index,root),/HOLD_PILOT_MANIFEST_INCONSISTENT/);
}));
test('invocação completa sem piloto interrompe antes de qualquer download',()=>sandbox(async root=>{
 const index=mkIndex();const path=join(root,'index.json');await writeFile(path,JSON.stringify(index));
 const file=new URL('../recover-storage-triad.mjs',import.meta.url);
 const result=spawnSync(process.execPath,[file.pathname,'--execute','--index',path,'--all'],{
  env:{...process.env,CANONE_PRIVATE_ARCHIVE_DIR:root,CANONE_SOURCE_STORAGE_API_KEY:'public-test',CANONE_SOURCE_STORAGE_READ_TOKEN:'read-test'},encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/HOLD_PILOT_MANIFEST_MISSING/);
}));

test('exportação sem credencial invalida índice ativo antigo (fail-closed)',()=>sandbox(async root=>{
 const old=join(root,'artifact-index.private.json');await writeFile(old,'UNTRUSTED OLD SNAPSHOT');
 const file=new URL('../export-storage-index.mjs',import.meta.url);
 const env={...process.env,CANONE_ARTIFACT_INDEX_DIR:root};
 delete env.CANONE_SOURCE_DATABASE_URL;
 const out=spawnSync(process.execPath,[file.pathname,'--execute'],{env,encoding:'utf8'});
 assert.notEqual(out.status,0);
 await assert.rejects(readFile(old),/ENOENT/);
}));
test('tentativa de recuperar 249 documentos por --limit sem --all é recusada',()=>sandbox(async root=>{
 const index=mkIndex(); const filePath=join(root,'index.json');await writeFile(filePath,JSON.stringify(index));
 const file=new URL('../recover-storage-triad.mjs',import.meta.url);
 const out=spawnSync(process.execPath,[file.pathname,'--execute','--index',filePath,'--limit','249'],{
  env:{...process.env,CANONE_PRIVATE_ARCHIVE_DIR:root,CANONE_SOURCE_STORAGE_API_KEY:'public-test',CANONE_SOURCE_STORAGE_READ_TOKEN:'read-test'},encoding:'utf8'});
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/PILOT_LIMIT_INVALID__ALL_REQUIRES_ATTESTATION/);
}));
