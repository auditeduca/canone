// Cânone — diagnóstico de prontidão derivado SOMENTE de candidatos da origem.
// O catálogo é um índice de trabalho; nunca converte números de extração em claims aprovados.
const SHA=/^[0-9a-f]{64}$/;
const yes=v=>v===true;
const group=(candidates,source)=>candidates.filter(c=>c.origin===source);
const data=c=>c.draft||{};
const have=v=>typeof v==='string'&&v.trim().length>0;

export function inspectReadiness(candidates){
  const docs=group(candidates,'account_palm.normative_extractions');
  const units=group(candidates,'account_palm.normalized_units_v1');
  const assertions=group(candidates,'account_palm.normative_assertion_candidates_v1');
  const claims=group(candidates,'account_palm.normative_claim_candidates_v1');
  const exams=group(candidates,'contabilidade_cfc.questions');
  const normativeQa=group(candidates,'contabilidade_cfc.audit_normative_scope_v1');
  const segments=group(candidates,'contabilidade_cfc.audit_normative_segment_drafts_v1');
  const sources=group(candidates,'contabilidade_cfc.sources');
  const manifest={
    extraction_metadata:docs.length,
    extraction_records_with_three_hashes:docs.filter(c=>['raw_sha256','text_sha256','mask_sha256'].every(f=>SHA.test(data(c)[f]||''))).length,
    extracted_original_files_archived_in_canone:0, // nenhum NDJSON de metadados comprova bytes originais
    normalized_units:units.length,
    normalized_units_structural_pass:units.filter(c=>data(c).structural_status==='PASS').length,
    units_internal_only:units.filter(c=>data(c).publication_mode==='INTERNAL_ONLY').length,
    assertion_feature_candidates:assertions.length,
    assertion_features_with_unit_link:assertions.filter(c=>have(data(c).normalized_unit_id)).length,
    semantic_claim_candidates:claims.length,
    semantic_claims_human_reviewed:0,
    confirmed_normative_canonical_claims:0,
    exam_questions:exams.length,
    questions_without_verified_official_key:exams.filter(c=>data(c).official_key_verified!==true).length,
    exam_sources:sources.length,
    normative_scopes:normativeQa.length,
    normative_scopes_source_verified:normativeQa.filter(c=>yes(data(c).source_verified)).length,
    normative_scopes_publication_eligible:normativeQa.filter(c=>yes(data(c).publication_eligible)).length,
    segments:segments.length,
    segments_editorial_pending:segments.filter(c=>data(c).editorial_validation_status!=='REVIEWED').length,
    candidates_marked_for_publication:candidates.filter(c=>c.publication_eligible===true||c.import_status!=='HOLD_HUMAN').length,
  };
  const blockers=[];
  const hold=(code,count,why)=>{if(count>0)blockers.push({code,count,reason:why});};
  hold('ORIGINAL_ARTIFACT_MISSING_OR_UNATTESTED',docs.length,'SHA declarado na origem não substitui a preservação e verificação local dos bytes originais.');
  hold('EXTRACTION_HASH_INCOMPLETE',docs.length-manifest.extraction_records_with_three_hashes,'Hash de extração incompleto.');
  hold('SEMANTIC_CLAIMS_NOT_MATERIALIZED',Math.max(0,assertions.length-claims.length),'Features e assertivas provisórias não são claims semanticamente aprovados.');
  hold('QUESTION_OFFICIAL_KEY_UNVERIFIED',manifest.questions_without_verified_official_key,'Exigir gabarito pós-recursos da mesma prova/edição e revisão humana.');
  hold('NORMATIVE_SOURCE_QA_PENDING',normativeQa.length-manifest.normative_scopes_publication_eligible,'Instrumentos ainda não homologados para publicação.');
  hold('EDITORIAL_SEGMENT_REVIEW_PENDING',manifest.segments_editorial_pending,'Segmentos técnico-lossless continuam pendentes de semântica editorial.');
  if(candidates.length===0)blockers.push({code:'NO_CANDIDATE_EXPORT',count:1,reason:'Executar primeiro exportador READ ONLY com credencial restrita.'});
  const inconsistent=manifest.candidates_marked_for_publication;
  hold('PREMATURE_PROMOTION_ATTEMPT',inconsistent,'Qualquer promoção pelo intake é proibida.');
  const dataCompleteness={
    assertions_per_normalized_unit:units.length?Number((assertions.length/units.length).toFixed(4)):null,
    claims_per_assertion:assertions.length?Number((claims.length/assertions.length).toFixed(4)):null,
    extraction_three_hashes_pct:docs.length?Number((100*manifest.extraction_records_with_three_hashes/docs.length).toFixed(2)):null,
  };
  return {contract:'canone.semantic-readiness.v1',origin:'Calculadoras-Smart READ ONLY',source_authority:'EVIDENCE_FIRST',
    master_data_is_projection:true,corpus_release_status:'HOLD_HUMAN',auto_promotions:0,
    integrity_gate:inconsistent?'FAIL':'PASS',metrics:manifest,coverage:dataCompleteness,blockers};
}

export function buildEvidenceQueue(candidates,{limit=250}={}){
  const all=[];
  for(const c of candidates){
    if(c.origin==='account_palm.normative_extractions')all.push({priority:'P0',kind:'PRESERVE_ORIGINAL',instrument_id:c.origin_pk,original_sha256:data(c).raw_sha256||null,extracted_sha256:data(c).text_sha256||null,status:'HOLD_SOURCE_BYTES'});
    if(c.origin==='contabilidade_cfc.sources')all.push({priority:'P0',kind:'PRESERVE_EXAM_DOCUMENT',source_id:c.origin_pk,source_url:data(c).source_url||null,status:'HOLD_DOCUMENT_HASH'});
    if(c.origin==='account_palm.normative_assertion_candidates_v1')all.push({priority:'P1',kind:'REVIEW_ASSERTION',assertion_id:c.origin_pk,unit_id:data(c).normalized_unit_id||null,status:'HOLD_SEMANTIC_REVIEW'});
    if(c.origin==='contabilidade_cfc.questions')all.push({priority:'P1',kind:'VERIFY_EXAM_KEY',question_id:c.origin_pk,status:'HOLD_FINAL_KEY'});
  }
  return {status:'HOLD_HUMAN',total:all.length,returned:Math.min(Math.max(limit,0),all.length),truncated:all.length>limit,
    items:all.slice(0,limit),content_or_answers_exposed:false,remote_writes:0};
}
