#!/usr/bin/env python3
"""Alpha9 fail-closed manifest checker for code and S22 candidate dependency integrity."""
import argparse
import hashlib
import json
import pathlib
import sys

ARTIFACTS = (
    'gateway/alpha9-core.mjs',
    'gateway/alpha9-server.mjs',
    'staging/supabase/010_private_feature_gate.candidate.sql.txt',
    'tests/alpha9-gateway.test.mjs',
    'tests/pg17_alpha9_entitlement.sh',
    'docs/ALPHA9_GATEWAY_AUTH_ENTITLEMENT.md',
)
PREVIOUS = 'staging/supabase/009_attempt_grade_srs.candidate.sql.txt'
MANIFEST = 'staging/supabase/CANONE_ALPHA9_GATEWAY_MANIFEST.json'

def manifest(root):
    base = root.resolve()
    def hashed(rel):
        path = (base / rel).resolve()
        if not path.is_relative_to(base) or not path.is_file():
            raise ValueError('missing or escaping path: ' + rel)
        return {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
    entry = {rel: hashed(rel) for rel in ARTIFACTS}
    return {
        'version': '0.23.0-alpha.9',
        'status': 'AUTHENTICATED_GATEWAY_PG17_CANDIDATE_NO_GO',
        'source_dependency_009': {PREVIOUS: hashed(PREVIOUS)},
        'artifacts': entry,
        'service_methods': ['exam_start','exam_answer','exam_finish','exam_reveal','exam_to_srs'],
        'feature_key': 'cfc.exam',
        'remote_writes': 0, 'production_gate': 'NO_GO'
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root',default='.')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--write',action='store_true')
    group.add_argument('--check',action='store_true')
    opts=parser.parse_args()
    root=pathlib.Path(opts.root)
    expected=manifest(root)
    file=root/MANIFEST
    if opts.write:
        file.parent.mkdir(parents=True,exist_ok=True)
        file.write_text(json.dumps(expected,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    else:
        actual=json.loads(file.read_text(encoding='utf8'))
        if actual != expected: raise ValueError('ALPHA9_MANIFEST_OR_SOURCE_DRIFT')
    print(json.dumps({'status':'PASS_ALPHA9_MANIFEST','artifacts':len(ARTIFACTS),'gate':'NO_GO','mode':'WRITE' if opts.write else 'CHECK'}))

if __name__=='__main__':
    try:main()
    except (ValueError, FileNotFoundError) as e:
        print('FAIL_ALPHA9_MANIFEST '+str(e),file=sys.stderr);sys.exit(1)
