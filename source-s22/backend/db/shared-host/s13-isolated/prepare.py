#!/usr/bin/env python3
"""S13: verify S11/S12 provenance and stage SQL ONLY for a disposable local container.

No network or database connection is used by this program. Artifacts from S12
remain review-only. This is an experiment generator, never a deployment runner.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

DIR=Path(__file__).resolve().parent
ROOT=DIR.parents[3]
S11=ROOT/'backend/db/shared-host/generated/s11-review-only'
S12=ROOT/'backend/db/shared-host/s12-review'
MANIFEST=ROOT/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json'
MIG=ROOT/'backend/db/migrations'
SUBSET=tuple(range(2,18))
S12_SET={6,7,8,9,10,11,12,13,14,17}
DB='canone_s13_disposable'

def digest(raw):return hashlib.sha256(raw).hexdigest()
def insist(cond,message):
    if not cond:raise ValueError('S13_HOLD_SOURCE: '+message)

def verify():
    manifest=json.loads(MANIFEST.read_text())
    srcfiles=manifest['original_migrations']
    insist(len(srcfiles)==30,'30 source migrations required')
    assert_set=set()
    for j,item in enumerate(srcfiles,1):
        insist(int(item['file'][:3])==j,'unexpected migration sequence')
        raw=(MIG/item['file']).read_bytes()
        insist(digest(raw)==item['sha256'],'original changed: '+item['file'])
        assert_set.add(item['file'])
    insist(len(assert_set)==30,'duplicate migration names')
    s12=json.loads((S12/'S12_MANIFEST.json').read_text())
    insist(s12['production_gate']=='HOLD_HUMAN_NO_GO' and s12['live_executable_count']==0,'S12 authorization unexpected')
    for item in s12['items']:
        f=S12/'reviews'/f"S12_REVIEW_ONLY_{item['file']}.txt"
        insist(digest(f.read_bytes())==item['s12_candidate_sha256'],'candidate changed: '+item['file'])
    insist({i['migration'] for i in s12['items']}==S12_SET,'review set changed')
    # Operational scripts and secrets are explicitly excluded from this process.
    return {'source':30,'review_candidates':10,'source_sha256_ok':True,'s12_sha256_ok':True,
            'only_disposable':True,'postgresql_test':'NOT_RUN','production_gate':'NO_GO'}

def strip_review(file,n):
    if n in S12_SET:
        raw=(S12/'reviews'/f'S12_REVIEW_ONLY_{file}.txt').read_text()
        insist(raw.startswith('-- S12 CANDIDATE FOR HUMAN REVIEW ONLY'),'missing S12 review guard')
        start=raw.find('-- =============================================================================')
    else:
        raw=(S11/f'REVIEW_ONLY_{file}.txt').read_text()
        insist(raw.startswith('-- GENERATED FOR AUDIT ONLY'),'missing S11 review guard')
        start=raw.find('-- =============================================================================')
    insist(start>=0,'SQL section not found: '+file)
    return raw[start:]

def guard():
    # This SQL is never given a DB URL; it can run only in the disposable DB
    # pre-created by the local docker runner, with the marker created there.
    return """DO $s13_guard$
BEGIN
  IF current_database() <> 'canone_s13_disposable' OR
     to_regclass('s13_sentinel.disposable_marker') IS NULL OR
     (SELECT count(*) FROM s13_sentinel.disposable_marker WHERE marker='s13-verified') <> 1
  THEN RAISE EXCEPTION 'S13 REFUSED: not a disposable local database'; END IF;
END $s13_guard$;
"""

def bootstrap():
    orig=(MIG/'001_schemas_roles.sql').read_text()
    start=orig.index('CREATE OR REPLACE FUNCTION ops.current_user_id()')
    functions=orig[start:]
    insist('CREATE OR REPLACE FUNCTION ops.is_staff()' in functions,'001 function baseline absent')
    # Reuse original functions and their original signatures; only namespace is changed.
    functions=re.sub(r'\bops\.', 'canone_ops.',functions)
    names=json.loads(MANIFEST.read_text())['schemas']
    insist(len(names)==14,'S5 14 namespaces required')
    scripts=["-- S13 isolated DB bootstrap, NOT for any real/shared environment.",guard(),
      'CREATE EXTENSION IF NOT EXISTS citext;','CREATE EXTENSION IF NOT EXISTS pg_trgm;',
      'CREATE EXTENSION IF NOT EXISTS btree_gist;']
    for role in ('anon','authenticated','service_role','canone_app','canone_public','canone_subscriber','canone_staff','canone_admin','canone_migrator'):
        scripts.append(f'CREATE ROLE {role} NOLOGIN NOINHERIT;')
    for item in names:
        scripts.append(f"CREATE SCHEMA {item['new']};")
        scripts.append(f"REVOKE ALL ON SCHEMA {item['new']} FROM PUBLIC, anon, authenticated, service_role;")
    scripts.append(functions)
    return '\n'.join(scripts)+'\n'

def prepare(dest:Path):
    verify();insist(dest.is_dir() and not dest.is_symlink(),'existing non-symlink temporary folder required')
    insist(dest.resolve()!=ROOT and ROOT not in dest.resolve().parents,'no output inside source repository')
    # This is not for deployment: fail-closed if a real database reference is present.
    import os
    for key in ('DATABASE_URL','SUPABASE_DB_URL','PGHOST','PGSERVICE'):
        insist(not os.environ.get(key),'external DB variable present: '+key)
    (dest/'001_s13_bootstrap.sql').write_text(bootstrap())
    for n in SUBSET:
        f=next(item['file'] for item in json.loads(MANIFEST.read_text())['original_migrations'] if int(item['file'][:3])==n)
        sql=strip_review(f,n)
        (dest/f).write_text(f'-- S13 DISPOSABLE EXPERIMENT ONLY: migration {n:03d}\n'+guard()+'BEGIN;\n'+sql+'\nCOMMIT;\n')
    return {'staged':17,'from_s11':len(set(SUBSET)-S12_SET),'from_s12':len(set(SUBSET)&S12_SET),'purpose':'LOCAL_DISPOSABLE_ONLY','live_approved':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.add_argument('--stage-disposable',type=Path)
    args=p.parse_args()
    if args.stage_disposable:
        print(json.dumps(prepare(args.stage_disposable),indent=2,ensure_ascii=False))
    else: print(json.dumps(verify(),indent=2,ensure_ascii=False))
