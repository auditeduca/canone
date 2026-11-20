#!/usr/bin/env python3
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
a=(ROOT/'app/src/App.tsx').read_text();nav=(ROOT/'app/src/ui/Nav.tsx').read_text();pg=(ROOT/'app/src/screens/pages.tsx').read_text()
cli=(ROOT/'app/src/api/cliente.ts').read_text();login=(ROOT/'app/src/screens/Entrar.tsx').read_text()
modules=(ROOT/'app/src/content/modulos.ts').read_text()
assert sorted(int(n) for n in re.findall(r"\{\s*n:\s*(\d+),\s*id:",modules))==list(range(1,27))
assert len(list((ROOT/'backend/db/migrations').glob('*.sql')))==30
assert 'VITE_COMANDER_TOKEN' not in cli
assert 'localStorage.getItem' not in login and 'localStorage.setItem' not in login
assert 'Assinar <IcArrow' not in a and 'Assinar <IcArrow' not in nav and 'Assinar para liberar' not in pg
assert 'HOLD_HUMAN_NO_GO' in (ROOT/'docs/pmo/MARCO_S2_IMPLANTACAO_RECONCILIADA_2026-11-14.md').read_text()
assert (ROOT/'app/vercel.json').exists()
assert not any((ROOT/'app').rglob('.env*'))
assert (ROOT/'backend/integrations/senado-legislacao/generated/source-backed-review.csv').exists()
assert (ROOT/'backend/integrations/metadata-auto/generate.mjs').exists()
print('S2 SAFE PREVIEW GATE PASS: 26 modules, 30 migrations, no operator env token, no persisted bearer, checkout inactive')
