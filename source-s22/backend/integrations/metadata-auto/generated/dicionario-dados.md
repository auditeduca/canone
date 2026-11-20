# Dicionário de dados — Cânone / Audit Educa

> Gerado de snapshot **PARTIAL_INSPECTION_NO_SECRETS**. Não preencher colunas não verificadas por inferência. Fonte: Supabase MCP read-only pg_catalog and row counts.

| Objeto | Tipo físico | Chave PK (não aplicável a view) | Colunas descritas | Linhas observadas | Cobertura |
|---|---|---|---:|---:|---|
| `account_palm.atomization_eval_sample_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.atomization_fragment_quality_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.atomization_gold_draft_proposals_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.atomization_gold_replacements_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.atomization_gold_review_batch_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.dou_content_validation_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.dou_discovery_candidates_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.dou_discovery_requests_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.dou_validation_runs_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.entities` | VIEW | N/A (identidade lógica: canonical_id) | 7 | 555 | live_selected_columns |
| `account_palm.master_register` | VIEW | N/A (identidade lógica: register_id) | 9 | 549 | live_selected_columns |
| `account_palm.normalization_runs_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.normalized_units_v1` | TABLE | normalized_unit_id | 9 | 24385 | live_selected_columns |
| `account_palm.normative_assertion_candidates_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.normative_claim_candidates_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.normative_extractions` | VIEW | N/A (identidade lógica: instrument_id) | 8 | 249 | eight_columns_types_confirmed_rest_not_introspected |
| `account_palm.normative_temporal_evidence_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.normative_temporal_type_registry_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_name_or_fk_only |
| `account_palm.normative_works` | VIEW | N/A (identidade lógica: canonical_id) | 7 | 256 | live_selected_columns |
| `account_palm.regulatory_instruments` | VIEW | N/A (identidade lógica: instrument_id) | 4 | 249 | live_selected_columns |
| `cko_governance.account_palm_master_register_v1` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_object_kind_only |
| `cko_master.entities` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_object_kind_only |
| `contabilidade_cfc.audit_normative_change_events_v1` | TABLE | event_id | 0 | 3 | catalog_name_or_fk_only |
| `contabilidade_cfc.audit_normative_pmo_v1` | TABLE | task_id | 0 | 9 | catalog_name_or_fk_only |
| `contabilidade_cfc.audit_normative_scope_v1` | TABLE | instrument_id | 4 | 42 | live_selected_columns |
| `contabilidade_cfc.audit_normative_segment_drafts_v1` | TABLE | segment_id | 7 | 393 | live_selected_columns |
| `contabilidade_cfc.audit_normative_segment_parent_qa_v1` | TABLE | NÃO VERIFICADA | 0 | 4 | catalog_name_or_fk_only |
| `contabilidade_cfc.pmo_findings` | TABLE | finding_id | 0 | 6 | catalog_name_or_fk_only |
| `contabilidade_cfc.pmo_source_register` | TABLE | source_id | 0 | 0 | catalog_name_or_fk_only |
| `contabilidade_cfc.pmo_sync_runs` | TABLE | sync_id | 0 | 1 | catalog_name_or_fk_only |
| `contabilidade_cfc.pmo_workstreams` | TABLE | pmo_id | 0 | 20 | catalog_name_or_fk_only |
| `contabilidade_cfc.questions` | TABLE | question_id | 11 | 50 | live_selected_columns |
| `contabilidade_cfc.sources` | TABLE | source_id | 8 | 1 | live_selected_columns |
| `public.cfc_internal_normative_extractions` | TABLE | NÃO VERIFICADA | 0 | não medida | catalog_object_and_view_source_only |
| `public.regulatory_instruments` | TABLE | instrument_id | 4 | 253 | live_selected_columns |

## Relacionamentos físicos observados

| Origem | Coluna | Referência | Coluna | Prova |
|---|---|---|---|---|
| `account_palm.atomization_eval_sample_v1` | `assertion_candidate_id` | `account_palm.normative_assertion_candidates_v1` | `assertion_candidate_id` | FK validada no catálogo |
| `account_palm.atomization_eval_sample_v1` | `normalized_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `account_palm.atomization_fragment_quality_v1` | `normalized_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `account_palm.atomization_gold_draft_proposals_v1` | `sample_id` | `account_palm.atomization_eval_sample_v1` | `sample_id` | FK validada no catálogo |
| `account_palm.atomization_gold_replacements_v1` | `assertion_candidate_id` | `account_palm.normative_assertion_candidates_v1` | `assertion_candidate_id` | FK validada no catálogo |
| `account_palm.atomization_gold_replacements_v1` | `normalized_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `account_palm.atomization_gold_replacements_v1` | `replaced_sample_id` | `account_palm.atomization_eval_sample_v1` | `sample_id` | FK validada no catálogo |
| `account_palm.atomization_gold_review_batch_v1` | `sample_id` | `account_palm.atomization_eval_sample_v1` | `sample_id` | FK validada no catálogo |
| `account_palm.dou_content_validation_v1` | `run_id` | `account_palm.dou_validation_runs_v1` | `run_id` | FK validada no catálogo |
| `account_palm.dou_discovery_candidates_v1` | `request_id` | `account_palm.dou_discovery_requests_v1` | `request_id` | FK validada no catálogo |
| `account_palm.normalized_units_v1` | `run_id` | `account_palm.normalization_runs_v1` | `run_id` | FK validada no catálogo |
| `account_palm.normative_assertion_candidates_v1` | `normalized_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `account_palm.normative_claim_candidates_v1` | `assertion_candidate_id` | `account_palm.normative_assertion_candidates_v1` | `assertion_candidate_id` | FK validada no catálogo |
| `account_palm.normative_claim_candidates_v1` | `normalized_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `account_palm.normative_temporal_evidence_v1` | `temporal_type` | `account_palm.normative_temporal_type_registry_v1` | `temporal_type` | FK validada no catálogo |
| `contabilidade_cfc.audit_normative_scope_v1` | `instrument_id` | `public.regulatory_instruments` | `instrument_id` | FK validada no catálogo |
| `contabilidade_cfc.audit_normative_segment_drafts_v1` | `parent_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `contabilidade_cfc.audit_normative_segment_parent_qa_v1` | `parent_unit_id` | `account_palm.normalized_units_v1` | `normalized_unit_id` | FK validada no catálogo |
| `contabilidade_cfc.questions` | `source_id` | `contabilidade_cfc.sources` | `source_id` | FK validada no catálogo |

## Relações de view e lógicas — NÃO são FKs

- [VIEW_DEPENDENCY] `account_palm.entities` → `cko_master.entities` (pg_get_viewdef() observado no Supabase; view security_invoker=true; NÃO é FK)
- [VIEW_DEPENDENCY] `account_palm.master_register` → `cko_governance.account_palm_master_register_v1` (pg_get_viewdef() observado no Supabase; view security_invoker=true; NÃO é FK)
- [VIEW_DEPENDENCY] `account_palm.normative_extractions` → `public.cfc_internal_normative_extractions` (pg_get_viewdef; security_invoker=true; origem public.cfc_internal_normative_extractions)
- [VIEW_DEPENDENCY] `account_palm.normative_works` → `cko_master.entities` (pg_get_viewdef() observado no Supabase; view security_invoker=true; NÃO é FK)
- [VIEW_DEPENDENCY] `account_palm.regulatory_instruments` → `public.regulatory_instruments` (pg_get_viewdef() observado no Supabase; view security_invoker=true; NÃO é FK)
- [LOGICAL_CROSSWALK] `account_palm.master_register` → `account_palm.entities` (Candidate relation, cardinality unknown; NOT an FK)
- [LOGICAL_CROSSWALK] `account_palm.regulatory_instruments` → `public.regulatory_instruments` (249 common; 4 only public; NOT an FK)
- [LOGICAL_CROSSWALK] `account_palm.normalized_units_v1` → `public.regulatory_instruments` (2026-11-14 SELECT orphans=0; NOT an FK)

## Bloqueios da promoção

- GABARITO_PENDENTE:50
- NORMAS_NAO_CONCILIADAS:4
- SEGMENTOS_SEM_REVISAO:393
- NENHUMA_NORMA_APTA_A_PUBLICAR

O arquivo CSV é o dicionário por coluna. O modo `--live --check` verifica drift físico contra o banco.
