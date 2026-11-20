#!/usr/bin/env python3
"""Pure offline checks for a bounded dedicated-Supabase identity bridge candidate.

Does not open database connections, create migrations or claim PG17 compatibility.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

SQL = 'staging/supabase/001_identity_and_source_bridge.candidate.sql.txt'
CROSSWALK = 'crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json'
MANIFEST = 'staging/supabase/CANONE_IDENTITY_BRIDGE_PILOT_MANIFEST.json'
BASELINE = 'source-s22/backend/db/migrations'
TABLES = (
    'canone_identity.user_profile',
    'canone_identity.private_profile',
    'canone_identity.role',
    'canone_identity.user_role',
    'canone_identity.consent_purpose',
    'canone_identity.consent',
    'canone_bridge.source_binding',
)

class CandidateError(ValueError):
    pass


def analyze(root: Path) -> dict:
    root = root.resolve()
    cross = json.loads((root/CROSSWALK).read_text(encoding='utf-8'))
    if cross.get('production_gate') != 'NO_GO' or len(cross['migrations']) != 30:
        raise CandidateError('invalid crosswalk baseline')
    for row in cross['migrations']:
        f = root/BASELINE/row['source']
        if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest() != row['source_sha256']:
            raise CandidateError('unverified source migration: '+row['source'])
    sql = (root/SQL).read_text(encoding='utf-8')
    if 'CREATE SCHEMA canone_identity' not in sql or 'CREATE SCHEMA canone_bridge' not in sql:
        raise CandidateError('missing canonical namespaced schemas')
    creations = re.findall(r'(?im)^CREATE TABLE\s+([a-z_]+\.[a-z_]+)\s*\(', sql)
    if sorted(creations) != sorted(TABLES):
        raise CandidateError('unexpected table set')
    for table in TABLES:
        if f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;' not in sql:
            raise CandidateError('RLS not enabled '+table)
        if f'ALTER TABLE {table} FORCE ROW LEVEL SECURITY;' not in sql:
            raise CandidateError('FORCE RLS missing '+table)
    if len(re.findall(r'(?im)^CREATE POLICY\b', sql)) != 3:
        raise CandidateError('unexpected policy count')
    if any(x not in sql for x in ('(SELECT auth.uid()) = user_id',
                                  'REFERENCES auth.users(id)',
                                  "to_regclass('canone_control.migration_catalog')",
                                  "to_regclass('auth.users')")):
        raise CandidateError('missing authentication or environment contract')
    if re.search(r'(?im)^\s*(?:CREATE|ALTER|DROP)\s+(?:ROLE|EXTENSION)\b',sql):
        raise CandidateError('global role or extension DDL prohibited')
    if re.search(r'(?im)^\s*CREATE TABLE\s+(?:identity|auth|public|storage)\.',sql):
        raise CandidateError('legacy/platform schema DDL prohibited')
    if re.search(r'(?im)^\s*GRANT\s+(?:ALL|.*\b(?:DELETE|TRUNCATE)\b).*\bTO\s+(?:anon|authenticated)',sql):
        raise CandidateError('broad client privileges prohibited')
    if re.search(r'(?is)GRANT\s+[^;]*\b(?:user_role|private_profile|source_binding|consent)\b[^;]*\bTO\s+authenticated',sql):
        raise CandidateError('private table exposed to authenticated')
    if 'SET LOCAL ROLE' in sql or "current_setting('app.current_user_id'" in sql:
        raise CandidateError('untrusted legacy user context')
    if not sql.rstrip().endswith('COMMIT;') or not re.search(r'(?m)^BEGIN;$',sql):
        raise CandidateError('candidate transaction boundary missing')
    return {
        'version':'0.23.0-alpha.3', 'candidate_kind':'dedicated_supabase_identity_bridge',
        'gate':'NO_GO', 'phase':'candidate_review_no_remote_execution',
        'source_migrations_verified':30,
        'source_migrations_modified':0,
        'created_tables':list(TABLES), 'table_count':len(TABLES),
        'client_policy_count':3,
        'auth_managed_legacy_tables_recreated':0,
        'source_sql_sha256':hashlib.sha256(sql.encode('utf-8')).hexdigest(),
        'shared_source_changes':False,
        'engine_test':'not_attested_by_static_check',
        'scope_limitations':['only initial identity/provenance subset, not complete 87 domain tables',
                             'Supabase Auth mock needed for offline PostgreSQL smoke tests',
                             'no migration committed to supabase/migrations until destination environment validated',
                             'private roles and consent have no client write path yet'],
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',type=Path,default=Path('.'))
    m=p.add_mutually_exclusive_group(required=True)
    m.add_argument('--write',action='store_true')
    m.add_argument('--check',action='store_true')
    args=p.parse_args()
    try:
        report=analyze(args.root)
        dest=args.root/MANIFEST
        data=json.dumps(report,indent=2,ensure_ascii=False,sort_keys=True)+'\n'
        if args.write:
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_text(data,encoding='utf-8')
        elif not dest.exists() or dest.read_text(encoding='utf-8') != data:
            raise CandidateError('pilot manifest absent or drifted')
    except (OSError,KeyError,ValueError) as exc:
        print(json.dumps({'status':'FAIL_PILOT','reason':str(exc),'release':'NO_GO'}))
        return 2
    print(json.dumps({'status':'PASS_PILOT_STATIC','tables':report['table_count'],
                      'source_migrations_verified':report['source_migrations_verified'],
                      'release':'NO_GO','engine_test':report['engine_test']}))
    return 0

if __name__=='__main__':
    raise SystemExit(main())
