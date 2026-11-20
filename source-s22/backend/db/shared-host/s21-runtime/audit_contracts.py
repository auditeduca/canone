#!/usr/bin/env python3
"""S21: READ-ONLY canonical backend-vs-review-DDL contracts audit.

A zero-exit `--report` prints findings; `--strict` is the release gate and
returns 41 if unresolved. Never connects to any database, never edits SQL.
"""
import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BACKEND = ROOT / 'backend'
SQL_DIR = BACKEND / 'db' / 'shared-host'
LEGACY = {'identity', 'editorial', 'taxonomy', 'norms', 'learning', 'commerce',
          'admin', 'ops', 'audit', 'subscriber', 'public'}
SQL_KEYWORDS = re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|FROM|JOIN|CALL|VALUES|WITH|RETURNING)\b', re.I)
QUOTED_TEMPLATE = re.compile(r'`(?:\\.|[^`])*`', re.S)
SCHEMA_REF = re.compile(r'\b('+'|'.join(sorted(LEGACY))+r')\.([A-Za-z_][\w]*)\b')
ROLE_REF = re.compile(r"\b(publica|acesso|assinante|staff|admin)\s*:\s*'(canone_[a-z_]+)'")
ROLE_CREATE = re.compile(r'CREATE ROLE (canone_[a-z_]+) NOLOGIN', re.I)

def inspect(root=ROOT):
    backend=root/'backend'
    s=backend/'db/shared-host'
    bootstrap=(root/'backend/db/shared-host/s13-isolated/prepare.py').read_text(encoding='utf-8')
    roles_src=(backend/'src/db/roles.ts').read_text(encoding='utf-8')
    manifest=json.loads((s/'S5_NAMESPACE_MANIFEST.json').read_text(encoding='utf-8'))
    schema_names={x['new'] for x in manifest['schemas']}
    expected_roles=dict(ROLE_REF.findall(roles_src))
    known_roles={x for x in re.findall(r"'\b(canone_[a-z_]+)'",bootstrap)}
    missing_roles=sorted(set(expected_roles.values())-known_roles)
    hits=[]
    for path in sorted((backend/'src').rglob('*.ts')):
        source=path.read_text(encoding='utf-8')
        for template in QUOTED_TEMPLATE.findall(source):
            if not SQL_KEYWORDS.search(template):continue
            for m in SCHEMA_REF.finditer(template):
                hits.append({'file':str(path.relative_to(root)), 'schema':m.group(1), 'object':m.group(2)})
    # Dedup occurrences by file + schema + object, without losing coverage.
    hits=list({(x['file'],x['schema'],x['object']):x for x in hits}.values())
    hits.sort(key=lambda x:(x['file'],x['schema'],x['object']))
    privileged=(s/'s12-review/reviews/S12_REVIEW_ONLY_017_privileges.sql.txt').read_text(encoding='utf-8')
    # SQL review source is generated and checked for integrity separately by S13.
    has_identity_usage=bool(re.search(r'GRANT\s+USAGE\s+ON\s+SCHEMA[^;]*\bcanone_identity\b',privileged,re.I|re.S))
    issues=[]
    if missing_roles: issues.append({'code':'S21-P0-AUTH-ROLE','detail':missing_roles})
    if hits: issues.append({'code':'S21-P0-LEGACY-SCHEMA-SQL','detail':{'count':len(hits)}})
    if not has_identity_usage: issues.append({'code':'S21-P0-IDENTITY-SCHEMA-USAGE','detail':'S12 privilege candidate does not grant USAGE on canone_identity'})
    return {'status':'BLOCKED' if issues else 'CANDIDATE_FOR_DB_AND_SECURITY_TESTS',
            'release_approved':False,'manual_go_required':True,
            'review_schema_count':len(schema_names),'role_mapping':expected_roles,
            'known_bootstrap_roles':sorted(known_roles),'missing_roles':missing_roles,
            'legacy_backend_sql_ref_count':len(hits),'legacy_backend_sql_refs':hits,
            'missing_canone_identity_usage':not has_identity_usage,
            'issues':issues,'no_database_access':True}

if __name__=='__main__':
    arg=argparse.ArgumentParser()
    group=arg.add_mutually_exclusive_group()
    group.add_argument('--strict',action='store_true')
    group.add_argument('--report',action='store_true')
    args=arg.parse_args()
    findings=inspect()
    print(json.dumps(findings,ensure_ascii=False,indent=2))
    if args.strict and findings['status']=='BLOCKED':raise SystemExit(41)
