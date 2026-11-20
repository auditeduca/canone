-- PREPARAÇÃO ISOLADA: não é migration ativa de db/migrations; não aplicar em Calculadoras-Smart.
-- Requer as migrations 001-030 do Cânone e ambiente exclusivo de homologação.
-- Sem dados-fonte preservados e atestados, nenhum objeto deste schema é publicável.
BEGIN;
CREATE SCHEMA IF NOT EXISTS canone_evidence;
REVOKE ALL ON SCHEMA canone_evidence FROM PUBLIC, anon, authenticated;

CREATE TABLE canone_evidence.source_document (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 external_id text NOT NULL,
 origin_project text NOT NULL,
 origin_object text NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('NORMATIVE','EDITORIAL')),
 title text NOT NULL,
 publisher text NOT NULL,
 author text,
 official_authority text,
 source_uri text NOT NULL,
 source_version text NOT NULL,
 published_on date,
 effective_from date,
 effective_to date,
 preserved_artifact_uri text NOT NULL,
 raw_sha256 char(64) NOT NULL CHECK(raw_sha256 ~ '^[0-9a-f]{64}$'),
 rights_status text NOT NULL DEFAULT 'PENDING' CHECK(rights_status IN ('PENDING','CLEARED','BLOCKED')),
 rights_evidence_ref text,
 verification_status text NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING','VERIFIED','REJECTED')),
 linked_editorial_source_id uuid REFERENCES editorial.source(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(origin_project,origin_object,external_id,source_version),
 CONSTRAINT normative_origin_metadata CHECK (
   source_kind <> 'NORMATIVE' OR (official_authority IS NOT NULL AND effective_from IS NOT NULL)),
 CONSTRAINT editorial_origin_metadata CHECK (
   source_kind <> 'EDITORIAL' OR (author IS NOT NULL AND published_on IS NOT NULL)),
 CONSTRAINT normative_effective_range CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);
CREATE TABLE canone_evidence.source_atom (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES canone_evidence.source_document(id) ON DELETE RESTRICT,
 source_atom_key text NOT NULL,
 atom_kind text NOT NULL CHECK(atom_kind IN ('OBLIGATION','DEFINITION','EXCEPTION','CONDITION','FACT','INTERPRETATION','EXAMPLE')),
 byte_start bigint NOT NULL CHECK(byte_start >= 0),
 byte_end bigint NOT NULL,
 quote_literal text NOT NULL CHECK(length(quote_literal)>0),
 quote_sha256 char(64) NOT NULL CHECK(quote_sha256 ~ '^[0-9a-f]{64}$'),
 byte_verified boolean NOT NULL DEFAULT false,
 reviewed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT span_nonempty CHECK(byte_end > byte_start),
 UNIQUE(document_id,source_atom_key),
 UNIQUE(document_id,byte_start,byte_end,quote_sha256)
);
CREATE TABLE canone_evidence.canonical_claim (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 canonical_key text NOT NULL UNIQUE,
 claim_kind text NOT NULL CHECK(claim_kind IN ('NORMATIVE','EDITORIAL','MIXED')),
 statement text NOT NULL CHECK(length(btrim(statement))>0),
 asserts_normative_requirement boolean NOT NULL DEFAULT false,
 revision int NOT NULL DEFAULT 1 CHECK(revision>0),
 review_status text NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','REVIEWED','REJECTED')),
 publication_status text NOT NULL DEFAULT 'HOLD_HUMAN' CHECK(publication_status IN ('HOLD_HUMAN','REJECTED','SUPERSEDED')),
 CONSTRAINT editorial_cannot_claim_normative_rule CHECK(claim_kind <> 'EDITORIAL' OR NOT asserts_normative_requirement),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canone_evidence.claim_atom (
 claim_id uuid NOT NULL REFERENCES canone_evidence.canonical_claim(id) ON DELETE RESTRICT,
 atom_id uuid NOT NULL REFERENCES canone_evidence.source_atom(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('PRIMARY','SUPPORTING','CONTEXT','CONTRADICTION')),
 PRIMARY KEY(claim_id,atom_id)
);
CREATE TABLE canone_evidence.canonical_concept (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 canonical_key text NOT NULL UNIQUE,
 preferred_term text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','REVIEWED','REJECTED'))
);
CREATE TABLE canone_evidence.concept_claim (
 concept_id uuid NOT NULL REFERENCES canone_evidence.canonical_concept(id) ON DELETE RESTRICT,
 claim_id uuid NOT NULL REFERENCES canone_evidence.canonical_claim(id) ON DELETE RESTRICT,
 relation text NOT NULL CHECK(relation IN ('DEFINED_BY','SUPPORTS','REJECTS','EXPLAINS')),
 PRIMARY KEY(concept_id,claim_id,relation)
);
CREATE TABLE canone_evidence.claim_relation (
 source_claim_id uuid NOT NULL REFERENCES canone_evidence.canonical_claim(id) ON DELETE RESTRICT,
 target_claim_id uuid NOT NULL REFERENCES canone_evidence.canonical_claim(id) ON DELETE RESTRICT,
 relation_type text NOT NULL CHECK(relation_type IN ('SUPPORTS','EXPLAINS','CONTRADICTS','SUPERSEDES','EQUIVALENT_TO','QUALIFIES','IMPLEMENTS')),
 evidence_atom_id uuid NOT NULL REFERENCES canone_evidence.source_atom(id) ON DELETE RESTRICT,
 review_status text NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','REVIEWED','REJECTED')),
 PRIMARY KEY(source_claim_id,target_claim_id,relation_type),
 CHECK(source_claim_id <> target_claim_id)
);
CREATE TABLE canone_evidence.candidate_content_projection (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_item_version_id uuid REFERENCES editorial.content_item_version(id) ON DELETE RESTRICT,
 norm_version_id uuid REFERENCES norms.norm_version(id) ON DELETE RESTRICT,
 metamodel_field_id uuid REFERENCES editorial.field_definition(id) ON DELETE RESTRICT,
 projection_key text NOT NULL UNIQUE,
 target_kind text NOT NULL CHECK(target_kind IN ('CONTENT_VERSION','NORM_VERSION','METAMODEL_FIELD')),
 approval_ref text,
 release_status text NOT NULL DEFAULT 'HOLD_HUMAN' CHECK(release_status = 'HOLD_HUMAN'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT projection_target_matches_kind CHECK(
   (target_kind='CONTENT_VERSION' AND content_item_version_id IS NOT NULL AND norm_version_id IS NULL AND metamodel_field_id IS NULL) OR
   (target_kind='NORM_VERSION' AND norm_version_id IS NOT NULL AND content_item_version_id IS NULL AND metamodel_field_id IS NULL) OR
   (target_kind='METAMODEL_FIELD' AND metamodel_field_id IS NOT NULL AND content_item_version_id IS NULL AND norm_version_id IS NULL))
);
CREATE TABLE canone_evidence.projection_claim (
 projection_id uuid NOT NULL REFERENCES canone_evidence.candidate_content_projection(id) ON DELETE RESTRICT,
 claim_id uuid NOT NULL REFERENCES canone_evidence.canonical_claim(id) ON DELETE RESTRICT,
 PRIMARY KEY(projection_id,claim_id)
);
-- Defesa em profundidade: qualquer revisão de afirmação sem fonte correta
-- falha no COMMIT. Inclusões de átomos e links na mesma transação são permitidas.
CREATE FUNCTION canone_evidence.assert_claim_grounding() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, canone_evidence AS $$
DECLARE k uuid; r record; norm_count integer; edit_count integer; total_count integer; invalid_count integer;
BEGIN
  IF TG_TABLE_NAME = 'canonical_claim' THEN
    k := NEW.id;
  ELSIF TG_OP='DELETE' THEN
    k := OLD.claim_id;
  ELSE
    k := NEW.claim_id;
  END IF;
  SELECT * INTO r FROM canone_evidence.canonical_claim WHERE id=k;
  IF NOT FOUND OR r.review_status <> 'REVIEWED' THEN RETURN NULL; END IF;
  SELECT count(*)::int,
    count(*) FILTER(WHERE d.source_kind='NORMATIVE')::int,
    count(*) FILTER(WHERE d.source_kind='EDITORIAL')::int,
    count(*) FILTER(WHERE NOT a.byte_verified OR NOT a.reviewed
                  OR d.verification_status <> 'VERIFIED' OR d.rights_status <> 'CLEARED')::int
  INTO total_count,norm_count,edit_count,invalid_count
  FROM canone_evidence.claim_atom ca
  JOIN canone_evidence.source_atom a ON a.id=ca.atom_id
  JOIN canone_evidence.source_document d ON d.id=a.document_id
  WHERE ca.claim_id=k;
  IF total_count=0 OR invalid_count>0
     OR (r.claim_kind IN ('NORMATIVE','MIXED') AND norm_count=0)
     OR (r.claim_kind IN ('EDITORIAL','MIXED') AND edit_count=0) THEN
    RAISE EXCEPTION 'CANONE_CANONICAL_GROUNDING_BLOCKED %',k USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER canonical_claim_grounding_check
  AFTER INSERT OR UPDATE ON canone_evidence.canonical_claim
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION canone_evidence.assert_claim_grounding();
CREATE CONSTRAINT TRIGGER claim_atom_grounding_check
  AFTER INSERT OR UPDATE OR DELETE ON canone_evidence.claim_atom
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION canone_evidence.assert_claim_grounding();

-- O esquema de candidatos jamais substitui o workflow de publicação já existente em editorial.
-- Política de segurança: acesso via serviço privado de ingestão após revisão, jamais navegador.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='canone_evidence'
  LOOP EXECUTE format('ALTER TABLE canone_evidence.%I ENABLE ROW LEVEL SECURITY',t);
       EXECUTE format('ALTER TABLE canone_evidence.%I FORCE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA canone_evidence FROM PUBLIC, anon, authenticated;
-- Somente o papel técnico NOLOGIN, após autorização pela equipe de banco.
-- Nenhum grant ao app, staff, navegador ou service_role geral.
GRANT USAGE ON SCHEMA canone_evidence TO canone_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA canone_evidence TO canone_system;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='canone_evidence' LOOP
   EXECUTE format('CREATE POLICY evidence_system_only ON canone_evidence.%I FOR ALL TO canone_system USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
