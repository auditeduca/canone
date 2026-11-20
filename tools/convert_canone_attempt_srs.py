#!/usr/bin/env python3
"""Alpha8: deterministic, non-deploying S22 exam attempt/SRS port.

Checks SHA-256 of all 30 historical migrations before emitting the candidate.
The implementation is an audited rewrite rather than a blind string substitution.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

VERSION='0.23.0-alpha.8'
TEMPLATE=Path('tools/sql_templates/canone_alpha8_attempt_srs.sql.txt')
OUTPUT=Path('staging/supabase/009_attempt_grade_srs.candidate.sql.txt')
MANIFEST=Path('staging/supabase/CANONE_ATTEMPT_SRS_ALPHA8_MANIFEST.json')
SOURCE=Path('source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json')
MIGRATIONS=('006_learning_items.sql','007_learning_srs.sql','012_srs_engine.sql',
            '018_provas_gabarito.sql','019_tentativa_ingestao.sql')

def sha(data:bytes): return hashlib.sha256(data).hexdigest()

def build(root:Path):
    original=json.loads((root/SOURCE).read_text(encoding='utf-8'))
    items=original['original_migrations']
    if len(items)!=30:raise ValueError('S22 manifest is not 30 migrations')
    byname={x['file']:x for x in items}
    sources=[]
    for name,rec in byname.items():
        data=(root/'source-s22/backend/db/migrations'/name).read_bytes()
        if sha(data)!=rec['sha256']:raise ValueError('historical migration modified: '+name)
        if name in MIGRATIONS:sources.append({'name':name,'sha256':sha(data),'bytes':len(data)})
    if len(sources)!=len(MIGRATIONS):raise ValueError('missing S22 source')
    template=(root/TEMPLATE).read_text(encoding='utf-8')
    necessary=["to_regclass('canone_control.migration_catalog')",'SECURITY DEFINER SET search_path=pg_catalog',
      'auth.uid()',"k.status='definitivo'",'FOR UPDATE',
      'ON CONFLICT (attempt_id,ordinal)','EXCLUDED.verdict',
      'ON CONFLICT (user_id,item_id)','FORCE ROW LEVEL SECURITY',
      'canone_learning.review_event','canone_learning.exam_review_receipt',
      "'canone-srs-exam-v1'",'GRANT EXECUTE ON FUNCTION canone_ops.exam_start(uuid) TO service_role;',
      'REVOKE ALL ON FUNCTION canone_ops.exam_start(uuid) FROM PUBLIC, anon, authenticated;',
      "v_attempt.status<>'concluida'", "IF v_verdict='anulada' THEN RETURN NULL; END IF;"]
    for token in necessary:
        if token not in template:raise ValueError('unsafe missing SQL clause '+token)
    if template.count('CREATE OR REPLACE FUNCTION')!=5:raise ValueError('expected 5 functions')
    if 'GRANT EXECUTE ON FUNCTION canone_ops.exam_answer(uuid,integer,text) TO authenticated' in template:
        raise ValueError('verdict endpoint exposed')
    if 'GRANT ALL' in template or 'DROP TABLE' in template:raise ValueError('unsafe privilege or DROP TABLE')
    header='-- GENERATED alpha8; 30/30 S22 migration SHA-256 verified.\n'
    for item in sources:header+=f"-- source {item['name']} sha256={item['sha256']}\n"
    sql=header+template
    manifest={
        'version':VERSION,'status':'PRIVATE_EXAM_AND_SRS_CANDIDATE_NO_GO',
        'source_migrations_verified':30,'sources':sources,
        'template_sha256':sha(template.encode('utf-8')),
        'sql_sha256':sha(sql.encode('utf-8')),
        'functions':['canone_ops.exam_start','canone_ops.exam_answer','canone_ops.exam_finish',
                     'canone_ops.exam_reveal','canone_ops.exam_to_srs'],
        'new_tables':['canone_learning.exam_review_receipt'],
        'authorization':'service_role server-only; auth.uid from verified request context',
        'grade_exposure':'none until finished; server-only reveal',
        'srs_algorithm':'canone-srs-exam-v1',
        'idempotence':'unique (attempt_id,ordinal) receipt + attempt FOR UPDATE',
        'not_supported':['mock exam','official passing scores','unsealed form','public RPC',
                         'managed Auth/JWT E2E','arbitrary replay of historic SRS'],
        'gate':'NO_GO','remote_db_mutations':0}
    return sql,json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)+'\n'

def main():
    p=argparse.ArgumentParser();p.add_argument('--root',default='.')
    p.add_argument('--check',action='store_true');args=p.parse_args()
    root=Path(args.root);sql,manifest=build(root)
    if args.check:
        if (root/OUTPUT).read_text('utf-8')!=sql:raise ValueError('candidate drift')
        if (root/MANIFEST).read_text('utf-8')!=manifest:raise ValueError('manifest drift')
    else:
        (root/OUTPUT).parent.mkdir(parents=True,exist_ok=True)
        (root/OUTPUT).write_text(sql,encoding='utf-8')
        (root/MANIFEST).write_text(manifest,encoding='utf-8')
    print(json.dumps({'status':'PASS_ALPHA8_CANDIDATE','mode':'CHECK' if args.check else 'GENERATE',
      'sources_verified':30,'functions':5,'receipt_tables':1,'remote_writes':0,'gate':'NO_GO'}))

if __name__=='__main__':
    try:main()
    except Exception as e:
        print('FAIL_ALPHA8 '+str(e),file=sys.stderr)
        sys.exit(2)
