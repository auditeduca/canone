#!/usr/bin/env python3
"""S22: deterministic, manifest-gated backend SQL namespace reconciliation.

Only explicit backend TypeScript SQL template literals are rewritten. This tool
never touches migrations, never connects to DB, and never deploys. The reported
S21 43 distinct references form the approved source inventory. Other mismatches
fail closed, not silently ported.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
MANIFEST=BASE/'S5_NAMESPACE_MANIFEST.json'
S21=BASE/'s21-runtime/S21_BACKEND_CONTRACT_AUDIT.json'
PATTERN=re.compile(r'`(?:\\.|[^`])*`',re.S)
SQL=re.compile(r'\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|JOIN|CALL|VALUES|WITH|RETURNING)\b',re.I)


def sha(raw:bytes)->str:return hashlib.sha256(raw).hexdigest()
def fail(message):raise RuntimeError('S22_REFUSED: '+message)


def source_integrity():
    m=json.loads(MANIFEST.read_text())
    if len(m['original_migrations'])!=30:fail('manifest must include 30 migrations')
    for i,item in enumerate(m['original_migrations'],1):
        if int(item['file'][:3])!=i:fail('unexpected migration order')
        if sha((ROOT/'backend/db/migrations'/item['file']).read_bytes())!=item['sha256']:
            fail('immutable source changed: '+item['file'])
    return {x['old']:x['new'] for x in m['schemas']}


def run(write=False):
    mapping=source_integrity()
    audit=json.loads(S21.read_text())
    expect={(r['file'],r['schema'],r['object']) for r in audit['legacy_backend_sql_refs']}
    if len(expect)!=43:fail('S21 inventory must be exactly 43 distinct keys')
    old_pattern=re.compile(r'\b('+ '|'.join(re.escape(x) for x in sorted(mapping,key=len,reverse=True)) +r')\.([A-Za-z_][A-Za-z_0-9]*)\b')
    before, after=set(),set()
    rows=[]; changed=[]; proposals=[]
    for p in sorted((ROOT/'backend/src').rglob('*.ts')):
        rel=p.relative_to(ROOT).as_posix()
        original=p.read_text()
        count=[0]
        def repl_template(m):
            template=m.group(0)
            if not SQL.search(template):return template
            def repl_ref(z):
                key=(rel,z.group(1),z.group(2))
                before.add(key)
                if key not in expect:fail('unreviewed reference '+str(key))
                count[0]+=1
                return mapping[z.group(1)]+'.'+z.group(2)
            return old_pattern.sub(repl_ref,template)
        candidate=PATTERN.sub(repl_template,original)
        if candidate!=original:
            if not write:fail('unreconciled SQL in '+rel+'; run --write in a reviewed worktree')
            proposals.append((p,candidate))
            changed.append(rel)
        rows.append({'file':rel,'source_sha256':sha(original.encode()),'candidate_sha256':sha(candidate.encode()),'rewritten_occurrences':count[0]})
    if write:
        if before!=expect:fail('S21 inventory mismatch: missing '+str(sorted(expect-before)))
    else:
        # After applying, no old references must remain. The manifest is the
        # underlying authority; historical inventory is not re-discovered.
        for p in (ROOT/'backend/src').rglob('*.ts'):
            rel=p.relative_to(ROOT).as_posix()
            for m in PATTERN.findall(p.read_text()):
                if SQL.search(m):
                    for z in old_pattern.finditer(m):after.add((rel,z.group(1),z.group(2)))
        if after:fail('legacy SQL still present '+str(sorted(after)[:4]))
    # Validate the full inventory before writing any file (fail-closed, no partial migration).
    if write:
        for path,candidate in proposals:path.write_text(candidate)
    result={'status':'CANDIDATE_ONLY_NO_GO','original_migrations_sha256':'30/30',
            'historical_distinct_sql_references':len(expect),
            'distinct_rewritten_this_run':len(before),
            'file_count':len(rows),'modified_files':changed,
            'occurrences_this_run':sum(x['rewritten_occurrences'] for x in rows),
            'deploy_allowed':False,'database_mutations':False,'files':rows}
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
    try:run(args.write)
    except RuntimeError as e:print(str(e));raise SystemExit(42)
