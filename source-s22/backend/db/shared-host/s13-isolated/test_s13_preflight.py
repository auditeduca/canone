import importlib.util, importlib.machinery
from pathlib import Path
import hashlib, unittest, tempfile, os, subprocess, sys, json
HERE=Path(__file__).resolve().parent
M=importlib.machinery.SourceFileLoader('s13prepare',str(HERE/'prepare.py')).load_module()

class TestS13Preflight(unittest.TestCase):
  def test_01_source_complete(self): self.assertEqual(M.verify()['source'],30)
  def test_02_candidate_exact(self): self.assertEqual(M.verify()['review_candidates'],10)
  def test_03_no_live_sql_in_repo(self): self.assertEqual(set(HERE.glob('*.sql')),{HERE/'assertions.sql',HERE/'assertions_two_users.sql'})
  def test_04_namespaces_only_canonical(self):
    b=M.bootstrap(); self.assertIn('CREATE SCHEMA canone_identity;',b)
    self.assertNotIn('CREATE SCHEMA public;',b)
    self.assertNotIn('REVOKE ALL ON SCHEMA public',b)
  def test_05_expected_number(self): self.assertEqual(M.SUBSET,tuple(range(2,18)))
  def test_06_bootstrap_source_functions(self):
    b=M.bootstrap()
    for f in ('current_user_id','current_area','current_request_id','is_staff'):self.assertIn('canone_ops.'+f+'()',b)
    self.assertNotIn('FUNCTION ops.',b)
  def test_07_guard_mentions_disposable(self): self.assertIn("current_database() <> 'canone_s13_disposable'",M.guard())
  def test_08_stages_only_temp(self):
    with tempfile.TemporaryDirectory() as d:
      out=M.prepare(Path(d))
      self.assertEqual(out['staged'],17)
      self.assertFalse(out['live_approved'])
      self.assertEqual(len(list(Path(d).glob('*.sql'))),17)
  def test_09_migrations_guard(self):
    with tempfile.TemporaryDirectory() as d:
      M.prepare(Path(d))
      for f in Path(d).glob('*.sql'):
        t=f.read_text();self.assertIn('S13 REFUSED:',t)
  def test_10_original_hash_not_changed(self): self.assertTrue(M.verify()['source_sha256_ok'])
  def test_11_bad_external_env_rejected(self):
    with tempfile.TemporaryDirectory() as d:
      old=os.environ.get('PGHOST');os.environ['PGHOST']='not_allowed.example'
      try:
        with self.assertRaisesRegex(ValueError,'external DB variable'):M.prepare(Path(d))
      finally:
        if old is None: os.environ.pop('PGHOST',None)
        else:os.environ['PGHOST']=old
  def test_12_public_function_no_blanket_grants(self):
    t=(M.S12/'reviews/S12_REVIEW_ONLY_006_learning_items.sql.txt').read_text()
    self.assertIn('REVOKE ALL ON FUNCTION canone_learning.grade_answer',t)
  def test_13_asserts_rls_and_role_scope(self):
    t=(HERE/'assertions.sql').read_text()
    self.assertIn('relforcerowsecurity',t)
    self.assertIn('has_schema_privilege',t)
    self.assertIn('aclexplode',t)
  def test_14_no_network_in_runner(self):
    t=(HERE/'run_disposable.sh').read_text()
    self.assertIn('--network none',t)
    self.assertNotIn('-p 5432',t)
    self.assertIn('docker image inspect',t)
  def test_15_refuses_missing_runtime_without_contact(self):
    # Never start a docker container from a unit test on a capable runner.
    script=(HERE/'run_disposable.sh').read_text()
    self.assertIn('if ! command -v docker',script)
    self.assertIn('S13_HOLD_RUNTIME:',script)
    self.assertIn('S13_HOLD_IMAGE:',script)
  def test_16_test_sql_never_claims_production(self):
    t=(HERE/'assertions.sql').read_text();self.assertIn('Fail closed',t)

  def test_17_two_user_boundary(self):
    t=(HERE/'assertions_two_users.sql').read_text()
    self.assertIn('subscriber A',t)
    self.assertIn('subscriber B',t)
    self.assertIn('SET LOCAL ROLE canone_subscriber',t)
  def test_18_restoration_probe(self):
    t=(HERE/'run_disposable.sh').read_text()
    self.assertIn('pg_dump -Fc',t)
    self.assertIn('pg_restore',t)
  def test_19_migrations_in_transaction(self):
    with tempfile.TemporaryDirectory() as d:
      M.prepare(Path(d))
      for f in Path(d).glob('0*.sql'):
        if f.name.startswith('001_'): continue
        t=f.read_text();self.assertIn('BEGIN;',t);self.assertIn('COMMIT;',t)
  def test_20_no_real_credential_reference(self):
    t=(HERE/'run_disposable.sh').read_text()
    self.assertNotIn('postgresql://',t)
    self.assertIn('SUPABASE_DB_URL',t)

if __name__=='__main__':unittest.main()
