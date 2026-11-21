from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
SQL=(ROOT/"tests/sql/f1_ns01_due_private_ephemeral.sql").read_text()
TEST=(ROOT/"tests/sql/f1_ns01_due_owner_tests_ephemeral.sql").read_text()
SHELL=(ROOT/"tests/pg17_f1_ns01_due.sh").read_text()
class Contract(unittest.TestCase):
 def test_ephemeral_guard(self):
  self.assertIn("current_database()<>'canone_alpha7_ci'",SQL)
  self.assertIn("REFUSE_NON_EPHEMERAL_CANONE_ENV",SQL)
 def test_private_function(self):
  for marker in ("SECURITY DEFINER SET search_path=pg_catalog","REVOKE ALL ON FUNCTION",
                  "GRANT EXECUTE ON FUNCTION","auth.uid()","s.user_id=v_uid",
                  "canone_ops.can_use_feature","p_limit>100","s.state<>'nova'",
                  "ORDER BY s.due_at"):
   self.assertIn(marker,SQL)
  self.assertNotIn("CREATE OR REPLACE VIEW",SQL)
 def test_adversarial_runtime_vectors(self):
  for marker in ("FAIL_OWNER_A_DUE_COUNT","FAIL_OWNER_B_DUE_COUNT","FAIL_CROSS_SUBJECT_B_LEAK",
                 "FAIL_REVOKED_SUBSCRIBER_ALLOWED","FAIL_ANONYMOUS_SUBJECT_ALLOWED",
                 "FAIL_ZERO_LIMIT_ALLOWED","FAIL_EXCESSIVE_LIMIT_ALLOWED","ROLLBACK;"):
   self.assertIn(marker,TEST)
 def test_rollback_and_browser_denial(self):
  self.assertIn("REFUSE_REMOTE_DB_SECRET",SHELL)
  self.assertIn("for role in authenticated anon",SHELL)
  self.assertIn("FAIL_TEST_FIXTURE_PERSISTED",SHELL)
if __name__=="__main__":unittest.main()
