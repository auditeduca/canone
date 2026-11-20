import importlib.util
import pathlib
import json
import subprocess
import sys
import unittest

HERE=pathlib.Path(__file__).resolve().parent
SPEC=importlib.util.spec_from_file_location('s21_audit',HERE/'audit_contracts.py')
M=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)

class S21GateTests(unittest.TestCase):
 def test_report_is_pure(self):
  o=M.inspect()
  self.assertTrue(o['no_database_access'])
  self.assertFalse(o['release_approved'])
 def test_requires_auth_role(self):
  self.assertEqual(M.inspect()['missing_roles'], ['canone_auth'])
 def test_identifies_legacy_namespace_contracts(self):
  o=json.loads((HERE/'S21_BACKEND_CONTRACT_AUDIT.json').read_text())
  self.assertGreater(o['legacy_backend_sql_ref_count'],25)
  self.assertTrue(any(x['schema']=='identity' for x in o['legacy_backend_sql_refs']))
  self.assertTrue(any(x['schema']=='commerce' for x in o['legacy_backend_sql_refs']))
 def test_does_not_misidentify_non_sql_comments(self):
  o=json.loads((HERE/'S21_BACKEND_CONTRACT_AUDIT.json').read_text())
  self.assertFalse(any(x['file'].endswith('secrets.ts') for x in o['legacy_backend_sql_refs']))
 def test_identity_usage_is_missing_in_candidate(self):
  self.assertTrue(M.inspect()['missing_canone_identity_usage'])
 def test_nonzero_strict_gate(self):
  p=subprocess.run([sys.executable,str(HERE/'audit_contracts.py'),'--strict'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=False)
  self.assertEqual(p.returncode,41)
 def test_report_mode_zero_but_never_approves(self):
  p=subprocess.run([sys.executable,str(HERE/'audit_contracts.py'),'--report'],capture_output=True,text=True)
  self.assertEqual(p.returncode,0)
  self.assertIn('"release_approved": false',p.stdout)
 def test_schema_scope_count(self):
  self.assertEqual(M.inspect()['review_schema_count'],14)

if __name__=='__main__':unittest.main()
