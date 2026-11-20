# Mapa de integração e entidades

Arestas de integração são candidatas, **não FKs remotas entre projetos**.

| Origem | Identidade origem | Destino Cânone | Gate |
|---|---|---|---|
| `contabilidade_cfc.sources` | `source_id` | `editorial.source` | `SOURCE_VERIFICATION_REQUIRED` |
| `contabilidade_cfc.questions` | `question_id` | `editorial.content_item_version (+ learning.item after projection)` | `OFFICIAL_KEY_AND_EDITORIAL_QA_REQUIRED` |
| `account_palm.master_register` | `register_id` | `governed master registry -> norms.norm / editorial.source after approval` | `CANONICAL_PROMOTION_FALSE_HOLD` |
| `account_palm.entities` | `canonical_id` | `crosswalk master entity registry` | `MASTER_ENTITY_REVIEW` |
| `account_palm.normative_works` | `canonical_id` | `norms.norm candidate` | `SOURCE_RIGHTS_EFFECTIVE_DATE_REQUIRED` |
| `account_palm.regulatory_instruments` | `instrument_id` | `norms.norm candidate (do not assume current version)` | `VERSION_AND_VIGENCY_REQUIRED` |
| `public.regulatory_instruments` | `instrument_id` | `reconciliation only with account_palm.regulatory_instruments` | `RECONCILE_4_PUBLIC_ONLY` |
| `account_palm.normalized_units_v1` | `normalized_unit_id` | `norms.norm_item candidate (text not public)` | `SEMANTIC_REVIEW_RIGHTS_AND_VERSION_REQUIRED` |
| `contabilidade_cfc.audit_normative_scope_v1` | `instrument_id` | `source normative QA registry` | `SOURCE_VERIFIED_AND_PUBLICATION_ELIGIBLE` |
| `contabilidade_cfc.audit_normative_segment_drafts_v1` | `segment_id` | `normative segment candidate registry (text withheld)` | `EDITORIAL_REVIEW_REQUIRED` |
| `account_palm.normative_extractions` | `instrument_id` | `canone_evidence.source_document candidate` | `SOURCE_BYTES_AND_RIGHTS_PENDING` |
| `account_palm.normative_assertion_candidates_v1` | `assertion_candidate_id` | `canone_evidence.canonical_claim candidate (not promoted)` | `ATOM_AND_SEMANTIC_REVIEW_PENDING` |
| `account_palm.normative_claim_candidates_v1` | `claim_candidate_id` | `canone_evidence.canonical_claim candidate (not promoted)` | `CLAIM_REVIEW_AND_SOURCE_PROOF_PENDING` |

## Modelo Cânone identificado no ERD do pacote

Tabelas declaradas no ERD fornecido: 90. Reexecutar o gerador sobre PostgreSQL real em homologação para confirmar contagem e FKs.

- `identity.account`: 11 colunas registradas no diagrama original
- `identity.consent`: 12 colunas registradas no diagrama original
- `identity.consent_purpose`: 7 colunas registradas no diagrama original
- `identity.data_request`: 10 colunas registradas no diagrama original
- `identity.data_request_event`: 7 colunas registradas no diagrama original
- `identity.magic_link`: 7 colunas registradas no diagrama original
- `identity.role`: 5 colunas registradas no diagrama original
- `identity.session`: 10 colunas registradas no diagrama original
- `identity.user_profile`: 15 colunas registradas no diagrama original
- `identity.user_role`: 7 colunas registradas no diagrama original
- `editorial.content_item`: 19 colunas registradas no diagrama original
- `editorial.content_item_version`: 8 colunas registradas no diagrama original
- `editorial.content_norm_citation`: 8 colunas registradas no diagrama original
- `editorial.content_relation`: 7 colunas registradas no diagrama original
- `editorial.content_relation_type`: 5 colunas registradas no diagrama original
- `editorial.content_revision`: 10 colunas registradas no diagrama original
- `editorial.content_type`: 9 colunas registradas no diagrama original
- `editorial.content_type_version`: 6 colunas registradas no diagrama original
- `editorial.enumeration`: 5 colunas registradas no diagrama original
- `editorial.enumeration_value`: 7 colunas registradas no diagrama original
- `editorial.field_definition`: 12 colunas registradas no diagrama original
- `editorial.source`: 15 colunas registradas no diagrama original
- `editorial.state_definition`: 11 colunas registradas no diagrama original
- `editorial.state_transition`: 5 colunas registradas no diagrama original
- `editorial.verification`: 13 colunas registradas no diagrama original
- `taxonomy.blueprint`: 5 colunas registradas no diagrama original
- `taxonomy.exam_edition`: 23 colunas registradas no diagrama original
- `taxonomy.exam_track`: 10 colunas registradas no diagrama original
- `taxonomy.item_placement`: 6 colunas registradas no diagrama original
- `taxonomy.knowledge_area`: 5 colunas registradas no diagrama original
- `taxonomy.module`: 11 colunas registradas no diagrama original
- `taxonomy.module_subject`: 2 colunas registradas no diagrama original
- `taxonomy.subject`: 8 colunas registradas no diagrama original
- `taxonomy.subtopic`: 6 colunas registradas no diagrama original
- `norms.issuer`: 6 colunas registradas no diagrama original
- `norms.norm`: 8 colunas registradas no diagrama original
- `norms.norm_item`: 9 colunas registradas no diagrama original
- `norms.norm_version`: 10 colunas registradas no diagrama original
- `learning.answer_key`: 9 colunas registradas no diagrama original
- `learning.answer_key_entry`: 4 colunas registradas no diagrama original
- `learning.case_step`: 6 colunas registradas no diagrama original
- `learning.duel`: 7 colunas registradas no diagrama original
- `learning.exam_attempt`: 11 colunas registradas no diagrama original
- `learning.exam_attempt_answer`: 6 colunas registradas no diagrama original
- `learning.exam_form`: 7 colunas registradas no diagrama original
- `learning.exam_form_item`: 3 colunas registradas no diagrama original
- `learning.explanation`: 7 colunas registradas no diagrama original
- `learning.favorite`: 4 colunas registradas no diagrama original
- `learning.item`: 14 colunas registradas no diagrama original
- `learning.item_option`: 7 colunas registradas no diagrama original
- `learning.item_subject`: 2 colunas registradas no diagrama original
- `learning.mastery`: 11 colunas registradas no diagrama original
- `learning.mind_map`: 4 colunas registradas no diagrama original
- `learning.mind_map_node`: 8 colunas registradas no diagrama original
- `learning.mock_exam`: 9 colunas registradas no diagrama original
- `learning.mock_exam_item`: 3 colunas registradas no diagrama original
- `learning.note`: 8 colunas registradas no diagrama original
- `learning.offline_pack`: 10 colunas registradas no diagrama original
- `learning.pocket_entry`: 7 colunas registradas no diagrama original
- `learning.review_event`: 13 colunas registradas no diagrama original
- `learning.session`: 14 colunas registradas no diagrama original
- `learning.study_block`: 5 colunas registradas no diagrama original
- `learning.study_plan`: 10 colunas registradas no diagrama original
- `learning.user_item_state`: 16 colunas registradas no diagrama original
- `commerce.coupon`: 11 colunas registradas no diagrama original
- `commerce.entitlement`: 9 colunas registradas no diagrama original
- `commerce.invoice`: 14 colunas registradas no diagrama original
- `commerce.payment`: 15 colunas registradas no diagrama original
- `commerce.plan`: 13 colunas registradas no diagrama original
- `commerce.plan_feature`: 4 colunas registradas no diagrama original
- `commerce.subscription`: 13 colunas registradas no diagrama original
- `admin.content_report`: 6 colunas registradas no diagrama original
- `admin.feature_flag`: 6 colunas registradas no diagrama original
- `admin.moderation_queue`: 11 colunas registradas no diagrama original
- `admin.support_access_grant`: 12 colunas registradas no diagrama original
- `admin.support_access_log`: 9 colunas registradas no diagrama original
- `admin.user_note`: 7 colunas registradas no diagrama original
- `ops.api_key`: 12 colunas registradas no diagrama original
- `ops.error_event`: 12 colunas registradas no diagrama original
- `ops.integration`: 12 colunas registradas no diagrama original
- `ops.job_run`: 14 colunas registradas no diagrama original
- `ops.metric_daily`: 5 colunas registradas no diagrama original
- `ops.migration_log`: 6 colunas registradas no diagrama original
- `ops.notification`: 9 colunas registradas no diagrama original
- `ops.notification_delivery`: 9 colunas registradas no diagrama original
- `ops.notification_template`: 9 colunas registradas no diagrama original
- `ops.setting`: 7 colunas registradas no diagrama original
- `ops.webhook`: 10 colunas registradas no diagrama original
- `ops.webhook_delivery`: 11 colunas registradas no diagrama original
- `audit.audit_log`: 17 colunas registradas no diagrama original
