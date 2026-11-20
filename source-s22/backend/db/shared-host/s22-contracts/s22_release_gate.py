#!/usr/bin/env python3
"""Fail-closed S22 release gate; reports technical progress but refuses production."""
import argparse
import json
from pathlib import Path
HERE=Path(__file__).resolve().parent

def inspect():
    gate=json.loads((HERE/'S22_RELEASE_GATE_NO_GO.json').read_text())
    proof=json.loads((HERE/'S22_REAL_PG17_RESULT.json').read_text())
    if gate['production_allowed'] or gate['release']!='NO_GO' or proof['release']!='NO_GO':
        raise RuntimeError('S22_REFUSED: unexpected release authorization')
    if proof['schema']['scripts_passed']!=30 or proof['schema']['tables_rls_enable_and_force']!=90:
        raise RuntimeError('S22_REFUSED: unexpected PostgreSQL result evidence')
    return {'stage':'S22','gate':'NO_GO','local_backend_sql_reconciled':43,
            'pg17_schema_ddl_scripts_passed':proof['schema']['scripts_passed'],
            'non_superuser_e2e_pass':proof['http_api_e2e']['tests_as_non_superuser_ubuntu_role'],
            'proposed_hardening_approved':False,'blockers':gate['blockers']}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--strict',action='store_true');a=p.parse_args()
    result=inspect();print(json.dumps(result,ensure_ascii=False,indent=2))
    if a.strict:raise SystemExit(41)
