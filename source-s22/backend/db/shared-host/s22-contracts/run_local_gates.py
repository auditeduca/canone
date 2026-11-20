#!/usr/bin/env python3
"""S22 local regression runner, does not connect to database, fail closed."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
suites=[
 ('frontend_s19',['node','--experimental-strip-types','--test']+[str(p) for p in sorted((ROOT/'app/tests').glob('*.test.mjs'))]),
 ('s11_portability',['node','--test']+[str(p) for p in sorted((ROOT/'backend/db/shared-host/tests').glob('*.test.mjs'))]),
 ('s12_candidates',[sys.executable,str(ROOT/'backend/db/shared-host/s12-review/test_s12_candidates.py')]),
 ('s13_preflight',[sys.executable,str(ROOT/'backend/db/shared-host/s13-isolated/test_s13_preflight.py')]),
 ('s20_context',['node','--experimental-strip-types','--test',str(ROOT/'backend/tests/18-s20-context-hardening.test.mjs')]),
 ('s21_historical',[sys.executable,str(ROOT/'backend/db/shared-host/s21-runtime/test_s21_contracts.py')]),
 ('s22_contracts',[sys.executable,str(HERE/'test_s22_contracts.py')]),
]
counts={'frontend_s19':195,'s11_portability':14,'s12_candidates':14,'s13_preflight':20,'s20_context':10,'s21_historical':8,'s22_contracts':16}
reports=[]
for name,cmd in suites:
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=60)
 out=r.stdout+'\n'+r.stderr
 # Python unittest uses 'Ran N tests'; Node test summary is '# pass N'.
 match=re.search(r'(?m)^# pass (\d+)',out) or re.search(r'Ran (\d+) tests?',out)
 passed=int(match.group(1)) if match else None
 ok=r.returncode==0 and passed==counts[name]
 reports.append({'name':name,'exit':r.returncode,'expected':counts[name],'passed':passed,'status':'PASS' if ok else 'FAIL'})
 (HERE/(name+'.log')).write_text(out)
 print(name,'PASS' if ok else 'FAIL',passed,'/',counts[name],flush=True)
 if not ok:break
result={'observed_utc':datetime.now(timezone.utc).isoformat(),'status':'PASS' if len(reports)==len(suites) and all(x['status']=='PASS' for x in reports) else 'FAIL',
        'passed':sum(x['passed'] or 0 for x in reports),'expected':sum(counts.values()),'suites':reports}
(HERE/'S22_LOCAL_REGRESSION_RESULT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
if result['status']!='PASS':raise SystemExit(40)
