#!/usr/bin/env python3
"""Exportação autoral do Cânone sem fontes binárias, segredos e arquivos de trabalho.
Não inclui objetos Git nem bytes originais normativos; cria e revalida manifesto SHA-256.
"""
from __future__ import annotations
from pathlib import Path
import hashlib
import io
import json
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'CANONE_APP_V9_S3/'
FORBIDDEN = {'.woff', '.woff2', '.ttf', '.otf', '.eot', '.pem', '.key', '.p12', '.pfx'}


def tracked_files(root=ROOT):
    out = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root)
    files = [Path(x.decode('utf-8')) for x in out.split(b'\x00') if x]
    if not files:
        raise RuntimeError('Nenhum arquivo versionado')
    for p in files:
        s = p.as_posix()
        if p.suffix.lower() in FORBIDDEN or p.name.startswith('.env') or any(part in {'node_modules','.git','__pycache__','.local-bridge'} for part in p.parts):
            raise RuntimeError(f'BLOQUEADO arquivo restrito: {s}')
        if not (root/p).is_file():
            raise RuntimeError(f'Ausente arquivo rastreado: {s}')
    return sorted(files, key=lambda p:p.as_posix())


def package(outpath: Path, root=ROOT):
    files = tracked_files(root)
    manifest = []
    outpath.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(outpath,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files:
            data = (root/p).read_bytes()
            name = PREFIX+p.as_posix()
            z.writestr(name,data)
            manifest.append(f'{hashlib.sha256(data).hexdigest()}  {p.as_posix()}')
        z.writestr(PREFIX+'MANIFESTO_S3_SHA256.txt','\n'.join(manifest)+'\n')
    with zipfile.ZipFile(outpath,'r') as z:
        assert z.testzip() is None
        lines=z.read(PREFIX+'MANIFESTO_S3_SHA256.txt').decode().splitlines()
        assert len(lines)==len(files)
        for line in lines:
            digest,path=line.split('  ',1)
            assert hashlib.sha256(z.read(PREFIX+path)).hexdigest()==digest, path
        assert len(z.namelist())==len(files)+1
    digest=hashlib.sha256(outpath.read_bytes()).hexdigest()
    outpath.with_suffix(outpath.suffix+'.sha256').write_text(f'{digest}  {outpath.name}\n')
    return {'path':str(outpath),'entries':len(files)+1,'source_files':len(files),'sha256':digest,'release_gate':'HOLD_HUMAN_NO_GO','font_binary_files':0}

if __name__=='__main__':
    destination=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/CANONE_V9_S3_APP_SANITIZADO_2026-11-14.zip')
    print(json.dumps(package(destination),ensure_ascii=False,indent=2))
