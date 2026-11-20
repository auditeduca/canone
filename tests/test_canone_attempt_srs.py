"""Static alpha8 safeguards, no network or database required."""
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import convert_canone_attempt_srs as gen

class Alpha8Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql,cls.manifest=gen.build(ROOT)
        cls.m=json.loads(cls.manifest)

    def test_all_30_immutable(self):
        self.assertEqual(self.m['source_migrations_verified'],30)
        self.assertEqual(len(self.m['sources']),5)
    def test_generated_match_committed(self):
        self.assertEqual(self.sql,(ROOT/gen.OUTPUT).read_text('utf-8'))
        self.assertEqual(self.manifest,(ROOT/gen.MANIFEST).read_text('utf-8'))
    def test_private_service(self):
        self.assertEqual(self.sql.count('SECURITY DEFINER SET search_path=pg_catalog'),5)
        self.assertEqual(self.sql.count('REVOKE ALL ON FUNCTION canone_ops.exam_'),5)
        self.assertEqual(self.sql.count('GRANT EXECUTE ON FUNCTION canone_ops.exam_'),5)
    def test_no_public_grade(self):
        self.assertIn('RETURNS void',self.sql)
        self.assertNotIn('GRANT EXECUTE ON FUNCTION canone_ops.exam_answer(uuid,integer,text) TO authenticated',self.sql)
        self.assertIn('KEY_ONLY_AFTER_FINISH',self.sql)
    def test_owner_auth(self):
        self.assertGreaterEqual(self.sql.count('v_attempt.user_id<>v_uid'),4)
        self.assertIn('IF v_uid IS NULL',self.sql)
    def test_serialization(self):
        self.assertGreaterEqual(self.sql.count('FOR UPDATE;'),3)
        self.assertIn('ON CONFLICT (attempt_id,ordinal)',self.sql)
        self.assertIn('SET status=\'concluida\'',self.sql)
    def test_idempotent_srs(self):
        self.assertIn('PRIMARY KEY (attempt_id, ordinal)',self.sql)
        self.assertIn('IF FOUND THEN RETURN v_event; END IF;',self.sql)
        self.assertIn('exam_review_receipt',self.sql)
    def test_annulled_handling(self):
        self.assertIn("WHEN v_annulled THEN 'anulada'",self.sql)
        self.assertIn("IF v_verdict='anulada' THEN RETURN NULL; END IF;",self.sql)
    def test_no_grade_in_client(self):
        self.assertIn('REVOKE ALL ON TABLE canone_learning.exam_attempt_answer',self.sql)
        self.assertIn('REVOKE ALL ON TABLE canone_learning.exam_attempt ',self.sql)
    def test_no_cut_score(self):
        self.assertNotIn('passing_score',self.sql)
        self.assertNotIn("SET status='aprovada'",self.sql)
    def test_guard_shared_project(self):
        self.assertIn("to_regclass('canone_control.migration_catalog')",self.sql)
        self.assertIn('REQUIRE_CANONE_ALPHA7_STAGING',self.sql)
        self.assertIn('REQUIRE_SUPABASE_SERVICE_ROLE',self.sql)
    def test_no_remote_connection(self):
        self.assertNotIn('DATABASE_URL',self.sql)
        self.assertEqual(self.m['remote_db_mutations'],0)

if __name__=='__main__':unittest.main()
