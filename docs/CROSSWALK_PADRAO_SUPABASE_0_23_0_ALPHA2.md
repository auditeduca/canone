# Crosswalk Cânone S22 → padrão Supabase/PostgreSQL

**Versão:** 0.23.0-alpha.2 · **30/30 migrations mapeadas** · 14 schemas · **produção NO-GO**.

Este é um crosswalk de engenharia **executável como validador, não como SQL de produção**. Não adiciona HOLD artificial à documentação/correção; riscos técnicos viram regras concretas e testes. Nada foi executado no Supabase compartilhado.

## Schemas

| Legado S22 | Canônico Cânone |
|---|---|
| `identity` | `canone_identity` |
| `editorial` | `canone_editorial` |
| `taxonomy` | `canone_taxonomy` |
| `norms` | `canone_norms` |
| `learning` | `canone_learning` |
| `commerce` | `canone_commerce` |
| `admin` | `canone_admin` |
| `ops` | `canone_ops` |
| `audit` | `canone_audit` |
| `public` | `canone_public` |
| `subscriber` | `canone_subscriber` |
| `evidence` | `canone_evidence` |
| `bridge` | `canone_bridge` |
| `control` | `canone_control` |

**Importante:** `public` no legado é a área de vitrine do Cânone; **não** é autorização para criar ou alterar objetos no `public` global do Supabase. A vitrine vira `canone_public`, com exposição explicitamente configurada se necessário. `auth`/`storage` são gerenciados pela plataforma.

## Papéis e acesso

| Papel legado | Padrão alvo | Regra de controle |
|---|---|---|
| `canone_public` | anon | Public approved projections only; RLS-enabled tables. |
| `canone_subscriber` | authenticated | Enforce auth.uid() = owner_id; role alone is insufficient. |
| `canone_staff` | authenticated + canone_identity.user_role | Validate staff rights in protected role registry; no open staff grants. |
| `canone_admin` | authenticated + canone_identity.user_role | Server-admin claims and DB verification; guard privileged functions. |
| `canone_app` | backend server with user JWT | For user requests use user JWT, not service_role; avoid SET ROLE per request. |
| `canone_system` | least-privilege function owner | SECURITY DEFINER only for approved functions, fixed search_path, revoke PUBLIC execute. |
| `canone_auth` | Supabase Auth | Replace legacy magic-link/session flow rather than granting broad identity access. |
| `canone_migrator` | migration owner via isolated CLI/staging | Only release automation has DDL authority; not anon/authenticated. |
| `service_role` | server-only service_role | Never expose to browser or use as blanket runtime bypass. |

## Identidade (sem duplicar Auth)

| Fonte legada | Destino | Técnica |
|---|---|---|
| `identity.account.id` | auth.users.id | managed_identity_fk |
| `identity.account.email` | auth.users.email | supabase_auth_managed |
| `identity.account.password_hash` | Supabase Auth | retire_legacy_credential |
| `identity.account.status` | Supabase Auth + canone_identity.user_profile | split_auth_and_app_state |
| `identity.user_profile.user_id` | auth.users.id | foreign_key |
| `identity.user_role` | canone_identity.user_role | protected_role_registry |
| `identity.session` | Supabase Auth session | replace_auth_runtime |
| `identity.magic_link` | Supabase Auth OTP/magic link | replace_auth_runtime |
| `ops.current_user_id()` | auth.uid() | jwt_identity_in_rls |
| `ops.current_area() / ops.is_staff()` | canone_identity.role grants and trusted JWT app_metadata | signed_roles_and_db_lookup |

**Atenção:** o schema `canone_identity` guarda perfil, papel e consentimento; **credenciais, OTP e sessões de login** pertencem ao Supabase Auth. A substituição exige alteração do backend; não existe migração segura que simplesmente renomeie `identity.account` para `auth.users`.

## Crosswalk de todas as migrations

| # | SQL origem preservado | Estratégia | Principal transformação |
|---:|---|---|---|
| 001 | `001_schemas_roles.sql` | `platform_bootstrap` | Replace legacy CREATE ROLE/SCHEMA/EXTENSION with isolated canone_* schema provisioning, supported extension setup and platform-owned roles. |
| 002 | `002_identity_lgpd.sql` | `supabase_auth_bridge` | Move credentials/session/OTP to Supabase Auth; profiles/consent remain in canone_identity with auth.users UUID references. |
| 003 | `003_metamodel.sql` | `domain_ddl` | Project editorial metamodel into canone_editorial; preserve foreign-key integrity and editorial provenance. |
| 004 | `004_taxonomy_blueprint.sql` | `domain_ddl` | Project CFC exam blueprint into canone_taxonomy. |
| 005 | `005_norms.sql` | `domain_ddl` | Project normative records into canone_norms; verify source and rights for actual content ingestion. |
| 006 | `006_learning_items.sql` | `learning_ddl` | Project learning items with ownership and non-disclosure boundaries. |
| 007 | `007_learning_srs.sql` | `learning_ddl` | Project SRS to canone_learning with JWT-based user ownership. |
| 008 | `008_commerce.sql` | `commerce_feature_off` | Project commerce schema but keep payment connectors and live entitlements disabled until signed tests. |
| 009 | `009_admin_governance.sql` | `governance_ddl` | Project admin and audit domains with strong separation of duties. |
| 010 | `010_ops_platform.sql` | `platform_runtime` | Project operational domain without client-controlled identity/session GUC authorization. |
| 011 | `011_triggers_integridade.sql` | `trigger_review` | Rewrite dynamic SQL schema references in triggers and pin search_path where necessary. |
| 012 | `012_srs_engine.sql` | `learning_runtime` | Validate SRS server-side functions with authenticated user ownership. |
| 013 | `013_views.sql` | `view_invoker` | Project canone_public/canone_subscriber views with security_invoker=true and approved grants. |
| 014 | `014_rls.sql` | `rls_policy` | Convert legacy canone_* role policies to anon/authenticated and verified staff RBAC, WITH CHECK on writes. |
| 015 | `015_indexes.sql` | `indexes` | Project indexes against canone_* objects and ensure extension availability. |
| 016 | `016_seed_reference.sql` | `reference_seed` | Import only rights-cleared reference seeds; no sensitive or third-party source texts. |
| 017 | `017_privileges.sql` | `least_privilege_grants` | Replace grants to custom runtime roles with explicit scoped Supabase access; never revoke platform public globally. |
| 018 | `018_provas_gabarito.sql` | `exam_question_key` | Separate public question fields from protected answer keys, subject to approved edition/source. |
| 019 | `019_tentativa_ingestao.sql` | `attempt_backend` | Move attempt ingestion to server-authoritative user identity and idempotent endpoints; deny key oracle. |
| 020 | `020_tipo_conteudo_versao.sql` | `content_versioning` | Project content types/versions and publication-state checks. |
| 021 | `021_letra_derivada.sql` | `answer_derivation` | Restrict derived answer logic to privileged server runtime. |
| 022 | `022_prova_selada_letra_inteira.sql` | `exam_seal` | Require validated exam seal, immutable key provenance and authorized attempt. |
| 023 | `023_tres_fechos_do_qa.sql` | `editorial_review` | Implement QA dual verification and lineage gates in server-only functions. |
| 024 | `024_gabarito_imutavel_regua_fixa.sql` | `immutable_key` | Make answer key immutable and prevent disclosure via direct select or implicit RPC. |
| 025 | `025_identity_usage.sql` | `identity_grants` | Replace identity schema grants with Supabase Auth and minimum profile access. |
| 026 | `026_staff_le_gabarito_default_zero.sql` | `staff_key_access` | Review staff access through controlled RPC and prevent direct answer-key reads. |
| 027 | `027_papel_de_sistema.sql` | `definer_owner` | Replace legacy canone_system setup with least-privilege function owners and fixed search_path. |
| 028 | `028_preco_comercial.sql` | `commerce_feature_off` | Retain price logic as disabled candidate; no billing activation. |
| 029 | `029_papel_de_acesso.sql` | `supabase_auth_bridge` | Replace canone_auth role and auth_full policy with Supabase Auth-managed OTP/session flow. |
| 030 | `030_porta_da_prova.sql` | `exam_entry_gate` | Use server-validated subscriber entitlement and user JWT before exam delivery. |

## Dependências com estruturas compartilhadas (não copiar integralmente)

| Origem | FK anterior | Estratégia canônica |
|---|---|---|
| `contabilidade_cfc.audit_normative_scope_v1.instrument_id` | `public.regulatory_instruments.instrument_id` | canone_bridge.source_binding (planned) — reference_only |
| `contabilidade_cfc.audit_normative_segment_drafts_v1.parent_unit_id` | `account_palm.normalized_units_v1.normalized_unit_id` | canone_bridge.source_binding (planned) — reference_only |
| `contabilidade_cfc.audit_normative_segment_parent_qa_v1.parent_unit_id` | `account_palm.normalized_units_v1.normalized_unit_id` | canone_bridge.source_binding (planned) — reference_only |

## Pipeline de conclusão sem bloqueios artificiais

1. **Agora:** o gerador valida e cataloga **30/30 fontes pelos hashes** e cria um contrato canônico versionado. Não precisa de novo Supabase.
2. **Saneamento de código:** usar os overlays S11/S12/S22 já testados como candidatos, substituir o fluxo Auth legado e corrigir RLS/grants/definers por contrato. Continuar as microtarefas mesmo com fontes editoriais ainda em revisão.
3. **Banco isolado:** comparar modelo-alvo em PG17 descartável com fixtures sintéticas, testes A/B, backup e restore.
4. **Supabase exclusivo:** quando o projeto existir, executar staging das migrations derivadas aprovadas, por lote e com rollback; não copiar schemas CE/CKO.
5. **Produto:** conteúdo Exame de Suficiência e EQT com fontes e direitos; aprovação operacional continua independente do desenvolvimento.

## CI e versionamento na main

Rodar `python3 tools/canone_supabase_crosswalk.py --root . --check` e `python3 -m unittest discover -s tests -p "test_canone_crosswalk.py"`. Ambos são somente leitura. `--write` atualiza exclusivamente JSON e Markdown de crosswalk, sem criar SQL executável. Versão `0.23.0-alpha.2` está documentada, **não é um release em produção**.

**Referências oficiais:** https://supabase.com/docs/guides/auth/managing-user-data · https://supabase.com/docs/guides/database/postgres/roles · https://supabase.com/docs/guides/database/postgres/row-level-security.
