-- CÂNONE S5: implantação conservadora em Supabase COMPARTILHADO (não é banco exclusivo).
-- Apenas novos schemas canone_* e tabelas canone_control. Nenhuma tabela existente será modificada.
-- 30 migrations do aplicativo são INVENTARIADAS, NÃO EXECUTADAS; dependem de portabilidade e RLS.
-- Banco destino verificado: pgsybzggewhinaniybiy; não executar em SOT-10-09-2026.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '25s';
DO $preflight$
DECLARE conflict_name text;
BEGIN
  SELECT nspname INTO conflict_name FROM pg_namespace
   WHERE nspname IN ('canone_identity', 'canone_editorial', 'canone_taxonomy', 'canone_norms', 'canone_learning', 'canone_commerce', 'canone_admin', 'canone_ops', 'canone_audit', 'canone_public', 'canone_subscriber', 'canone_evidence', 'canone_bridge', 'canone_control') LIMIT 1;
  IF conflict_name IS NOT NULL THEN RAISE EXCEPTION 'CANONE_NAMESPACE_COLLISION: %', conflict_name; END IF;
END $preflight$;
CREATE SCHEMA canone_identity;
COMMENT ON SCHEMA canone_identity IS 'Identidade e LGPD — reservado, sem tabelas operacionais ainda';
REVOKE ALL ON SCHEMA canone_identity FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_editorial;
COMMENT ON SCHEMA canone_editorial IS 'Conteúdo, metamodelo e revisão — reservado';
REVOKE ALL ON SCHEMA canone_editorial FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_taxonomy;
COMMENT ON SCHEMA canone_taxonomy IS 'Blueprint, provas e conhecimentos — reservado';
REVOKE ALL ON SCHEMA canone_taxonomy FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_norms;
COMMENT ON SCHEMA canone_norms IS 'Fontes normativas e vigência — reservado';
REVOKE ALL ON SCHEMA canone_norms FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_learning;
COMMENT ON SCHEMA canone_learning IS 'Questões, simulados, SRS e progresso — reservado';
REVOKE ALL ON SCHEMA canone_learning FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_commerce;
COMMENT ON SCHEMA canone_commerce IS 'Assinaturas, cobrança e entitlement — DESATIVADO';
REVOKE ALL ON SCHEMA canone_commerce FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_admin;
COMMENT ON SCHEMA canone_admin IS 'Comander e governança administrativa — DESATIVADO';
REVOKE ALL ON SCHEMA canone_admin FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_ops;
COMMENT ON SCHEMA canone_ops IS 'Orquestração, integrações e jobs — reservado';
REVOKE ALL ON SCHEMA canone_ops FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_audit;
COMMENT ON SCHEMA canone_audit IS 'Trilha de auditoria somente acréscimo — reservado';
REVOKE ALL ON SCHEMA canone_audit FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_public;
COMMENT ON SCHEMA canone_public IS 'Views públicas do Cânone; NÃO é o schema global public';
REVOKE ALL ON SCHEMA canone_public FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_subscriber;
COMMENT ON SCHEMA canone_subscriber IS 'Views restritas de assinante — reservado';
REVOKE ALL ON SCHEMA canone_subscriber FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_evidence;
COMMENT ON SCHEMA canone_evidence IS 'Átomos, afirmações, fonte literal e homologação — reservado';
REVOKE ALL ON SCHEMA canone_evidence FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_bridge;
COMMENT ON SCHEMA canone_bridge IS 'Candidatos de fontes externas; integração somente leitura — reservado';
REVOKE ALL ON SCHEMA canone_bridge FROM PUBLIC, anon, authenticated, service_role;
CREATE SCHEMA canone_control;
COMMENT ON SCHEMA canone_control IS 'Registro interno de namespaces, migrations e gates de produção';
REVOKE ALL ON SCHEMA canone_control FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE canone_control.schema_map (
  original_domain text PRIMARY KEY,
  schema_name text NOT NULL UNIQUE CHECK (schema_name ~ '^canone_[a-z_]+$'),
  purpose text NOT NULL,
  state text NOT NULL DEFAULT 'RESERVED_NO_APP_RELEASE' CHECK(state IN ('RESERVED_NO_APP_RELEASE','MIGRATION_TESTED','HOMOLOGATED')), 
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canone_control.migration_catalog (
  migration_number smallint PRIMARY KEY CHECK(migration_number BETWEEN 1 AND 30),
  source_file text NOT NULL UNIQUE CHECK(source_file ~ '^[0-9]{3}_[a-z0-9_]+\.sql$'),
  source_sha256 char(64) NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'NOT_APPLIED' CHECK(status IN ('NOT_APPLIED','PORT_CANDIDATE','QA_READY','APPLIED_TESTED')), 
  original_scope text NOT NULL DEFAULT 'ISOLATED_DATABASE_ORIGINAL',
  verification_note text NOT NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canone_control.release_gate (
  gate_key text PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('HOLD_HUMAN','HOLD_DEPENDENCY','HOLD_SOURCE','NO_GO','PASS_PREVIEW_ONLY')),
  reason text NOT NULL,
  evidence text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canone_control.external_source_binding (
  source_key text PRIMARY KEY,
  origin_schema text NOT NULL,
  origin_relation text NOT NULL,
  access_mode text NOT NULL DEFAULT 'READ_ONLY_NOT_CONNECTED' CHECK (access_mode IN ('READ_ONLY_NOT_CONNECTED','READ_ONLY_VERIFIED','DISABLED')),
  grant_status text NOT NULL DEFAULT 'NONE' CHECK (grant_status IN ('NONE','APPROVED')),
  justification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('identity', 'canone_identity', 'Identidade e LGPD — reservado, sem tabelas operacionais ainda');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('editorial', 'canone_editorial', 'Conteúdo, metamodelo e revisão — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('taxonomy', 'canone_taxonomy', 'Blueprint, provas e conhecimentos — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('norms', 'canone_norms', 'Fontes normativas e vigência — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('learning', 'canone_learning', 'Questões, simulados, SRS e progresso — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('commerce', 'canone_commerce', 'Assinaturas, cobrança e entitlement — DESATIVADO');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('admin', 'canone_admin', 'Comander e governança administrativa — DESATIVADO');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('ops', 'canone_ops', 'Orquestração, integrações e jobs — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('audit', 'canone_audit', 'Trilha de auditoria somente acréscimo — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('public', 'canone_public', 'Views públicas do Cânone; NÃO é o schema global public');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('subscriber', 'canone_subscriber', 'Views restritas de assinante — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('evidence', 'canone_evidence', 'Átomos, afirmações, fonte literal e homologação — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('bridge', 'canone_bridge', 'Candidatos de fontes externas; integração somente leitura — reservado');
INSERT INTO canone_control.schema_map (original_domain,schema_name,purpose) VALUES ('control', 'canone_control', 'Registro interno de namespaces, migrations e gates de produção');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (1, '001_schemas_roles.sql', '7fc94c1549725619578b8d1599c4556b28195287f85f69dc1339876bcea66380', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (2, '002_identity_lgpd.sql', 'fd1f0491a7e697d14ba80265825ca360069016e9d3e1437de110c2328c263623', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (3, '003_metamodel.sql', '9f8c972db65d8f59646fb5b4643c929047cd04e7a73dd5c788b68a6a535dc953', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (4, '004_taxonomy_blueprint.sql', 'ceeb6cc129d5fe7c2ee6d8e7a126c349fa0d0a50f82732d8d5e32ad3d0dd0473', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (5, '005_norms.sql', 'a1926ea47776e642e9d10cd0cf9c8a8102d88c4d3d49af0f5580e95a4e75f75c', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (6, '006_learning_items.sql', '55417f64192b8b4e5081416c2b874f207bedaf011fd2670e38e1f37bc5c75031', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (7, '007_learning_srs.sql', 'd9bb2e97b45b050b24304d89973b4ac284b62f6dff4952a94dd9f4d108e3c545', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (8, '008_commerce.sql', 'b5abc75dde4e6183b2ff77232cd87686b37538e632a84b8ff885d117e7c80d60', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (9, '009_admin_governance.sql', '08b1e347fef09fba4b2a76ed8f86b5e330b942607e599cdef3952b74422825e8', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (10, '010_ops_platform.sql', '3d8c5eee7c68f9b6379742bd997071ea114c8e249805fa2869ecf2cfdbfbc336', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (11, '011_triggers_integridade.sql', '5a054634c6255348d5a17942845cab44a6ed494e105af726e14b3c2f0f1040ec', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (12, '012_srs_engine.sql', 'aa5152379aecb2184b6976aa24231676770afe80bb38e6bb5bdba4769f066a55', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (13, '013_views.sql', '2ff3c3099a1ed84b7b5f323e2e14658e33934387b3bcd56e4f1c01d344815af9', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (14, '014_rls.sql', '0c573777de58467dca107992f4138e944142c977669854fa35636d035a4c255e', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (15, '015_indexes.sql', 'ad0f15f76752463541b84897cc35b758588c208676db2ae8f67bbaab91ad8bca', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (16, '016_seed_reference.sql', 'd9424b0f09ab43ead5645c351ec5352123795e4e07a41ec7ca36047b607d5236', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (17, '017_privileges.sql', 'fd65e114c8dfdcfb929e5591f628dd8dfba6a3e06ffca6cd5d806cc71a1a7d30', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (18, '018_provas_gabarito.sql', 'a1088083d3f0c8aa5d534c1e272ec85fc0c8a151832e4964e5ab939c6799f6a8', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (19, '019_tentativa_ingestao.sql', 'c01f383f23b2189e889e4a8bf919cd5d3bcc252c6828349764775de38fb44989', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (20, '020_tipo_conteudo_versao.sql', 'bf7f90337133fefe7e4767e24eaaf5fcbc86dbf68ae1bef1de0d938459268223', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (21, '021_letra_derivada.sql', 'f54fc8737efd8ad5d3a1010a7f87a2110a664e4cb932f026d76cca26323a7457', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (22, '022_prova_selada_letra_inteira.sql', '574ab76731ecc12e3a52570a47a4f515b9b46a9d9453dd924932ce783a292123', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (23, '023_tres_fechos_do_qa.sql', '6c980bc5f350f3732539c8df562a071d1c25c34e1a353bad22c5300a229ab5c4', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (24, '024_gabarito_imutavel_regua_fixa.sql', 'f22d52a205deaf04b05a0c039ef9de2061143f05d958723455935c8007d23f44', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (25, '025_identity_usage.sql', '7adf620c6a8f034fef6f3fbbdc0f46ad4b74dbf5791656feebb8a688269e9287', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (26, '026_staff_le_gabarito_default_zero.sql', 'bd0dbdc91f73ab5d2c483168a09c5905105cc2e121ce02c3f8f9f5bd3202cc9f', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (27, '027_papel_de_sistema.sql', 'e41567d42c136528918c1c3c45662e666697c93c5518f4793aae2e0bb772d6ff', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (28, '028_preco_comercial.sql', 'ad022430bcec9e54a31441dfe790da92766e546a6b1600dcb10d0a2a6888222f', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (29, '029_papel_de_acesso.sql', '004fa9caa52b13e85eb53949f9c419e9aeaabc098157eadd24a4e080062355a4', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.migration_catalog (migration_number, source_file, source_sha256, verification_note) VALUES (30, '030_porta_da_prova.sql', '144e11ea0c873bfa7f8f7b460a49f51fada2b5cd4d1f1d4424b51938fcaf2c0b', 'Não aplicada no projeto compartilhado; exige portabilidade dos schemas, owner, roles e RLS.');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('frontend_preview', 'PASS_PREVIEW_ONLY', 'Frontend protegido e build TypeScript/Vite aprovados; sem backend.', 'Vercel deployment dpl_FrnQqB8NNZpPYmNwYu8v3DhCyGDg');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('domain_migrations', 'HOLD_DEPENDENCY', 'As migrations 001-030 ainda se referem a schemas genéricos; não migrar no banco compartilhado antes de adaptar/testar.', 'backend/db/migrations/001-030');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('backend_identity', 'HOLD_HUMAN', 'Sem backend autenticado e autorização por roles comprovada.', 'MARCO_S4_VITE6_AUDITORIA_LOCKFILE_2026-11-14.md');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('regulatory_evidence', 'HOLD_SOURCE', 'CFC e Senado não tiveram bytes/documentos integralmente atestados e validados.', '249 trios CFC, 28 referências Senado candidatas');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('commercial', 'NO_GO', 'Checkout, planos e faturamento não homologados e inativos.', 'Frontend preview-only S4');
INSERT INTO canone_control.release_gate (gate_key,status,reason,evidence) VALUES ('prod_release', 'NO_GO', 'Nenhum gate de produção completo; sem acesso HTTP direto aos schemas.', 'PMO S4 e S5');
INSERT INTO canone_control.external_source_binding (source_key,origin_schema,origin_relation,justification) VALUES ('audit_educa_cfc_sources', 'contabilidade_cfc', 'sources', 'Registro Audit Educa; somente leitura, sem replicação automática.');
INSERT INTO canone_control.external_source_binding (source_key,origin_schema,origin_relation,justification) VALUES ('audit_educa_cfc_questions', 'contabilidade_cfc', 'questions', 'Questões CFC em origem separada; não migrar sem validação e direitos.');
INSERT INTO canone_control.external_source_binding (source_key,origin_schema,origin_relation,justification) VALUES ('audit_educa_regulatory', 'public', 'regulatory_instruments', 'Instrumentos regulatórios existentes; candidato a crosswalk por chave externa.');
ALTER TABLE canone_control.schema_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_control.schema_map FORCE ROW LEVEL SECURITY;
REVOKE ALL ON canone_control.schema_map FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE canone_control.migration_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_control.migration_catalog FORCE ROW LEVEL SECURITY;
REVOKE ALL ON canone_control.migration_catalog FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE canone_control.release_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_control.release_gate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON canone_control.release_gate FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE canone_control.external_source_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_control.external_source_binding FORCE ROW LEVEL SECURITY;
REVOKE ALL ON canone_control.external_source_binding FROM PUBLIC, anon, authenticated, service_role;
-- Nenhuma policy de acesso criada: a Data API não está autorizada a usar o Cânone.
-- Nenhum GRANT foi concedido a anon/authenticated/service_role nem houve DDL fora de canone_*.
COMMIT;
