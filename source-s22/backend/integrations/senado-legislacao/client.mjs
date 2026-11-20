/**
 * Senado Dados Abertos — read-only, candidate-only adapter.
 * Docs: https://legis.senado.leg.br/dadosabertos/docs/index.html
 * No bytes, claims, or official publication status are assumed from a successful HTTP response.
 */
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, rm, chmod} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const BASE_URL = 'https://legis.senado.leg.br/dadosabertos/';
export const PRIVATE_SENADO_DIR=fileURLToPath(new URL('../../.local-bridge/senado/',import.meta.url));
const MAX_PAYLOAD_BYTES = 2_000_000;

export function validateCatalog(catalog) {
  if (catalog?.schema !== 'canone.senado-legislacao.catalog.v1') throw new Error('INVALID_CATALOG_SCHEMA');
  if (!Array.isArray(catalog.acts) || !catalog.acts.length) throw new Error('CATALOG_EMPTY');
  const keys = new Set();
  for (const a of catalog.acts) {
    if (!/^BR-FED-(LEI|DL)-[1-9][0-9]*-[12][0-9]{3}$/.test(a.key) || !['LEI','DECRETO-LEI'].includes(a.kind) ||
      !Number.isSafeInteger(a.number) || a.number < 1 || !Number.isInteger(a.year) || a.year < 1800 || a.year > 2100 ||
      a.canonical_promotion !== false || !/^https:\/\/legis\.senado\.leg\.br\/norma\//.test(a.senado_page)) throw new Error('INVALID_ACT');
    if (a.key !== `BR-FED-${a.kind==='DECRETO-LEI'?'DL':'LEI'}-${a.number}-${a.year}`) throw new Error('CATALOG_IDENTITY_MISMATCH');
    if (keys.has(a.key)) throw new Error('DUPLICATE_ACT');
    keys.add(a.key);
  }
  for (const rel of catalog.relationship_candidates || []) {
    if (!keys.has(rel.from) || !keys.has(rel.to)) throw new Error('ORPHAN_RELATION');
    if (rel.relation !== 'AMENDS' || rel.atom_verified !== false || rel.status !== 'HOLD_ATOMIZATION') throw new Error('UNAPPROVED_RELATION');
  }
  for (const candidate of catalog.device_scope_candidates || []) {
    if (!keys.has(candidate.from) || !keys.has(candidate.to) ||
        !catalog.relationship_candidates.some(r=>r.from===candidate.from&&r.to===candidate.to) ||
        !['HOLD_SOURCE_ATOMIZATION'].includes(candidate.status) || candidate.atom_verified!==false ||
        !['SENADO_HTML_METADATA','SENADO_HTML_PUBLISHED_TEXT'].includes(candidate.evidence_kind) ||
        !Array.isArray(candidate.target_units) || !candidate.target_units.length ||
        !candidate.target_units.every(u=>/^art\.[0-9]+(?:-[A-Z])?(?:\.(?:par[0-9]+|caput\.[a-z]))?$/.test(u)) ||
        new Set(candidate.target_units).size !== candidate.target_units.length ||
        !catalog.acts.some(a=>a.key===candidate.from&&a.senado_page===candidate.evidence_page))
      throw new Error('INVALID_ARTICLE_SCOPE_CANDIDATE');
  }
  if (catalog.publication_eligible !== false) throw new Error('UNSAFE_PUBLICATION');
  return true;
}

export function buildSenadoListUrl({number,year}) {
  if (!Number.isSafeInteger(number) || number < 1 || !Number.isInteger(year) || year < 1800 || year > 2100) throw new Error('INVALID_NORMA_IDENTITY');
  const u = new URL('legislacao/lista.json', BASE_URL);
  u.searchParams.set('numero', String(number));
  u.searchParams.set('ano', String(year));
  return u.href;
}

export function sha256(bytes) {return createHash('sha256').update(bytes).digest('hex');}

export async function requestSenadoJson(url,{fetchImpl=fetch,timeoutMs=12000}={}) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'legis.senado.leg.br' || !u.pathname.startsWith('/dadosabertos/legislacao/')) throw new Error('BLOCK_UNTRUSTED_ENDPOINT');
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetchImpl(u.href,{method:'GET',headers:{Accept:'application/json','User-Agent':'Canone-Normative-Registry/0.1'},redirect:'error',signal});
  if (!response.ok) throw new Error(`SENADO_HTTP_${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/\b(json|javascript)\b/i.test(contentType)) throw new Error('SENADO_NON_JSON_RESPONSE');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_PAYLOAD_BYTES) throw new Error('SENADO_PAYLOAD_TOO_LARGE');
  const stream = response.body;
  if (!stream) throw new Error('SENADO_EMPTY_BODY');
  const reader = stream.getReader();
  const chunks=[]; let size=0;
  try {
    while(true) {
      const {done,value} = await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size > MAX_PAYLOAD_BYTES) throw new Error('SENADO_PAYLOAD_TOO_LARGE');
      chunks.push(value);
    }
  } finally {await reader.cancel().catch(()=>{});}
  const raw=Buffer.concat(chunks.map(c=>Buffer.from(c)),size);
  let parsed;
  try {parsed=JSON.parse(raw.toString('utf8'));} catch {throw new Error('SENADO_INVALID_JSON');}
  if (!parsed || typeof parsed !== 'object') throw new Error('SENADO_INVALID_JSON');
  // Preserve the exact HTTP entity bytes. Re-serializing parsed JSON would invalidate provenance.
  return {source_url:u.href,response_sha256:sha256(raw),response_size:raw.length,raw_bytes:raw,body:parsed,
    retrieved_at:new Date().toISOString(),http_status:response.status,
    etag:response.headers.get('etag')||null,last_modified:response.headers.get('last-modified')||null};
}

function normalizedNumber(v) {
  const n = Number(String(v).replace(/\./g,''));
  return Number.isSafeInteger(n)?n:null;
}
// The API schema has not been live-tested here. This probes possible nested fields and
// NEVER treats a match as a legal/semantic proof or a publication approval.
export function inspectIdentityCandidate(body,{number,year}) {
  let exact=0, mismatched=0, pairs=0;
  function recurse(node,depth=0) {
    if (depth>20 || pairs>8000 || !node || typeof node!=='object') return;
    if (Array.isArray(node)) {for(const sub of node.slice(0,1500)) recurse(sub,depth+1);return;}
    pairs++;
    let num=null,yr=null;
    for(const [k,v] of Object.entries(node)) {
      if (v!=null && typeof v!=='object') {
        if (/^(?:numero|numeroNorma|numeroDocumento|numeroNormaJuridica)$/i.test(k)) num=normalizedNumber(v);
        if (/^(?:ano|anoNorma|anoDocumento|anoNormaJuridica)$/i.test(k)) yr=normalizedNumber(v);
      }
    }
    if(num!=null && yr!=null) {if(num===number&&yr===year) exact++;else mismatched++;}
    for(const v of Object.values(node)) if (v && typeof v==='object') recurse(v,depth+1);
  }
  recurse(body);
  const status=exact===0?'HOLD_SCHEMA_OR_IDENTITY':(exact===1&&mismatched===0?'API_IDENTITY_CANDIDATE__HOLD_HUMAN':'HOLD_AMBIGUOUS_RECORDS');
  return {matched_field_pairs:exact,other_field_pairs:mismatched,status};
}

export function buildCandidate(act,observation) {
  const identity=inspectIdentityCandidate(observation.body,act);
  return {
    source_id:act.key,source_kind:'NORMATIVE_LEGISLATIVE_CANDIDATE',provider:'SENADO_FEDERAL',
    expected_number:act.number,expected_year:act.year,expected_kind:act.kind,
    senate_page:act.senado_page,source_url:observation.source_url,
    response_sha256:observation.response_sha256,response_size:observation.response_size,
    retrieved_at:observation.retrieved_at,http_status:observation.http_status,
    etag:observation.etag,last_modified:observation.last_modified,
    ...identity,fulltext_atomized:false,canonical_promotion:false,publication_eligible:false,
    requires:['DOU_ORIGINAL','LEGAL_VALIDITY_AT_REFERENCE_DATE','VERSION_EVIDENCE','ATOMS','EDITORIAL_REVIEW']
  };
}

async function atomicWritePrivate(filename,data) {
  await mkdir(dirname(filename),{recursive:true,mode:0o700});
  const temporary=`${filename}.tmp-${process.pid}`;
  await writeFile(temporary,data,{mode:0o600,flag:'wx'});
  try {await rename(temporary,filename);await chmod(filename,0o600);} catch(e){await rm(temporary,{force:true});throw e;}
}

export async function collectSenado(catalog,{execute=false,fetchImpl=fetch,dir=PRIVATE_SENADO_DIR,requestedKeys}={}) {
  validateCatalog(catalog);
  const selected=catalog.acts.filter(a=>!requestedKeys || requestedKeys.includes(a.key));
  if(!selected.length || (requestedKeys && selected.length!==requestedKeys.length)) throw new Error('UNKNOWN_OR_DUPLICATE_ACT');
  const planned=selected.map(a=>({key:a.key,url:buildSenadoListUrl(a)}));
  if(!execute) return {state:'DRY_RUN_NOT_FETCHED',planned,publication_eligible:false};
  // Invalidate a previously successful intake before any new network attempt.
  // Raw source responses are preserved privately unless explicitly replaced by a complete successful run.
  await rm(join(dir,'intake.private.json'),{force:true});
  await rm(join(dir,'responses.private.json'),{force:true});
  const responses=[];const candidates=[];
  // Download each official response into process memory, validating before any success manifest.
  for(const act of selected) {
    const result=await requestSenadoJson(buildSenadoListUrl(act),{fetchImpl});
    const relative=`raw/${act.key}.${result.response_sha256}.json`;
    responses.push({key:act.key,raw_artifact_path:relative,raw_sha256:result.response_sha256,
      raw_byte_count:result.response_size,source_url:result.source_url,raw_bytes:result.raw_bytes});
    candidates.push({...buildCandidate(act,result),raw_artifact_path:relative});
  }
  const run={schema:'canone.senado.readonly.intake.v2',state:'FETCHED_CANDIDATES__HOLD_HUMAN',
    source:'https://legis.senado.leg.br/dadosabertos/',observations:candidates,
    candidate_relationships:catalog.relationship_candidates.filter(r=>selected.some(a=>a.key===r.from)&&selected.some(a=>a.key===r.to)),
    publication_eligible:false};
  // Commit original response bytes first; only the final intake manifest marks the set complete.
  // All artifacts live in ignored private storage, never in the Git tree or frontend.
  try {
    for(const item of responses) await atomicWritePrivate(join(dir,item.raw_artifact_path),item.raw_bytes);
    await atomicWritePrivate(join(dir,'responses.private.json'),JSON.stringify(responses.map(({raw_bytes,...metadata})=>metadata),null,2)+'\n');
    await atomicWritePrivate(join(dir,'intake.private.json'),JSON.stringify(run,null,2)+'\n');
  } catch(e) {await rm(join(dir,'intake.private.json'),{force:true});throw e;}
  return {state:run.state,observations:candidates,publication_eligible:false};
}

/** Read-back of exact original API bytes, not JSON reserialized by an application. */
export async function verifySenadoArchive(catalog,{dir=PRIVATE_SENADO_DIR}={}) {
  validateCatalog(catalog);
  const manifest=JSON.parse(await readFile(join(dir,'intake.private.json'),'utf8'));
  if(manifest.schema!=='canone.senado.readonly.intake.v2' || manifest.state!=='FETCHED_CANDIDATES__HOLD_HUMAN' ||
     manifest.publication_eligible!==false || !Array.isArray(manifest.observations) || !manifest.observations.length) throw new Error('INVALID_ARCHIVE_MANIFEST');
  const registry=new Map(catalog.acts.map(a=>[a.key,a]));
  const seen=new Set(); const verified=[];
  for(const candidate of manifest.observations) {
    const act=registry.get(candidate.source_id);
    if(!act || seen.has(act.key) || candidate.canonical_promotion!==false || candidate.publication_eligible!==false ||
       candidate.fulltext_atomized!==false || candidate.expected_number!==act.number || candidate.expected_year!==act.year ||
       candidate.expected_kind!==act.kind || candidate.senate_page!==act.senado_page ||
       candidate.provider!=='SENADO_FEDERAL' || candidate.source_kind!=='NORMATIVE_LEGISLATIVE_CANDIDATE' ||
       candidate.http_status!==200 || !Number.isFinite(Date.parse(candidate.retrieved_at))) throw new Error('INVALID_ARCHIVE_CANDIDATE');
    seen.add(act.key);
    if(!/^[a-f0-9]{64}$/.test(candidate.response_sha256) ||
       !Number.isSafeInteger(candidate.response_size) || candidate.response_size<1 || candidate.response_size>MAX_PAYLOAD_BYTES ||
       candidate.source_url!==buildSenadoListUrl(act)) throw new Error('INVALID_ARCHIVE_PROVENANCE');
    const expected=`raw/${act.key}.${candidate.response_sha256}.json`;
    if(candidate.raw_artifact_path!==expected) throw new Error('UNSAFE_ARCHIVE_PATH');
    const raw=await readFile(join(dir,expected));
    if(raw.length!==candidate.response_size || sha256(raw)!==candidate.response_sha256) throw new Error('ARCHIVE_SHA256_MISMATCH');
    let parsed; try {parsed=JSON.parse(raw.toString('utf8'));}catch{throw new Error('ARCHIVE_INVALID_JSON');}
    const identity=inspectIdentityCandidate(parsed,act);
    if(identity.matched_field_pairs!==candidate.matched_field_pairs ||
       identity.other_field_pairs!==candidate.other_field_pairs ||identity.status!==candidate.status) throw new Error('ARCHIVE_IDENTITY_DRIFT');
    verified.push({source_id:act.key,raw_sha256:candidate.response_sha256,raw_size:raw.length,status:identity.status});
  }
  return {state:'ARCHIVE_BYTES_VERIFIED__HOLD_LEGAL_REVIEW',count:verified.length,verified,publication_eligible:false};
}
