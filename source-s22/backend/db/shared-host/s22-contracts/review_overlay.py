#!/usr/bin/env python3
"""S22: deterministic, review-only namespace proposal for migrations 018–030.

Only for a disposable PostgreSQL instance with a marker; these are NOT source
migrations, and no SQL is executed by this script. The original 30 migrations
and the S12 review payloads remain immutable and have their hashes checked.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
MANIFEST=ROOT/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json'
MIG=ROOT/'backend/db/migrations'
FROM=18
THROUGH=30

def sha(v):return hashlib.sha256(v).hexdigest()

def fail(m):raise ValueError('S22_HOLD: '+m)

def generate(destination=None):
    m=json.loads(MANIFEST.read_text())
    mapping={x['old']:x['new'] for x in m['schemas']}
    if len(mapping)!=14 or len(m['original_migrations'])!=30:fail('unexpected namespace manifest')
    fullrefs=re.compile(r'(?<![\w])('+'|'.join(re.escape(k) for k in sorted(mapping,key=len,reverse=True))+r')(?=\s*\.)')
    name_only=re.compile(r"\b('(?:"+'|'.join(mapping.keys())+r")')\b")
    rows=[]; generated=[]
    for i,item in enumerate(m['original_migrations'],1):
        if int(item['file'][:3])!=i:fail('out of order source migration')
        origin=(MIG/item['file']).read_bytes()
        if sha(origin)!=item['sha256']:fail('source sha256 drift '+item['file'])
        if i<FROM:continue
        text=origin.decode('utf-8')
        changed=fullrefs.sub(lambda match:mapping[match.group(1)],text)
        # Metaprogramming scans namespaces as unqualified SQL string literals.
        # All changes are explicit, scoped and separately tested.
        def map_meta_names(match):
            return re.sub(r"'("+'|'.join(mapping)+r")'",lambda v:"'"+mapping[v.group(1)]+"'",match.group(0))
        changed=re.sub(r"\bn\.nspname\s+(?:IN\s*\([^)]*\)|=\s*'[^']+')",map_meta_names,changed,flags=re.S)
        # Exact schema usage, including dynamic SQL in quoted statements.
        changed=re.sub(r'\b(SCHEMA\s+)(identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit|public|subscriber|evidence|bridge|control)\b',lambda z:z.group(1)+mapping[z.group(2)],changed,flags=re.I)
        # Bounded list matching prevents regex backtracking through PL/pgSQL bodies.
        for prefix in (r'IN\s+SCHEMA\s+',r'ON\s+SCHEMA\s+'):
            pat=prefix+r'([a-z_][a-z_, ]{0,160})(?=\s+TO\b)'
            changed=re.sub(pat,lambda z:re.sub(r'\b('+'|'.join(mapping)+r')\b',lambda t:mapping[t.group()],z.group()),changed,flags=re.I)
        header=(f'-- S22 REVIEW CANDIDATE ONLY: {item["file"]}\n'
                f'-- ORIGINAL_SHA256={sha(origin)}\n'
                f'-- CANONICAL_NAMESPACE_PROJECTION; NO PRODUCTION AUTHORIZATION\n')
        raw=(header+changed).encode()
        rows.append({'migration':i,'file':item['file'],'original_sha256':sha(origin),'proposed_sha256':sha(raw),
                     'risk_flags':(["SECURITY_DEFINER"] if re.search('SECURITY\\s+DEFINER',text,re.I) else [])+
                                   (["DYNAMIC_DDL"] if re.search(r'\\bEXECUTE\\b',text,re.I) else [])+
                                   (["GRANTS_OR_ROLES"] if re.search(r'\\b(?:GRANT|CREATE ROLE|REVOKE)\\b',text,re.I) else []),
                     'status':'HOLD_REVIEW_NO_GO'})
        generated.append((item['file']+'.txt',raw))
    if len(rows)!=13:fail('expected 13 overlay candidates')
    if destination:
        destination.mkdir(parents=True,exist_ok=True)
        for filename,raw in generated:(destination/filename).write_bytes(raw)
    return {'gate':'NO_GO','source_files_sha256_validated':30,'overlay_migrations':13,'safe_to_apply_to_shared_db':False,
            'candidate_owner':'S22_REVIEW_ONLY','rows':rows}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    try:print(json.dumps(generate(args.output),ensure_ascii=False,indent=2))
    except Exception as e:print('S22_HOLD: '+str(e));raise SystemExit(43)
