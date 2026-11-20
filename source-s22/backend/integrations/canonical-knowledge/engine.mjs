// Cânone: evidence-first, normative/editorial dual root, fail-closed.
// This is NOT a content generator: no semantic claim exists without a real literal evidence span.
import {createHash} from 'node:crypto';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])) : value;
export const canonicalJSON = obj => JSON.stringify(sorted(obj),null,2)+'\n';
const validHash = s => typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
const unique = values => new Set(values).size===values.length;
const present = s => typeof s==='string' && s.trim().length>0;
const enumSet = (contract,field) => new Set(contract[field]);
const findings = (list,code,ref='',severity='P0') => list.push({code,ref,severity});

export function validateEvidenceGraph(graph,contract,{requireForRelease=true}={}) {
  const out=[];
  if(graph.schema_version!==contract.schema_version)findings(out,'CONTRACT_VERSION_DRIFT');
  const sections=['source_documents','atoms','claims','concepts','relations','content_projections','field_definitions','technical_decisions'];
  for(const s of sections)if(!Array.isArray(graph[s]))findings(out,'SECTION_MISSING',s);
  if(out.length)return result(out,graph);
  const docs=new Map(),atoms=new Map(),claims=new Map(),concepts=new Map(),decisions=new Map();
  const checkedId=(list,key,lookup,kind)=>{for(const x of list){if(!present(x[key])){findings(out,'MISSING_ID',kind);continue;}if(lookup.has(x[key]))findings(out,'DUPLICATE_ID',`${kind}:${x[key]}`);else lookup.set(x[key],x);}};
  checkedId(graph.source_documents,'id',docs,'SOURCE');
  checkedId(graph.atoms,'id',atoms,'ATOM');
  checkedId(graph.claims,'id',claims,'CLAIM');
  checkedId(graph.concepts,'id',concepts,'CONCEPT');
  checkedId(graph.technical_decisions,'id',decisions,'DECISION');
  const distinctSources=new Set();
  for(const s of graph.source_documents){
    const scopeKey=[s.kind,s.uri,s.version,s.sha256].join('|');
    if(distinctSources.has(scopeKey))findings(out,'DUPLICATE_SOURCE_VERSION',s.id);
    distinctSources.add(scopeKey);
    const at=`SOURCE:${s.id}`;
    if(!enumSet(contract,'source_kinds').has(s.kind))findings(out,'SOURCE_KIND',at);
    if(!present(s.version)||!present(s.title)||!present(s.publisher)||!present(s.uri))findings(out,'SOURCE_IDENTITY_INCOMPLETE',at);
    if(!validHash(s.sha256))findings(out,'SOURCE_HASH_MISSING',at);
    // PDF/HTML original e a extração textual são artefatos diferentes.
    // O byte offset de um átomo textual NUNCA pode afirmar que é byte offset do PDF.
    if(s.storage_kind==='EXTRACTED_TEXT'){
      if(!validHash(s.original_source_sha256)||!present(s.extractor)||!present(s.extractor_version))findings(out,'EXTRACTED_TEXT_WITHOUT_ORIGINAL_LINEAGE',at);
      if(s.original_source_sha256===s.sha256)findings(out,'EXTRACTED_TEXT_NOT_SEPARATE_FROM_ORIGINAL',at);
    }
    if(s.storage_kind==='ORIGINAL_PDF'&&graph.atoms.some(a=>a.source_id===s.id))findings(out,'PDF_BYTES_CANNOT_BE_USED_AS_TEXT_PINPOINT',at);

    if(!present(s.rights_status)||!present(s.rights_evidence_ref))findings(out,'SOURCE_RIGHTS_UNPROVEN',at,'P1');
    if(s.kind==='NORMATIVE' && (!present(s.authority)||!present(s.effective_from)))findings(out,'OFFICIAL_VERSION_UNPROVEN',at,'P1');
    if(s.kind==='EDITORIAL' && (!present(s.author)||!present(s.published_on)))findings(out,'EDITORIAL_AUTHORSHIP_UNPROVEN',at,'P1');
    // If a preserved evidence artifact is available, verify the supplied bytes, not a claimed hash alone.
    if(!present(s.raw_bytes_base64)){findings(out,'SOURCE_BYTES_NOT_PRESERVED',at,'P1');continue;}
    const raw=Buffer.from(s.raw_bytes_base64,'base64');
    if(raw.toString('base64').replace(/=+$/,'')!==s.raw_bytes_base64.replace(/=+$/,''))findings(out,'INVALID_BASE64',at);
    if(digest(raw)!==s.sha256)findings(out,'SOURCE_HASH_MISMATCH',at);
  }
  for(const a of graph.atoms){
    const at=`ATOM:${a.id}`;
    if(!enumSet(contract,'atom_kinds').has(a.kind))findings(out,'ATOM_KIND',at);
    const source=docs.get(a.source_id);
    if(!source){findings(out,'ATOM_SOURCE_ORPHAN',at);continue;}
    if(!Number.isSafeInteger(a.start_byte)||!Number.isSafeInteger(a.end_byte)||a.start_byte<0||a.end_byte<=a.start_byte){findings(out,'ATOM_RANGE_INVALID',at);continue;}
    if(!present(source.raw_bytes_base64)){findings(out,'ATOM_UNVERIFIABLE_NO_SOURCE_BYTES',at,'P1');continue;}
    const raw=Buffer.from(source.raw_bytes_base64,'base64');
    if(a.end_byte>raw.length){findings(out,'ATOM_OUT_OF_BOUNDS',at);continue;}
    const segment=raw.subarray(a.start_byte,a.end_byte);
    if(!validHash(a.slice_sha256)||digest(segment)!==a.slice_sha256)findings(out,'ATOM_SLICE_HASH_MISMATCH',at);
    // Roundtrip guarantees byte-exact UTF-8 for quote (no OCR-derived or normalized quote substituted).
    if(!present(a.quote)||a.quote!==segment.toString('utf8')||!Buffer.from(a.quote,'utf8').equals(segment))findings(out,'ATOM_QUOTE_NOT_LITERAL',at);
    if(a.review_status!=='REVIEWED')findings(out,'ATOM_REVIEW_PENDING',at,'P1');
  }
  for(const c of graph.claims){
    const at=`CLAIM:${c.id}`;
    if(!enumSet(contract,'claim_kinds').has(c.kind))findings(out,'CLAIM_KIND',at);
    if(!present(c.text)||!Array.isArray(c.atom_ids)||c.atom_ids.length===0)findings(out,'CLAIM_WITHOUT_ATOMS',at);
    const grounded=[];
    for(const id of c.atom_ids||[]){const a=atoms.get(id);if(!a)findings(out,'CLAIM_ATOM_ORPHAN',`${at}:${id}`);else grounded.push(docs.get(a.source_id)?.kind);}
    if(!unique(c.atom_ids||[]))findings(out,'CLAIM_DUPLICATE_ATOM',at);
    if(['NORMATIVE','MIXED'].includes(c.kind)&&!grounded.includes('NORMATIVE'))findings(out,'NORMATIVE_CLAIM_WITHOUT_NORMATIVE_ROOT',at);
    if(['EDITORIAL','MIXED'].includes(c.kind)&&!grounded.includes('EDITORIAL'))findings(out,'EDITORIAL_CLAIM_WITHOUT_EDITORIAL_ROOT',at);
    if(c.kind==='EDITORIAL'&&c.asserts_normative_requirement===true)findings(out,'EDITORIAL_CANNOT_CREATE_NORM',at);
    if(c.review_status!=='REVIEWED')findings(out,'CLAIM_REVIEW_PENDING',at,'P1');
  }
  for(const c of graph.concepts){
    const at=`CONCEPT:${c.id}`;
    if(!present(c.key)||!present(c.label)||!Array.isArray(c.claim_ids)||!c.claim_ids.length)findings(out,'CONCEPT_WITHOUT_CLAIMS',at);
    for(const id of c.claim_ids||[])if(!claims.has(id))findings(out,'CONCEPT_CLAIM_ORPHAN',`${at}:${id}`);
    if(c.review_status!=='REVIEWED')findings(out,'CONCEPT_REVIEW_PENDING',at,'P1');
  }
  const conceptKeys=graph.concepts.map(x=>x.key);
  if(!unique(conceptKeys))findings(out,'DUPLICATE_CANONICAL_CONCEPT_KEY');
  const relationKinds=enumSet(contract,'relation_kinds');
  const relationKeys=new Set(),supersedes=[];
  for(const r of graph.relations){
    const ref=`RELATION:${r.from}->${r.to}`;
    if(!relationKinds.has(r.kind))findings(out,'RELATION_KIND',ref);
    if(!claims.has(r.from)&&!concepts.has(r.from))findings(out,'RELATION_SOURCE_ORPHAN',ref);
    if(!claims.has(r.to)&&!concepts.has(r.to))findings(out,'RELATION_TARGET_ORPHAN',ref);
    if(r.from===r.to)findings(out,'RELATION_SELF',ref);
    const key=`${r.from}|${r.kind}|${r.to}`;
    if(relationKeys.has(key))findings(out,'RELATION_DUPLICATE',ref);
    relationKeys.add(key);
    if(!Array.isArray(r.evidence_atom_ids)||!r.evidence_atom_ids.length)findings(out,'RELATION_UNGROUNDED',ref);
    for(const id of r.evidence_atom_ids||[])if(!atoms.has(id))findings(out,'RELATION_ATOM_ORPHAN',`${ref}:${id}`);
    if(r.kind==='SUPERSEDES')supersedes.push(r);
    if(r.kind==='CONTRADICTS' && !present(r.resolution_status))findings(out,'CONTRADICTION_UNRESOLVED',ref,'P1');
  }
  // Supersession graph must be acyclic; unpublished stale descendants cannot be silently trusted.
  const adj=new Map();for(const r of supersedes){if(!adj.has(r.from))adj.set(r.from,[]);adj.get(r.from).push(r.to);}
  const active=new Set(),done=new Set();
  function visit(id){if(active.has(id)){findings(out,'SUPERSESSION_CYCLE',id);return;}if(done.has(id))return;active.add(id);for(const to of adj.get(id)||[])visit(to);active.delete(id);done.add(id);}
  for(const id of adj.keys())visit(id);
  const projectionIds=new Set();
  for(const p of graph.content_projections){
    const ref=`PROJECTION:${p.id}`;
    if(!present(p.id)||projectionIds.has(p.id))findings(out,'PROJECTION_ID_DUPLICATE_OR_MISSING',ref);
    projectionIds.add(p.id);
    if(!contract.existing_canone_targets.includes(p.target_table))findings(out,'TARGET_NOT_CANONICAL',ref);
    if(!Array.isArray(p.claim_ids)||!p.claim_ids.length)findings(out,'PROJECTION_UNGROUNDED',ref);
    for(const id of p.claim_ids||[])if(!claims.has(id))findings(out,'PROJECTION_CLAIM_ORPHAN',`${ref}:${id}`);
    if(p.publication_state==='PUBLISHED'){
      if(p.review_status!=='REVIEWED'||p.approval_ref===undefined||!present(p.approval_ref))findings(out,'UNREVIEWED_PUBLICATION',ref);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.validity_checked_on||''))findings(out,'PUBLICATION_WITHOUT_VALIDITY_REVIEW_DATE',ref);
      if(!present(p.target_version_id))findings(out,'PUBLICATION_WITHOUT_TARGET_VERSION',ref);
      for(const id of p.claim_ids||[]){const c=claims.get(id);if(c?.review_status!=='REVIEWED')findings(out,'PUBLICATION_FROM_PENDING_CLAIM',ref);}
      for(const id of p.claim_ids||[])for(const atomId of claims.get(id)?.atom_ids||[]){
        const atom=atoms.get(atomId),source=atom?docs.get(atom.source_id):undefined;
        if(atom?.review_status!=='REVIEWED'||source?.rights_status!=='CLEARED'||source?.verification_status!=='VERIFIED')findings(out,'PUBLICATION_UNVERIFIED_EVIDENCE',ref);
        if(source?.kind==='NORMATIVE'&&p.validity_checked_on&&(source.effective_from > p.validity_checked_on || (source.effective_to && source.effective_to < p.validity_checked_on)))findings(out,'PUBLICATION_OUTSIDE_NORMATIVE_VALIDITY',ref);
      }
      if(supersedes.some(r=>(p.claim_ids||[]).includes(r.to)))findings(out,'PUBLICATION_FROM_SUPERSEDED_CLAIM',ref);
    }
    if(!['HOLD_HUMAN','PUBLISHED','RETIRED'].includes(p.publication_state))findings(out,'PROJECTION_STATE',ref);
  }
  const fieldKeys=new Set();
  for(const f of graph.field_definitions){
    const ref=`FIELD:${f.target_table}.${f.key}`;
    if(!contract.existing_canone_targets.includes(f.target_table))findings(out,'FIELD_TARGET_INVALID',ref);
    if(!present(f.key)||fieldKeys.has(ref))findings(out,'FIELD_DUPLICATE_OR_MISSING',ref);
    fieldKeys.add(ref);
    if(!['texto','texto_longo','inteiro','decimal','booleano','data','data_hora','enumeracao','referencia','json','slug'].includes(f.data_kind))findings(out,'FIELD_KIND_INVALID',ref);
    const sourceClaims=Array.isArray(f.claim_ids)?f.claim_ids:[];
    if(sourceClaims.length===0 && !present(f.technical_decision_id))findings(out,'FIELD_WITHOUT_PROVENANCE',ref);
    for(const id of sourceClaims)if(!claims.has(id))findings(out,'FIELD_CLAIM_ORPHAN',`${ref}:${id}`);
    if(f.technical_decision_id&&!decisions.has(f.technical_decision_id))findings(out,'FIELD_DECISION_ORPHAN',ref);
  }
  for(const d of graph.technical_decisions)if(!present(d.adr_ref)||!present(d.reason))findings(out,'TECHNICAL_DECISION_UNDOCUMENTED',d.id);
  if(requireForRelease && !graph.source_documents.length)findings(out,'CANONICAL_CORPUS_EMPTY','source_documents','P1');
  return result(out,graph);
}
function result(items,graph){
  const p0=items.filter(x=>x.severity==='P0');
  const p1=items.filter(x=>x.severity==='P1');
  const release=p0.length===0 && p1.length===0 && graph.source_documents?.length>0 && graph.content_projections?.some(x=>x.publication_state==='PUBLISHED');
  return {integrity_gate:p0.length?'FAIL':'PASS',release_gate:release?'ELIGIBLE_FOR_EXTERNAL_APPROVAL':'HOLD_HUMAN',structural_errors:p0.length,release_blockers:p1.length,findings:items,metrics:{sources:graph.source_documents?.length||0,atoms:graph.atoms?.length||0,claims:graph.claims?.length||0,concepts:graph.concepts?.length||0,relations:graph.relations?.length||0,projections:graph.content_projections?.length||0,fields:graph.field_definitions?.length||0}};
}

export function deriveArtifacts(graph,contract){
  const report=validateEvidenceGraph(graph,contract);
  if(report.integrity_gate!=='PASS')throw new Error('CANONICAL_GRAPH_INVALID '+report.findings.filter(f=>f.severity==='P0').map(f=>f.code).join(','));
  // Export only reference metadata. Raw archived documents and literal text remain in the secure corpus, never in generated Git files.
  const safeGraph={...graph,source_documents:graph.source_documents.map(({raw_bytes_base64,...s})=>({...s,raw_archived:true})),atoms:graph.atoms.map(({quote,...a})=>({...a,quote_archived:true})),claims:graph.claims.map(({text,...c})=>({...c,statement_archived:true}))};
  const root = {schema_version:contract.schema_version,content_authority:'PRESERVED_SOURCE',normative_priority:true,editorial_is_independent_evidence_not_normative_substitute:true,graph:safeGraph};
  const dictionary=[['canonical_term','label','claim_id','source_document_id','source_kind','version','atom_locator','publication_status']];
  const docIndex=new Map(graph.source_documents.map(x=>[x.id,x])),atomIndex=new Map(graph.atoms.map(x=>[x.id,x])), claimIndex=new Map(graph.claims.map(x=>[x.id,x]));
  for(const c of graph.concepts){for(const id of c.claim_ids){const claim=claimIndex.get(id);for(const atomId of claim.atom_ids){const a=atomIndex.get(atomId),s=docIndex.get(a.source_id);dictionary.push([c.key,c.label,id,s.id,s.kind,s.version,`${a.start_byte}:${a.end_byte}`,c.review_status]);}}}
  const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const fieldDictionary=[['target_table','field_key','data_kind','claim_ids','technical_decision_id','provenance_state']];
  for(const f of graph.field_definitions)fieldDictionary.push([f.target_table,f.key,f.data_kind,(f.claim_ids||[]).join('|'),f.technical_decision_id||'',(f.claim_ids||[]).length?'CLAIM_DERIVED':'ADR_DERIVED']);
  const vocabulary=graph.concepts.map(c=>({key:c.key,label:c.label,claim_ids:c.claim_ids,review_status:c.review_status}));
  const generatedContract={schema_version:contract.schema_version,fields:graph.field_definitions.map(f=>({target_table:f.target_table,key:f.key,data_kind:f.data_kind,required:f.required===true,claim_ids:f.claim_ids||[],technical_decision_id:f.technical_decision_id||null}))};
  const graphLines=['flowchart LR','  BASE["Fonte preservada: norma / editorial"]','  ATOM["Átomo literal + intervalo de bytes"]','  CLAIM["Afirmação canônica validada"]','  CONCEPT["Conceito / vocabulário / taxonomia"]','  PROJ["Conteúdo, metamodelo e contrato"]','  VIEW["API, tela e material de estudo"]','  BASE --> ATOM --> CLAIM --> CONCEPT --> PROJ --> VIEW', '  CLAIM --> PROJ'];
  // Specific edges are generated only from actual corpus, never inferred.
  for(const a of graph.atoms)graphLines.push(`  S_${id(a.source_id)}["${escape(a.source_id)}"] --> A_${id(a.id)}["${escape(a.id)}"]`);
  for(const c of graph.claims)for(const atom of c.atom_ids)graphLines.push(`  A_${id(atom)} --> C_${id(c.id)}["${escape(c.id)}"]`);
  for(const concept of graph.concepts)for(const claim of concept.claim_ids)graphLines.push(`  C_${id(claim)} --> K_${id(concept.id)}["${escape(concept.label)}"]`);
  for(const p of graph.content_projections)for(const claim of p.claim_ids)graphLines.push(`  C_${id(claim)} --> P_${id(p.id)}["${escape(p.target_table)}"]`);
  const doc=['# Cânone — linhagem canônica e editorial','', 'Gerado exclusivamente de fontes/átomos declarados no corpus. **Metamodelos não são fonte primária de conteúdo.**','',`- Fontes preservadas: **${report.metrics.sources}**` ,`- Átomos: **${report.metrics.atoms}**`,`- Afirmações: **${report.metrics.claims}**`,`- Conceitos: **${report.metrics.concepts}**`,`- Projeções: **${report.metrics.projections}**`,`- Integridade: **${report.integrity_gate}**`,`- Publicação: **${report.release_gate}**`,'','## Bloqueios atuais','',...report.findings.map(x=>`- [${x.severity}] ${x.code} — ${x.ref}`),'','**Nota:** sistemas de identidade, cobrança, logs e infraestrutura usam contratos técnicos, sem fingir que derivam diretamente de normas contábeis.'].join('\n')+'\n';
  const types=['// GERADO a partir do corpus preservado. Sem claims comprovados, não existem chaves de domínio inferidas.','export type CanonicalConceptKey = '+(graph.concepts.length?graph.concepts.map(x=>JSON.stringify(x.key)).join(' | '):'never')+';','export type CanonicalClaimId = '+(graph.claims.length?graph.claims.map(x=>JSON.stringify(x.id)).join(' | '):'never')+';','export type SourceKind = "NORMATIVE" | "EDITORIAL";',''].join('\n');
  return {
    'canonical.graph.generated.json':canonicalJSON(root),
    'canonical.dictionary.generated.csv':dictionary.map(row=>row.map(esc).join(';')).join('\n')+'\n',
    'canonical.fields.generated.csv':fieldDictionary.map(row=>row.map(esc).join(';')).join('\n')+'\n',
    'canonical.vocabulary.generated.json':canonicalJSON(vocabulary),
    'canonical.contracts.generated.json':canonicalJSON(generatedContract),
    'canonical.lineage.generated.mmd':graphLines.join('\n')+'\n',
    'canonical.types.generated.d.ts':types,
    'canonical.integrity.generated.json':canonicalJSON(report),
    'canonical.report.generated.md':doc
  };
}
function id(v){return digest(v).slice(0,12);}function escape(s){return String(s).replaceAll('"',"'").replaceAll('\n',' ');}
