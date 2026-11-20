#!/usr/bin/env python3
"""Generate the audited Cânone S22 -> Supabase canonical crosswalk.

Pure standard-library; hashes source migrations before mapping, reads no secrets,
does not connect to Postgres or apply SQL. Never infers production approval.

Usage:
  python3 tools/canone_supabase_crosswalk.py --root . --write
  python3 tools/canone_supabase_crosswalk.py --root . --check
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

VERSION = '0.23.0-alpha.2'
MANIFEST_PATH = 'source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json'
SQL_DIR = 'source-s22/backend/db/migrations'
OUT = 'crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json'

# Supabase Auth owns credentials and sessions. App metadata/roles never derive
# authorization from raw_user_meta_data, client headers or app.current_user_id.
IDENTITY_CROSSWALK = [
    dict(legacy='identity.account.id', target='auth.users.id', strategy='managed_identity_fk',
         detail='Keep UUID as identity link, not a writable replica of auth.users.'),
    dict(legacy='identity.account.email', target='auth.users.email', strategy='supabase_auth_managed',
         detail='Read through authorized server API or approved private RPC; no duplicate credential store.'),
    dict(legacy='identity.account.password_hash', target='Supabase Auth', strategy='retire_legacy_credential',
         detail='Never import passwords, password hashes, OTPs or magic-link tokens as rows.'),
    dict(legacy='identity.account.status', target='Supabase Auth + canone_identity.user_profile', strategy='split_auth_and_app_state',
         detail='Account bans are controlled by Auth; student onboarding state belongs to app domain.'),
    dict(legacy='identity.user_profile.user_id', target='auth.users.id', strategy='foreign_key',
         detail='Application profile uses UUID FK to auth.users; no direct public grant on auth.users.'),
    dict(legacy='identity.user_role', target='canone_identity.user_role', strategy='protected_role_registry',
         detail='Server-enforced grant authority; never trust raw_user_meta_data or client-supplied role.'),
    dict(legacy='identity.session', target='Supabase Auth session', strategy='replace_auth_runtime',
         detail='App-specific study sessions remain distinct from authentication sessions.'),
    dict(legacy='identity.magic_link', target='Supabase Auth OTP/magic link', strategy='replace_auth_runtime',
         detail='Supabase Auth owns login token generation, expiry and redemption.'),
    dict(legacy='ops.current_user_id()', target='auth.uid()', strategy='jwt_identity_in_rls',
         detail='No client-writable current_user_id GUC may determine row ownership.'),
    dict(legacy='ops.current_area() / ops.is_staff()', target='canone_identity.role grants and trusted JWT app_metadata', strategy='signed_roles_and_db_lookup',
         detail='Use server-managed grants/roles with fresh DB check for sensitive writes.'),
]

ROLE_CROSSWALK = [
    dict(legacy='canone_public', target='anon', plane='data_api', rule='Public approved projections only; RLS-enabled tables.'),
    dict(legacy='canone_subscriber', target='authenticated', plane='data_api', rule='Enforce auth.uid() = owner_id; role alone is insufficient.'),
    dict(legacy='canone_staff', target='authenticated + canone_identity.user_role', plane='authorization', rule='Validate staff rights in protected role registry; no open staff grants.'),
    dict(legacy='canone_admin', target='authenticated + canone_identity.user_role', plane='authorization', rule='Server-admin claims and DB verification; guard privileged functions.'),
    dict(legacy='canone_app', target='backend server with user JWT', plane='runtime', rule='For user requests use user JWT, not service_role; avoid SET ROLE per request.'),
    dict(legacy='canone_system', target='least-privilege function owner', plane='server', rule='SECURITY DEFINER only for approved functions, fixed search_path, revoke PUBLIC execute.'),
    dict(legacy='canone_auth', target='Supabase Auth', plane='authentication', rule='Replace legacy magic-link/session flow rather than granting broad identity access.'),
    dict(legacy='canone_migrator', target='migration owner via isolated CLI/staging', plane='migration', rule='Only release automation has DDL authority; not anon/authenticated.'),
    dict(legacy='service_role', target='server-only service_role', plane='platform', rule='Never expose to browser or use as blanket runtime bypass.'),
]

# Transformation classes. These are actionable engineering outcomes rather
# than unqualified HOLDs. They do NOT mean that a migration can run as-is.
SPECIAL = {
  1: ('platform_bootstrap', 'Replace legacy CREATE ROLE/SCHEMA/EXTENSION with isolated canone_* schema provisioning, supported extension setup and platform-owned roles.'),
  2: ('supabase_auth_bridge', 'Move credentials/session/OTP to Supabase Auth; profiles/consent remain in canone_identity with auth.users UUID references.'),
  3: ('domain_ddl', 'Project editorial metamodel into canone_editorial; preserve foreign-key integrity and editorial provenance.'),
  4: ('domain_ddl', 'Project CFC exam blueprint into canone_taxonomy.'),
  5: ('domain_ddl', 'Project normative records into canone_norms; verify source and rights for actual content ingestion.'),
  6: ('learning_ddl', 'Project learning items with ownership and non-disclosure boundaries.'),
  7: ('learning_ddl', 'Project SRS to canone_learning with JWT-based user ownership.'),
  8: ('commerce_feature_off', 'Project commerce schema but keep payment connectors and live entitlements disabled until signed tests.'),
  9: ('governance_ddl', 'Project admin and audit domains with strong separation of duties.'),
  10: ('platform_runtime', 'Project operational domain without client-controlled identity/session GUC authorization.'),
  11: ('trigger_review', 'Rewrite dynamic SQL schema references in triggers and pin search_path where necessary.'),
  12: ('learning_runtime', 'Validate SRS server-side functions with authenticated user ownership.'),
  13: ('view_invoker', 'Project canone_public/canone_subscriber views with security_invoker=true and approved grants.'),
  14: ('rls_policy', 'Convert legacy canone_* role policies to anon/authenticated and verified staff RBAC, WITH CHECK on writes.'),
  15: ('indexes', 'Project indexes against canone_* objects and ensure extension availability.'),
  16: ('reference_seed', 'Import only rights-cleared reference seeds; no sensitive or third-party source texts.'),
  17: ('least_privilege_grants', 'Replace grants to custom runtime roles with explicit scoped Supabase access; never revoke platform public globally.'),
  18: ('exam_question_key', 'Separate public question fields from protected answer keys, subject to approved edition/source.'),
  19: ('attempt_backend', 'Move attempt ingestion to server-authoritative user identity and idempotent endpoints; deny key oracle.'),
  20: ('content_versioning', 'Project content types/versions and publication-state checks.'),
  21: ('answer_derivation', 'Restrict derived answer logic to privileged server runtime.'),
  22: ('exam_seal', 'Require validated exam seal, immutable key provenance and authorized attempt.'),
  23: ('editorial_review', 'Implement QA dual verification and lineage gates in server-only functions.'),
  24: ('immutable_key', 'Make answer key immutable and prevent disclosure via direct select or implicit RPC.'),
  25: ('identity_grants', 'Replace identity schema grants with Supabase Auth and minimum profile access.'),
  26: ('staff_key_access', 'Review staff access through controlled RPC and prevent direct answer-key reads.'),
  27: ('definer_owner', 'Replace legacy canone_system setup with least-privilege function owners and fixed search_path.'),
  28: ('commerce_feature_off', 'Retain price logic as disabled candidate; no billing activation.'),
  29: ('supabase_auth_bridge', 'Replace canone_auth role and auth_full policy with Supabase Auth-managed OTP/session flow.'),
  30: ('exam_entry_gate', 'Use server-validated subscriber entitlement and user JWT before exam delivery.'),
}

# These three source tables are *superseded* by managed Auth, not recreated.
# A direct name replacement of identity.session -> auth.sessions is also unsafe:
# Supabase owns schema, columns and lifecycle; use its SDK/API contract.
MANAGED_AUTH_TABLES = {
    'identity.account': ('auth.users', 'managed_supabase_auth'),
    'identity.session': ('Supabase Auth sessions API', 'managed_supabase_auth'),
    'identity.magic_link': ('Supabase Auth OTP API', 'managed_supabase_auth'),
}

DEPENDENCIES = [
 dict(source='contabilidade_cfc.audit_normative_scope_v1.instrument_id',
      legacy_target='public.regulatory_instruments.instrument_id',
      destination='canone_bridge.source_binding (planned)', method='reference_only',
      action='Create owned source-reference contract; do not copy public.regulatory_instruments wholesale.'),
 dict(source='contabilidade_cfc.audit_normative_segment_drafts_v1.parent_unit_id',
      legacy_target='account_palm.normalized_units_v1.normalized_unit_id',
      destination='canone_bridge.source_binding (planned)', method='reference_only',
      action='Retain provenance and external UID with version/hash; import only licensed derived content.'),
 dict(source='contabilidade_cfc.audit_normative_segment_parent_qa_v1.parent_unit_id',
      legacy_target='account_palm.normalized_units_v1.normalized_unit_id',
      destination='canone_bridge.source_binding (planned)', method='reference_only',
      action='Resolve normalized unit contract, not complete account_palm corpus.'),
]

RULES = [
 dict(source='CREATE SCHEMA identity/editorial/.../public', target='CREATE SCHEMA canone_*', action='namespace',
      controls='Never mutate global public/auth/storage schemas.'),
 dict(source='CREATE ROLE / SET ROLE canone_*', target='Supabase platform roles and restricted DB ownership', action='role',
      controls='No SET ROLE by user request, no privilege inheritance from client input.'),
 dict(source='identity.account / identity.session / identity.magic_link', target='auth.users / Supabase Auth', action='auth',
      controls='No duplicate password/OTP/session tables in live auth flow.'),
 dict(source='SET LOCAL app.current_user_id', target='auth.uid() in RLS', action='identity',
      controls='Reject client-controlled GUC as ownership authority.'),
 dict(source='CREATE POLICY FOR ALL TO canone_subscriber', target='TO authenticated WITH owner predicate', action='rls',
      controls='USING and WITH CHECK for mutation; never TO authenticated alone.'),
 dict(source='SECURITY DEFINER', target='least privilege owner + pinned search_path + REVOKE EXECUTE', action='definer',
      controls='Do not create public RPC wrappers with implicit access to keys/PII.'),
 dict(source='CREATE VIEW', target='CREATE VIEW WITH (security_invoker=true)', action='view',
      controls='Verify access to referenced tables; schema not exposed unless intended.'),
 dict(source='citext/pg_trgm/btree_gist', target='supported extensions schema', action='extension',
      controls='Install only required supported extensions via controlled migration; no global search_path assumptions.'),
 dict(source='CFC/Contabilidade shared foreign keys', target='canone_bridge reference contract', action='external_reference',
      controls='Never copy CE/CKO shared data or normative copyrighted text by name similarity.'),
]

# Lexical numbers are indicative only, not full SQL parse. Test separately.
COUNTS = {
    'create_table': r'(?im)^\s*CREATE\s+TABLE\b',
    'create_policy': r'(?im)^\s*CREATE\s+POLICY\b',
    'security_definer_mentions': r'(?i)SECURITY\s+DEFINER',
    'create_view': r'(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b',
}

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def build(root: Path) -> dict:
    base = root / SQL_DIR
    m = json.loads((root / MANIFEST_PATH).read_text(encoding='utf-8'))
    maps = m['schemas']
    assert len(maps) == 14
    names = [x['old'] for x in maps]
    assert len(set(names)) == 14
    assert all(x['new']=='canone_'+x['old'] for x in maps)
    records = []
    source_names = []
    sql_refs = {}
    objects = []
    seen_objects = set()
    for number, item in enumerate(m['original_migrations'], 1):
        fn = item['file']
        assert re.match(r'^\d{3}_[a-z0-9_]+\.sql$', fn) and int(fn[:3]) == number
        raw = (base / fn).read_bytes()
        assert digest(raw) == item['sha256'], f'Original changed: {fn}'
        s = raw.decode('utf-8')
        legacy_refs = sorted({a for a in names if re.search(r'\b'+re.escape(a)+r'\s*\.',s)})
        sql_refs[fn] = legacy_refs
        category, action = SPECIAL[number]
        # Exhaustive table-level lineage of the 90 S22 physical table DDLs.
        # Explicitly identify Auth-owned replacements, not phantom app tables.
        for legacy_schema, table in re.findall(
                r'(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]\w*)\.([a-z_]\w*)',s):
            source_table=f'{legacy_schema}.{table}'
            assert legacy_schema in names, 'unknown S22 source schema '+source_table
            assert source_table not in seen_objects, 'duplicate source DDL '+source_table
            seen_objects.add(source_table)
            replacement=MANAGED_AUTH_TABLES.get(source_table)
            objects.append({
                'source_table':source_table,
                'source_migration':fn,
                'target':replacement[0] if replacement else 'canone_'+legacy_schema+'.'+table,
                'strategy':replacement[1] if replacement else 'app_owned_schema_projection',
                'create_in_canonical_db':replacement is None,
            })
        account_refs = len(re.findall(r'(?i)\bREFERENCES\s+identity\.account\s*\(',s))
        records.append({
           'number':number, 'source': fn, 'source_sha256':item['sha256'],
           'original_retained_unchanged': True, 'legacy_schemas_referenced':legacy_refs,
           'target_schemas':sorted({'canone_'+a for a in legacy_refs}),
           'workstream':category, 'transformation_rule':action,
           'auth_users_fk_replacements_required':account_refs,
           'review_stats':{k:len(re.findall(v,s)) for k,v in COUNTS.items()},
           'readiness':'MAPPED_TO_PLATFORM_CONTRACT',
           'deployment_state':'NOT_APPLIED',
        })
        source_names.append(fn)
    assert len(records)==30 and len(source_names)==len(set(source_names))
    assert len(objects)==90 and len(seen_objects)==90, 'physical S22 table catalog changed from 90'
    assert sum(not x['create_in_canonical_db'] for x in objects)==3
    assert sum(x['auth_users_fk_replacements_required'] for x in records)==43, 'identity.account FK count drift'
    return {
      'version': VERSION,
      'scope': 'crosswalk and actionable porting plan; no SQL execution, no connection, no app release',
      'source_baseline': {'git_source':'source-s22', 'historical_commit':'164fa4df8e99de29e35c41d35a25f6ee0b2c6462', 'count':30},
      'target_platform': 'Supabase managed Auth + PostgreSQL 17, separate Cânone project',
      'target_schemas_count': 14,
      'source_tables_count':len(objects),
      'supabase_auth_managed_replacements':3,
      'canonical_app_tables_to_project':len(objects)-3,
      'auth_user_fk_replacements':sum(x['auth_users_fk_replacements_required'] for x in records),
      'table_crosswalk':objects,
      'schemas':maps,
      'roles':ROLE_CROSSWALK,
      'auth_identity':IDENTITY_CROSSWALK,
      'transform_rules':RULES,
      'migrations':records,
      'shared_foreign_key_bindings':DEPENDENCIES,
      'shared_db_policy': 'reference_or_license_review_only_no_blind_data_copy',
      'ci_contract':'map-all-30, sha-all-30, no-write, test security boundaries',
      'next_actions': ['Generate protected PostgreSQL staging candidate from S22/S13/S22 overlays',
          'Replace legacy auth runtime with Supabase Auth identity and session flow',
          'Rewrite privileged RLS/grants with explicit least privilege',
          'Run PG17 disposable + two-user adversarial tests and restore exercise',
          'Only then apply versioned staging migrations on the new isolated project'],
      'production_gate':'NO_GO', 'changes_to_shared_supabase':False,
    }

def render_md(c: dict) -> str:
    a=[
        '# Crosswalk Cânone S22 → padrão Supabase/PostgreSQL',
        '',f"**Versão:** {c['version']} · **30/30 migrations mapeadas** · 14 schemas · **produção NO-GO**.",
        '', 'Este é um crosswalk de engenharia **executável como validador, não como SQL de produção**. Não adiciona HOLD artificial à documentação/correção; riscos técnicos viram regras concretas e testes. Nada foi executado no Supabase compartilhado.',
        '', '## Schemas', '', '| Legado S22 | Canônico Cânone |','|---|---|'
    ]
    a += [f"| `{x['old']}` | `{x['new']}` |" for x in c['schemas']]
    a += ['','**Importante:** `public` no legado é a área de vitrine do Cânone; **não** é autorização para criar ou alterar objetos no `public` global do Supabase. A vitrine vira `canone_public`, com exposição explicitamente configurada se necessário. `auth`/`storage` são gerenciados pela plataforma.',
          '', '## Papéis e acesso', '', '| Papel legado | Padrão alvo | Regra de controle |','|---|---|---|']
    a += [f"| `{x['legacy']}` | {x['target']} | {x['rule']} |" for x in c['roles']]
    a += ['','## Identidade (sem duplicar Auth)', '', '| Fonte legada | Destino | Técnica |','|---|---|---|']
    a += [f"| `{x['legacy']}` | {x['target']} | {x['strategy']} |" for x in c['auth_identity']]
    a += ['','**Atenção:** o schema `canone_identity` guarda perfil, papel e consentimento; **credenciais, OTP e sessões de login** pertencem ao Supabase Auth. A substituição exige alteração do backend; não existe migração segura que simplesmente renomeie `identity.account` para `auth.users`.',
           '', '## Crosswalk de todas as migrations', '', '| # | SQL origem preservado | Estratégia | Principal transformação |','|---:|---|---|---|']
    a += [f"| {x['number']:03d} | `{x['source']}` | `{x['workstream']}` | {x['transformation_rule']} |" for x in c['migrations']]
    a += ['','## Crosswalk físico de tabelas — 90/90', '',
          'Das 90 tabelas físicas definidas pelo S22, **87** são candidatas a tabelas próprias em schemas `canone_*` e **3** tabelas de autenticação são substituídas pelo serviço Supabase Auth, nunca recriadas. Existem **43 referências a `identity.account`** que precisam apontar para a identidade gerenciada `auth.users` via FK validada.',
          '', '| Tabela S22 | Destino padrão | Tratamento |', '|---|---|---|']
    a += [f"| `{x['source_table']}` | `{x['target']}` | `{x['strategy']}` |" for x in c['table_crosswalk']]
    a += ['','## Dependências com estruturas compartilhadas (não copiar integralmente)', '', '| Origem | FK anterior | Estratégia canônica |','|---|---|---|']
    a += [f"| `{x['source']}` | `{x['legacy_target']}` | {x['destination']} — {x['method']} |" for x in c['shared_foreign_key_bindings']]
    a += ['','## Pipeline de conclusão sem bloqueios artificiais','',
          '1. **Agora:** o gerador valida e cataloga **30/30 fontes pelos hashes** e cria um contrato canônico versionado. Não precisa de novo Supabase.',
          '2. **Saneamento de código:** usar os overlays S11/S12/S22 já testados como candidatos, substituir o fluxo Auth legado e corrigir RLS/grants/definers por contrato. Continuar as microtarefas mesmo com fontes editoriais ainda em revisão.',
          '3. **Banco isolado:** comparar modelo-alvo em PG17 descartável com fixtures sintéticas, testes A/B, backup e restore.',
          '4. **Supabase exclusivo:** quando o projeto existir, executar staging das migrations derivadas aprovadas, por lote e com rollback; não copiar schemas CE/CKO.',
          '5. **Produto:** conteúdo Exame de Suficiência e EQT com fontes e direitos; aprovação operacional continua independente do desenvolvimento.',
          '', '## CI e versionamento na main', '',
          'Rodar `python3 tools/canone_supabase_crosswalk.py --root . --check` e `python3 -m unittest discover -s tests -p "test_canone_crosswalk.py"`. Ambos são somente leitura. `--write` atualiza exclusivamente JSON e Markdown de crosswalk, sem criar SQL executável. Versão `0.23.0-alpha.2` está documentada, **não é um release em produção**.',
          '', '**Referências oficiais:** https://supabase.com/docs/guides/auth/managing-user-data · https://supabase.com/docs/guides/database/postgres/roles · https://supabase.com/docs/guides/database/postgres/row-level-security.']
    return '\n'.join(a)+'\n'

def main(argv=None) -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path('.'))
    g=p.add_mutually_exclusive_group(required=True)
    g.add_argument('--write',action='store_true')
    g.add_argument('--check',action='store_true')
    args=p.parse_args(argv)
    try:
        root=args.root.resolve()
        c=build(root)
        out=root/OUT;md=root/'docs/CROSSWALK_PADRAO_SUPABASE_0_23_0_ALPHA2.md'
        data=json.dumps(c,ensure_ascii=False,sort_keys=True,indent=2)+'\n'
        content=render_md(c)
        if args.write:
            out.parent.mkdir(parents=True,exist_ok=True)
            md.parent.mkdir(parents=True,exist_ok=True)
            out.write_text(data,encoding='utf-8');md.write_text(content,encoding='utf-8')
        else:
            assert out.read_text(encoding='utf-8')==data, 'JSON crosswalk drift'
            assert md.read_text(encoding='utf-8')==content, 'MD crosswalk drift'
        print(json.dumps({'status':'PASS_CROSSWALK','mode':'WRITE' if args.write else 'CHECK',
                          'migrations':len(c['migrations']), 'schemas':len(c['schemas']),
                          'source_tables':len(c['table_crosswalk']), 'target_app_tables':c['canonical_app_tables_to_project'],
                          'auth_fk_rewrites':c['auth_user_fk_replacements'],
                          'roles':len(c['roles']), 'auth_mappings':len(c['auth_identity']),
                          'shared_cross_schema_fk':len(c['shared_foreign_key_bindings']),
                          'production_gate':c['production_gate']},ensure_ascii=False))
        return 0
    except (OSError,ValueError,AssertionError,KeyError,json.JSONDecodeError) as e:
        print(json.dumps({'status':'FAIL_CROSSWALK','error':str(e),'production_gate':'NO_GO'},ensure_ascii=False),file=sys.stderr)
        return 2

if __name__=='__main__': sys.exit(main())
