#!/usr/bin/env python3
"""Reproducible alpha7 audit hash chain and answer-key sealing candidate.

Read-only generator: never connects to Supabase or executes SQL.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

VERSION = '0.23.0-alpha.7'
TEMPLATE = Path('tools/sql_templates/canone_alpha7_audit_seal.sql.txt')
OUTPUT = Path('staging/supabase/008_audit_chain_and_seal.candidate.sql.txt')
MANIFEST = Path('staging/supabase/CANONE_AUDIT_SEAL_ALPHA7_MANIFEST.json')
SOURCE_MANIFEST = Path('source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json')
LEGACY_FILES = ('009_admin_governance.sql', '024_gabarito_imutavel_regua_fixa.sql',
                '022_prova_selada_letra_inteira.sql')

def digest(data:bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def build(root:Path):
    original=json.loads((root/SOURCE_MANIFEST).read_text(encoding='utf-8'))
    assert len(original['original_migrations']) == 30
    byname={x['file']:x for x in original['original_migrations']}
    sources=[]
    for name in LEGACY_FILES:
        data=(root/'source-s22/backend/db/migrations'/name).read_bytes()
        if digest(data)!=byname[name]['sha256']:
            raise ValueError('legacy migration changed: '+name)
        sources.append({'path':name,'sha256':digest(data),'bytes':len(data)})
    # Full original dataset integrity, not merely the three affected files.
    for name,rec in byname.items():
        data=(root/'source-s22/backend/db/migrations'/name).read_bytes()
        if digest(data)!=rec['sha256']:
            raise ValueError('historical migration tampered: '+name)
    template=(root/TEMPLATE).read_text(encoding='utf-8')
    must_have=['pg_advisory_xact_lock', 'SECURITY INVOKER',
         'audit_payload', 'verify_chain', 'BEGIN;', 'REVOKE ALL',
         "IF NEW.status='definitivo'", 'FOR UPDATE OF f',
         'trg_audit_no_truncate', 'REQUIRE_EMPTY_AUDIT_CHAIN_FOR_V2_CUTOVER']
    for needle in must_have:
        if needle not in template:
            raise ValueError('missing security boundary: '+needle)
    disallowed=('SECURITY DEFINER', 'GRANT ALL TO', 'DROP TABLE', 'SET ROLE service_role')
    for x in disallowed:
        if x in template:
            raise ValueError('unsafe SQL token '+x)
    header='-- Generated deterministically; historical source SHA256 verified 30/30.\n'
    for x in sources:
        header+=f"-- source {x['path']} sha256={x['sha256']}\n"
    sql=header+template
    manifest={
      'version':VERSION,'status':'AUDIT_CHAIN_AND_SEAL_CANDIDATE_NO_GO',
      'sources':sources,'source_migrations_verified':30,
      'template_sha256':digest(template.encode('utf8')),
      'sql_sha256':digest(sql.encode('utf8')),
      'audit_hash_version':'canone-audit-v2',
      'audit_fields_covered':['id','seq','occurred_at','actor_id','actor_role',
         'subject_user_id','action','entity_type','entity_id','before','after',
         'request_id','ip_address','user_agent','metadata'],
      'functions_new':['canone_audit.audit_payload','canone_audit.compute_row_hash',
         'canone_audit.set_row_hash','canone_audit.verify_chain'],
      'functions_replaced':['canone_learning.answer_key_status_imutavel',
         'canone_learning.prova_selada_nao_muda'],
      'triggers_new':['trg_audit_chain_insert','trg_audit_no_truncate'],
      'triggers_replaced':['trg_answer_key_status_imutavel'],
      'transaction_order':'read_committed_advisory_xact_lock_and_server_assigned_seq',
      'seal_checks':['forbid_insert_definitivo','form_lock','exact_contiguous_positions',
         'exact_contiguous_answers','matching_ordinals'],
      'untested':['real_pg17_multi_connection_concurrency','external_hash_anchor',
         'managed_supabase_auth_jwt','migration_of_existing_nonempty_audit_log'],
      'production_gate':'NO_GO', 'remote_db_writes':0
    }
    return sql,json.dumps(manifest,indent=2,ensure_ascii=False,sort_keys=True)+'\n'

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',default='.')
    p.add_argument('--check',action='store_true')
    a=p.parse_args()
    root=Path(a.root)
    sql,manifest=build(root)
    if a.check:
        if (root/OUTPUT).read_text(encoding='utf-8')!=sql:raise ValueError('SQL artifact drift')
        if (root/MANIFEST).read_text(encoding='utf-8')!=manifest:raise ValueError('manifest artifact drift')
    else:
        (root/OUTPUT).parent.mkdir(parents=True,exist_ok=True)
        (root/OUTPUT).write_text(sql,encoding='utf-8')
        (root/MANIFEST).write_text(manifest,encoding='utf-8')
    print(json.dumps({'status':'PASS_ALPHA7_AUDIT_SEAL','mode':'CHECK' if a.check else 'GENERATED',
                      'source_migrations_verified':30, 'audit_fields':15,
                      'new_functions':4,'replaced_functions':2,'new_triggers':2,
                      'gate':'NO_GO'}))
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as exc:
        print('FAIL_ALPHA7_AUDIT_SEAL '+str(exc),file=sys.stderr)
        sys.exit(2)
