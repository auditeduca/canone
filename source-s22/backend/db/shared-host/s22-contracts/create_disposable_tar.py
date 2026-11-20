#!/usr/bin/env python3
"""Package S21 001-017 + S22 review-only 018-030 for disposable PG17 rehearsal.

No connection, no credentials, no mutation of source migrations. Does NOT
validate security or authorize use beyond this isolated rehearsal.
"""
import base64
import io
import json
import tarfile
from pathlib import Path
from review_overlay import generate

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
ARCHIVE=Path('/mnt/data/CANONE_S21_SQL_ARCHIVE_B64_2026-11-14.txt')
OUT=Path('/mnt/data/CANONE_S22_DISPOSABLE_PG17_STAGE_2026-11-15.tar.gz')

GUARD="""
DO $s22_disposable_guard$ BEGIN
 IF current_database() <> 'canone_s13_disposable'
    OR inet_server_addr() IS NOT NULL
    OR to_regclass('s13_sentinel.disposable_marker') IS NULL
    OR (SELECT count(*) FROM s13_sentinel.disposable_marker WHERE marker = 's13-verified') <> 1
 THEN RAISE EXCEPTION 'S22 DENIED: not disposable PG17/local socket and sentinel'; END IF;
END $s22_disposable_guard$;
"""

def main():
    review=generate()
    if len(review['rows'])!=13:raise RuntimeError('bad overlay')
    b64=''.join(ARCHIVE.read_text().split())
    old=tarfile.open(fileobj=io.BytesIO(base64.b64decode(b64,validate=True)),mode='r:gz')
    items=[]
    for x in old.getmembers():
        if x.isfile() and x.name.startswith('staged/'):
            data=old.extractfile(x).read()
            items.append((x.name,data))
    if len(items)!=17:raise RuntimeError('S21 baseline missing 17 staged migrations')
    for row in review['rows']:
        f=(HERE/'reviews'/(row['file']+'.txt')).read_text()
        # Guard outside and inside transaction. Only one valid local socket DB.
        sql='-- S22 SANDBOX ONLY; NO PRODUCTION AUTHORIZATION.\n'+GUARD+'BEGIN;\n'+f+'\nCOMMIT;\n'
        items.append((f"staged/{row['file']}",sql.encode()))
    assert len(items)==30
    script='''#!/usr/bin/env bash
set -euo pipefail
# NEVER accept DB URL; run via local postgres OS user/Unix socket only.
if [[ "${DATABASE_URL:-}${PGHOST:-}${SUPABASE_DB_URL:-}${PGSERVICE:-}" != "" ]]; then
  echo "S22 REFUSED: external database environment" >&2; exit 45
fi
if [[ "$(id -un)" != "postgres" ]]; then echo "S22 REFUSED: postgres OS user required" >&2;exit 46;fi
if [[ "$(psql -X -At -d canone_s13_disposable -c 'select version()')" != *"PostgreSQL 17."* ]]; then
  echo "S22 REFUSED: PostgreSQL 17 required" >&2;exit 47
fi
for path in staged/*.sql; do
  echo "START $(basename "$path")"
  psql -X -v ON_ERROR_STOP=1 -d canone_s13_disposable -f "$path" >/tmp/s22_"$(basename "$path")".log 2>&1 || {
    echo "FAIL $(basename "$path")";
    tail -35 /tmp/s22_"$(basename "$path")".log;
    exit 48;
  }
  echo "PASS $(basename "$path")"
done
'''
    items.append(('run_pg17_disposable_only.sh',script.encode()))
    items.append(('S22_REVIEW_NOTE.txt',('NO-GO. SQL is only for isolated PostgreSQL 17 proof; no production promotion.\n').encode()))
    with tarfile.open(OUT,'w:gz') as out:
        for name,data in items:
            info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o600 if name.endswith('.sql') else 0o700
            out.addfile(info,io.BytesIO(data))
    print(json.dumps({'stage_files':30,'bytes':OUT.stat().st_size,'path':str(OUT),'gate':'NO_GO'}))

if __name__=='__main__':main()
