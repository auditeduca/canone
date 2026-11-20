// GERADO. NÃO EDITAR. Tipos unknown são campos não introspectados no snapshot parcial.
export interface CanoneExternalMetadata {
  'account_palm.atomization_eval_sample_v1': {
  };
  'account_palm.atomization_fragment_quality_v1': {
  };
  'account_palm.atomization_gold_draft_proposals_v1': {
  };
  'account_palm.atomization_gold_replacements_v1': {
  };
  'account_palm.atomization_gold_review_batch_v1': {
  };
  'account_palm.dou_content_validation_v1': {
  };
  'account_palm.dou_discovery_candidates_v1': {
  };
  'account_palm.dou_discovery_requests_v1': {
  };
  'account_palm.dou_validation_runs_v1': {
  };
  'account_palm.entities': {
    'canonical_id'?: string;
    'entity_type_id'?: unknown;
    'business_key'?: unknown;
    'source_of_truth'?: unknown;
    'status'?: unknown;
    'version'?: unknown;
    'current_version_ref'?: unknown;
  };
  'account_palm.master_register': {
    'register_id'?: string;
    'category'?: unknown;
    'object_type'?: unknown;
    'object_id'?: unknown;
    'canonical_status'?: unknown;
    'canonical_promotion'?: unknown;
    'source_scope'?: unknown;
    'source_ref'?: unknown;
    'evidence_refs'?: unknown;
  };
  'account_palm.normalization_runs_v1': {
  };
  'account_palm.normalized_units_v1': {
    'normalized_unit_id'?: string;
    'run_id'?: unknown;
    'instrument_id'?: unknown;
    'normative_work_id'?: unknown;
    'locator'?: unknown;
    'source_text_sha256'?: unknown;
    'normalized_text_sha256'?: unknown;
    'publication_mode'?: unknown;
    'canonical_promotion'?: unknown;
  };
  'account_palm.normative_assertion_candidates_v1': {
  };
  'account_palm.normative_claim_candidates_v1': {
  };
  'account_palm.normative_extractions': {
    'instrument_id'?: string;
    'raw_sha256'?: string;
    'text_sha256'?: string;
    'mask_sha256'?: string;
    'source_url'?: string;
    'extraction_status'?: string;
    'publication_mode'?: string;
    'canonical_promotion'?: boolean;
  };
  'account_palm.normative_temporal_evidence_v1': {
  };
  'account_palm.normative_temporal_type_registry_v1': {
  };
  'account_palm.normative_works': {
    'canonical_id'?: string;
    'entity_type_id'?: unknown;
    'business_key'?: unknown;
    'source_of_truth'?: unknown;
    'status'?: unknown;
    'version'?: unknown;
    'current_version_ref'?: unknown;
  };
  'account_palm.regulatory_instruments': {
    'instrument_id'?: string;
    'title'?: unknown;
    'issuer'?: unknown;
    'canonical_status'?: unknown;
  };
  'cko_governance.account_palm_master_register_v1': {
  };
  'cko_master.entities': {
  };
  'contabilidade_cfc.audit_normative_change_events_v1': {
  };
  'contabilidade_cfc.audit_normative_pmo_v1': {
  };
  'contabilidade_cfc.audit_normative_scope_v1': {
    'instrument_id'?: string;
    'family'?: unknown;
    'source_verified'?: unknown;
    'publication_eligible'?: unknown;
  };
  'contabilidade_cfc.audit_normative_segment_drafts_v1': {
    'segment_id'?: string;
    'instrument_id'?: unknown;
    'parent_unit_id'?: unknown;
    'segment_sha256'?: unknown;
    'technical_validation_status'?: unknown;
    'editorial_validation_status'?: unknown;
    'publication_eligible'?: unknown;
  };
  'contabilidade_cfc.audit_normative_segment_parent_qa_v1': {
  };
  'contabilidade_cfc.pmo_findings': {
  };
  'contabilidade_cfc.pmo_source_register': {
  };
  'contabilidade_cfc.pmo_sync_runs': {
  };
  'contabilidade_cfc.pmo_workstreams': {
  };
  'contabilidade_cfc.questions': {
    'question_id'?: string;
    'source_id'?: unknown;
    'question_number'?: unknown;
    'statement'?: unknown;
    'raw_text'?: unknown;
    'options'?: unknown;
    'classification'?: unknown;
    'answer_key'?: unknown;
    'answer_status'?: unknown;
    'extraction_status'?: unknown;
    'provenance'?: unknown;
  };
  'contabilidade_cfc.sources': {
    'source_id'?: string;
    'title'?: unknown;
    'source_url'?: unknown;
    'edition'?: unknown;
    'exam_year'?: unknown;
    'exam_board'?: unknown;
    'question_count'?: unknown;
    'status'?: unknown;
  };
  'public.cfc_internal_normative_extractions': {
  };
  'public.regulatory_instruments': {
    'instrument_id'?: string;
    'title'?: unknown;
    'issuer'?: unknown;
    'canonical_status'?: unknown;
  };
}
