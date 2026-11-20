#!/usr/bin/env python3
"""Offline: validates every checksum listed in MANIFESTO_SHA256.txt."""
from pathlib import Path
import hashlib,sys
root=Path(__file__).resolve().parents[1]
entries=(root/'MANIFESTO_SHA256.txt').read_text(encoding='utf-8').splitlines()
failed=[]
for line in entries:
    if not line.strip():continue
    expected,name=line.split('  ',1)
    path=(root/name).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file(): failed.append((name,'MISSING'));continue
    value=hashlib.sha256(path.read_bytes()).hexdigest()
    if value!=expected:failed.append((name,'SHA_MISMATCH'))
print('MANIFEST_VERIFIED',len(entries)-len(failed),'OF',len(entries))
for name,why in failed:print('ERROR',why,name)
sys.exit(1 if failed else 0)
