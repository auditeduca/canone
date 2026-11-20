import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest,inspectTriadIndex,verifyTriadBytes,archiveVerifiedTriad,makePrivateStorageFetcher} from '../storage-triad.mjs';

const blobs=[Buffer.from('%PDF-1.7\nrealistic fixture only\n'),Buffer.from('Norma sintética sem alegações reais\n'),Buffer.from('{"ranges":[[0,10]]}\n')];
const mk=()=>{
 const row={instrument_id:'CFC-NBC-TEST-V1',raw_evidence_id:'a149',acquisition_instrument_id:'CFC-NBC-TEST-V1',
  acquisition_sha256:digest(blobs[0]),acquisition_size:blobs[0].length,content_type:'application/pdf',
  identity_gate:true,provenance_gate:true,normative_text_gate:true,publication_mode:'INTERNAL_ONLY',
  canonical_promotion:false,promotion_eligible:false,acquisition_gate_status:'BLOCKED'};
 [row.original,row.extracted_text,row.extraction_mask]=blobs.map((b,i)=>({bucket:'ingest-private',path:`regulatory/CFC-TEST/file${i}`,
   sha256:digest(b),bytes:b.length,storage_object_id:`storage-${i}`}));
 return row;
};
async function sandbox(f){const d=await mkdtemp(join(tmpdir(),'canone-triad-'));try{return await f(d);}finally{await rm(d,{recursive:true,force:true});}}
const clone=o=>structuredClone(o);

test('índice metadata exato é PASS, mas bytes/release permanecem não aprovados',()=>{
 const r=inspectTriadIndex([mk()],{expectedCount:1});
 assert.equal(r.index_gate,'PASS');assert.equal(r.storage_objects_expected,3);
 assert.equal(r.byte_verified,0);assert.equal(r.publication_gate,'HOLD_HUMAN');
});
test('quarentena detecta inventário incompleto',()=>{
 assert.ok(inspectTriadIndex([mk()],{expectedCount:249}).blockers.some(x=>x.code==='INVENTORY_COUNT_DRIFT'));
});
test('quarentena barra alteração de instrumento em evidência',()=>{
 const v=mk();v.acquisition_instrument_id='CFC-NBC-OTHER';
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code==='ACQUISITION_INSTRUMENT_MISMATCH'));
});
test('quarentena barra divergência de hash declarado por aquisição',()=>{
 const v=mk();v.acquisition_sha256='1'.repeat(64);
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code==='ACQUISITION_SHA_MISMATCH'));
});
test('quarentena barra divergência na contagem de bytes',()=>{
 const v=mk();v.original.bytes++;
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code==='ORIGINAL_STORAGE_SIZE_MISMATCH'));
});
test('quarentena barra objeto ausente no storage',()=>{
 const v=mk();v.extraction_mask.storage_object_id=null;
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code.startsWith('ARTIFACT_REFERENCE_OR_HASH_INVALID')));
});
test('quarentena barra tentativa de publicar o acervo',()=>{
 const v=mk();v.canonical_promotion=true;
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code==='UNEXPECTED_PUBLICATION_STATUS'));
});
test('não permite path traversal ou URL-encoded bytes',()=>{
 const v=mk();v.original.path='../outside';
 assert.equal(inspectTriadIndex([v]).index_gate,'FAIL');
 v.original.path='%2e%2e/outside';assert.equal(inspectTriadIndex([v]).index_gate,'FAIL');
});
test('não aceita fontes fora do escopo CFC',()=>{
 const v=mk();v.instrument_id='CE-NURSING';
 assert.ok(inspectTriadIndex([v]).blockers.some(x=>x.code==='SOURCE_ID_OUT_OF_SCOPE'));
});
test('não aceita ID duplicado',()=>{
 const r=inspectTriadIndex([mk(),mk()]);assert.ok(r.blockers.some(x=>x.code==='DUPLICATE_INSTRUMENT'));
});
test('reconciliação byte a byte das três partes produz apenas HOLD',()=>{
 const r=verifyTriadBytes(mk(),blobs);assert.equal(r.artifacts.length,3);
 assert.equal(r.publication_eligible,false);assert.equal(r.semantic_claims_generated,0);
});
test('original com hash errado é recusado',()=>{
 assert.throws(()=>verifyTriadBytes(mk(),[Buffer.from('%PDF-corrupted'),...blobs.slice(1)]),/ARTIFACT_BYTES_LENGTH_MISMATCH|ARTIFACT_SHA256_MISMATCH/);
});
test('texto derivado diferente é recusado mesmo que o PDF esteja correto',()=>{
 const tampered=Buffer.from(blobs[1]);tampered[5]=0x58;
 assert.throws(()=>verifyTriadBytes(mk(),[blobs[0],tampered,blobs[2]]),/ARTIFACT_SHA256_MISMATCH/);
});
test('PDF não correspondente é recusado mesmo se metadados/hash forem novos',()=>{
 const v=mk(),wrong=Buffer.from('text-and-not-pdf');v.original.sha256=digest(wrong);v.original.bytes=wrong.length;
 v.acquisition_sha256=v.original.sha256;v.acquisition_size=v.original.bytes;
 assert.throws(()=>verifyTriadBytes(v,[wrong,blobs[1],blobs[2]]),/SOURCE_PDF_MAGIC_INVALID/);
});
test('texto com bytes inválidos UTF8 é recusado',()=>{
 const v=mk(),wrong=Buffer.from([0xff,0xfe,0x61]);v.extracted_text.sha256=digest(wrong);v.extracted_text.bytes=wrong.length;
 assert.throws(()=>verifyTriadBytes(v,[blobs[0],wrong,blobs[2]]),/fatal|UTF-8|encoding|encoded/i);
});
test('arquivo preservado é conteúdo endereçado por SHA e 0600, sem claims',()=>sandbox(async root=>{
 const v=mk(),fetchObject=async obj=>Buffer.from(blobs[[v.original,v.extracted_text,v.extraction_mask].indexOf(obj)]);
 const result=await archiveVerifiedTriad(v,{fetchObject,root});assert.equal(result.release_status,'HOLD_HUMAN');assert.equal(result.claims.length,0);
 const source=join(root,'original',v.original.sha256),a=await readFile(source),mode=(await stat(source)).mode&0o777;
 assert.deepEqual(a,blobs[0]);assert.equal(mode,0o600);
 const again=await archiveVerifiedTriad(v,{fetchObject,root});assert.equal(again.artifacts.length,3);
}));
test('falha em uma parte nunca cria manifesto aprovado ou arquivos parciais',()=>sandbox(async root=>{
 const v=mk(),fetchObject=async obj=>obj===v.extraction_mask?Buffer.from('bad mask'):blobs[[v.original,v.extracted_text,v.extraction_mask].indexOf(obj)];
 await assert.rejects(archiveVerifiedTriad(v,{fetchObject,root}),/ARTIFACT_BYTES_LENGTH_MISMATCH|ARTIFACT_SHA256_MISMATCH/);
 await assert.rejects(readFile(join(root,'manifests',digest(Buffer.from(v.instrument_id))+'.json')),/ENOENT/);
}));
test('fetcher exige API key e sessão de leitura, sem fallback admin',()=>{
 assert.throws(()=>makePrivateStorageFetcher({projectRef:'pgsybzggewhinaniybiy',apiKey:'abc'}),/CREDENTIALS_REQUIRED/);
});
test('fetcher valida URL do servidor e usa rota autenticada, não URL arbitrária',async()=>{
 const v=mk(),call=[];const fetchObject=makePrivateStorageFetcher({projectRef:'pgsybzggewhinaniybiy',apiKey:'key',accessToken:'token',
  fetchImpl:async(url,opts)=>{call.push({url,opts});return new Response(blobs[0],{status:200});}});
 assert.deepEqual(await fetchObject(v.original),blobs[0]);
 assert.match(call[0].url,/https:\/\/pgsybzggewhinaniybiy\.supabase\.co\/storage\/v1\/object\/authenticated\/ingest-private/);
 assert.equal(call[0].opts.headers.Authorization,'Bearer token');
});
test('fetcher recusa redirecionamento ou HTTP de acesso negado',async()=>{
 const v=mk();const fetchObject=makePrivateStorageFetcher({projectRef:'pgsybzggewhinaniybiy',apiKey:'key',accessToken:'token',
  fetchImpl:async()=>new Response('unauthorized',{status:403})});
 await assert.rejects(fetchObject(v.original),/STORAGE_HTTP_403/);
});
test('fetcher recusa limite de bytes declarado',async()=>{
 const v=mk();const fetchObject=makePrivateStorageFetcher({projectRef:'pgsybzggewhinaniybiy',apiKey:'key',accessToken:'token',
  maxBytes:4,fetchImpl:async()=>new Response('abc',{status:200})});
 await assert.rejects(fetchObject(v.original),/LIMIT_INVALID/);
});
