#!/usr/bin/env node
// Preservação de ORIGINAL + DERIVADO em armazenamento local protegido.
// PDF é um artefato BINÁRIO; qualquer pinpoint textual usa bytes do texto extraído,
// obrigatoriamente vinculado ao SHA-256 do PDF (nunca finge ser byte range do PDF).
import {readFile,writeFile,copyFile,mkdir,stat,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TextDecoder} from 'node:util';

const sha=b=>createHash('sha256').update(b).digest('hex');
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const required=(obj,keys)=>{for(const key of keys)if(typeof obj[key]!=='string'||!obj[key].trim())throw Error(`MISSING_${key.toUpperCase()}`);};
const clean=u=>/^(https:\/\/|urn:)/.test(u);
const textDecode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
const typeAllowed=new Set(['FACT','DEFINITION','OBLIGATION','CONDITION','EXCEPTION','INTERPRETATION','EXAMPLE']);

export async function prepareEvidencePair(input){
  required(input,['source_id','source_kind','source_uri','source_version','title','publisher','original_path','extracted_text_path','extractor','extractor_version']);
  if(!['NORMATIVE','EDITORIAL'].includes(input.source_kind))throw Error('SOURCE_KIND_INVALID');
  if(!clean(input.source_uri))throw Error('SOURCE_URI_INVALID');
  if(input.source_kind==='NORMATIVE'&&!input.authority)throw Error('OFFICIAL_AUTHORITY_REQUIRED');
  if(input.source_kind==='EDITORIAL'&&!input.author)throw Error('EDITORIAL_AUTHOR_REQUIRED');
  const original=await readFile(input.original_path),derived=await readFile(input.extracted_text_path);
  if(original.length===0||derived.length===0)throw Error('EMPTY_SOURCE');
  if(input.original_format==='application/pdf'&&!original.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('INVALID_PDF_MAGIC');
  const text=textDecode(derived);if(!text.trim())throw Error('EMPTY_EXTRACTED_TEXT');
  const originalHash=sha(original),derivativeHash=sha(derived);
  if(validHash(input.expected_original_sha256)&&input.expected_original_sha256!==originalHash)throw Error('ORIGINAL_SHA_MISMATCH');
  if(validHash(input.expected_text_sha256)&&input.expected_text_sha256!==derivativeHash)throw Error('EXTRACTED_TEXT_SHA_MISMATCH');
  if(input.original_format==='application/pdf'&&originalHash===derivativeHash)throw Error('PDF_TEXT_NOT_SEPARATE');
  const atoms=[],spans=input.spans||[];
  if(!Array.isArray(spans))throw Error('SPANS_INVALID');
  for(const [i,s] of spans.entries()){
    if(!Number.isSafeInteger(s.start_byte)||!Number.isSafeInteger(s.end_byte)||s.start_byte<0||s.end_byte>s.end_byte||s.end_byte>derived.length||s.start_byte>=s.end_byte)throw Error('ATOM_RANGE_INVALID');
    if(!typeAllowed.has(s.kind))throw Error('ATOM_KIND_INVALID');
    if(!s.locator||typeof s.locator!=='string')throw Error('ATOM_LOCATOR_MISSING');
    const bytes=derived.subarray(s.start_byte,s.end_byte);
    let quote;try{quote=textDecode(bytes)}catch{throw Error('ATOM_SPLITS_UTF8');}
    if(!quote.trim()||Buffer.byteLength(quote,'utf8')!==bytes.length)throw Error('ATOM_SPLITS_UTF8');
    if(s.expected_quote!==undefined&&s.expected_quote!==quote)throw Error('ATOM_QUOTE_MISMATCH');
    atoms.push({id:`ATOM:${input.source_id}:${i+1}`,source_id:input.source_id,kind:s.kind,locator:s.locator,start_byte:s.start_byte,end_byte:s.end_byte,
      quote,slice_sha256:sha(bytes),review_status:'PENDING',semantic_status:'NOT_ASSERTED',original_source_sha256:originalHash,derived_text_sha256:derivativeHash});
  }
  const doc={id:input.source_id,kind:input.source_kind,title:input.title,publisher:input.publisher,
    author:input.author||null,authority:input.authority||null,uri:input.source_uri,version:input.source_version,
    original_sha256:originalHash,sha256:derivativeHash,raw_bytes_base64:derived.toString('base64'),
    storage_kind:'EXTRACTED_TEXT',original_source_sha256:originalHash,extractor:input.extractor,extractor_version:input.extractor_version,
    rights_status:'PENDING',verification_status:'PENDING',rights_evidence_ref:input.rights_evidence_ref||null,
    effective_from:input.effective_from||null,published_on:input.published_on||null,
    original_format:input.original_format||'unknown',extraction_procedure:input.extraction_procedure||null};
  return {original,derived,document:doc,atoms,report:{status:'HOLD_HUMAN',source_id:input.source_id,
    original_sha256:originalHash,extracted_sha256:derivativeHash,atom_candidates:atoms.length,
    claim_count:0,original_bytes:original.length,extracted_bytes:derived.length,
    byte_ranges_refer_to:'EXTRACTED_TEXT_NOT_ORIGINAL_PDF',validated_original_hash:true,rights_verified:false,semantic_reviewed:false}};
}

export async function archiveEvidencePair(input,archiveRoot){
  const prepared=await prepareEvidencePair(input);
  const dir=resolve(archiveRoot),orig=join(dir,'originals',prepared.report.original_sha256),text=join(dir,'extracted',prepared.report.extracted_sha256);
  await mkdir(dirname(orig),{recursive:true,mode:0o700});await mkdir(dirname(text),{recursive:true,mode:0o700});
  // Conteúdo versionado por hash: não sobrescrever se o conteúdo já não for idêntico.
  for(const [path,bytes] of [[orig,prepared.original],[text,prepared.derived]]){
    const existing=await readFile(path).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(existing && sha(existing)!==sha(bytes))throw Error('ARCHIVE_HASH_COLLISION');
    if(!existing)await writeFile(path,bytes,{mode:0o600,flag:'wx'});
    await chmod(path,0o600);
  }
  const graph={schema_version:'canone.evidence-graph.v1',corpus_status:'CANDIDATE_BYTES_PRESERVED',source_documents:[prepared.document],
    atoms:prepared.atoms,claims:[],concepts:[],relations:[],content_projections:[],field_definitions:[],technical_decisions:[]};
  const name=sha(Buffer.from(input.source_id)).slice(0,20),manifest=join(dir,'manifests',name+'.json');
  await mkdir(dirname(manifest),{recursive:true,mode:0o700});
  const safeGraph={...graph,source_documents:[{...prepared.document,raw_bytes_base64:undefined}],atoms:prepared.atoms.map(({quote,...a})=>a)};
  const report={...prepared.report,archive_paths:{original:orig,derived:text},graph_path:join(dir,'private-graphs',name+'.json')};
  await mkdir(join(dir,'private-graphs'),{recursive:true,mode:0o700});
  await writeFile(report.graph_path,JSON.stringify(graph,null,2)+'\n',{mode:0o600});
  await writeFile(manifest,JSON.stringify({report,safe_graph:safeGraph},null,2)+'\n',{mode:0o600});
  return report;
}

const isEntry=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntry){
  const argv=process.argv.slice(2),val=k=>{const i=argv.indexOf(k);return i<0?undefined:argv[i+1]};
  if(!argv.includes('--execute')){console.log('DRY_RUN: --execute --input <private-manifest.json> [--output <private-dir>]');process.exit(0);}
  const inputFile=val('--input');if(!inputFile)throw Error('INPUT_REQUIRED');
  const root=val('--output')||resolve(dirname(fileURLToPath(import.meta.url)),'../../.local-bridge/evidence-archive');
  const input=JSON.parse(await readFile(inputFile,'utf8'));
  const report=await archiveEvidencePair(input,root);
  console.log(JSON.stringify({...report,archive_paths:'PRIVATE_LOCAL_ARTIFACTS',graph_path:'PRIVATE_LOCAL_GRAPH'},null,2));
  process.exitCode=4; // sucesso na preservação NÃO é autorização de publicação
}
