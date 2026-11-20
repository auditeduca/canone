-- CÂNONE / AUDIT EDUCA — somente para banco de homologação EXCLUSIVO Cânone.
-- Não executar no Supabase Calculadoras-Smart. Esta migration NÃO faz parte de db/migrations 001-030.
-- Pré-requisitos: 30 migrations do Cânone já aplicadas, papéis e RLS testados.
BEGIN;

CREATE SCHEMA IF NOT EXISTS canone_bridge;
REVOKE ALL ON SCHEMA canone_bridge FROM PUBLIC, anon, authenticated;

CREATE TABLE canone_bridge.source_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_ref text NOT NULL CHECK (source_project_ref = 'pgsybzggewhinaniybiy'),
  source_table text NOT NULL CHECK (source_table IN (
    'contabilidade_cfc.sources','contabilidade_cfc.questions',
    'contabilidade_cfc.audit_normative_scope_v1',
    'contabilidade_cfc.audit_normative_segment_drafts_v1',
    'account_palm.master_register','account_palm.entities',
    'account_palm.normative_works','account_palm.regulatory_instruments',
    'account_palm.normalized_units_v1','public.regulatory_instruments'
  )),
  source_pk text NOT NULL CHECK(length(btrim(source_pk)) > 0),
  payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_evidence) = 'object'),
  intake_status text NOT NULL DEFAULT 'HOLD_HUMAN' CHECK(intake_status IN ('HOLD_HUMAN','REJECTED','SUPERSEDED')),
  publication_eligible boolean NOT NULL DEFAULT false CHECK(publication_eligible = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_project_ref,source_table,source_pk),
  UNIQUE(id, source_table)
);
CREATE INDEX ix_bridge_source_table ON canone_bridge.source_row(source_table,intake_status);

-- Essas arestas são relações entre cópias de proveniência no destino; NUNCA
-- são FKs entre bancos Supabase diferentes.
CREATE TABLE canone_bridge.source_relation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_source_row_id uuid NOT NULL REFERENCES canone_bridge.source_row(id) ON DELETE RESTRICT,
  right_source_row_id uuid NOT NULL REFERENCES canone_bridge.source_row(id) ON DELETE RESTRICT,
  relation text NOT NULL CHECK(relation IN ('REFERENCES','DERIVED_FROM','EQUIVALENT_TO','SUPERSEDES','CITES','HAS_SOURCE')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(provenance)='object'),
  state text NOT NULL DEFAULT 'CANDIDATE' CHECK(state IN ('CANDIDATE','CONFLICT','REJECTED','VERIFIED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bridge_no_self_relation CHECK(left_source_row_id <> right_source_row_id),
  UNIQUE(left_source_row_id,right_source_row_id,relation)
);

-- FK tipada para impedir referência a ID inexistente dentro do Cânone.
CREATE TABLE canone_bridge.canonical_crosswalk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row_id uuid NOT NULL UNIQUE REFERENCES canone_bridge.source_row(id) ON DELETE RESTRICT,
  target_kind text NOT NULL CHECK(target_kind IN ('SOURCE','CONTENT_ITEM','NORM','NORM_VERSION','NORM_ITEM')),
  editorial_source_id uuid REFERENCES editorial.source(id) ON DELETE RESTRICT,
  editorial_content_id uuid REFERENCES editorial.content_item(id) ON DELETE RESTRICT,
  norms_norm_id uuid REFERENCES norms.norm(id) ON DELETE RESTRICT,
  norms_norm_version_id uuid REFERENCES norms.norm_version(id) ON DELETE RESTRICT,
  norms_norm_item_id uuid REFERENCES norms.norm_item(id) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'HOLD_HUMAN' CHECK(review_status IN ('HOLD_HUMAN','CONFLICT','REJECTED')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(evidence)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bridge_exactly_one_target CHECK(num_nonnulls(
    editorial_source_id, editorial_content_id, norms_norm_id, norms_norm_version_id, norms_norm_item_id)=1),
  CONSTRAINT bridge_kind_matches_target CHECK (
    (target_kind='SOURCE' AND editorial_source_id IS NOT NULL) OR
    (target_kind='CONTENT_ITEM' AND editorial_content_id IS NOT NULL) OR
    (target_kind='NORM' AND norms_norm_id IS NOT NULL) OR
    (target_kind='NORM_VERSION' AND norms_norm_version_id IS NOT NULL) OR
    (target_kind='NORM_ITEM' AND norms_norm_item_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX ux_bridge_crosswalk_source_target ON canone_bridge.canonical_crosswalk(source_row_id,target_kind);

-- A aprovação editorial não se confunde com o intake do bridge. Não existe
-- nesta camada sequer uma operação de promoção; é executada separadamente pelo
-- workflow existente do Cânone, com validação independente de fonte, direito,
-- versão, gabarito, vigência e autorização humana.
ALTER TABLE canone_bridge.source_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_bridge.source_row FORCE ROW LEVEL SECURITY;
ALTER TABLE canone_bridge.source_relation ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_bridge.source_relation FORCE ROW LEVEL SECURITY;
ALTER TABLE canone_bridge.canonical_crosswalk ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_bridge.canonical_crosswalk FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA canone_bridge FROM PUBLIC, anon, authenticated;
COMMIT;
