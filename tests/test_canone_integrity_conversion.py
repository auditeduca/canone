"""Fail-closed tests for the Cânone alpha6 integrity SQL generator."""
import importlib.util,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location('alpha6',ROOT/'tools/convert_canone_integrity.py')
gen=importlib.util.module_from_spec(sp);sp.loader.exec_module(gen)

class Integrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.sql,cls.m=gen.build(ROOT)
    def test_exact_inventory(self):
        self.assertEqual(len(self.m['functions']),7)
        self.assertEqual(len(self.m['triggers']),20)
    def test_source_sha30(self):self.assertEqual(self.m['source_migrations_sha256_verified'],30)
    def test_output_determinism(self):
        self.assertEqual(self.sql,(ROOT/gen.SQL_PATH).read_text())
        self.assertEqual(json.loads((ROOT/gen.MANIFEST_PATH).read_text()),self.m)
    def test_security_invoker(self):
        self.assertEqual(len(re.findall('SECURITY INVOKER SET search_path',self.sql)),7)
        self.assertEqual(len(re.findall('REVOKE ALL ON FUNCTION',self.sql)),7)
        self.assertNotIn('SECURITY DEFINER',self.sql)
    def test_not_deployed(self):
        self.assertTrue(self.m['release_gate']=='NO_GO')
        self.assertTrue(str(gen.SQL_PATH).endswith('.candidate.sql.txt'))
    def test_guard(self):self.assertIn('REFUSE_SHARED_CANONE_SOURCE',self.sql)
    def test_no_truncate_privilege(self):self.assertNotIn('GRANT ALL',self.sql)
    def test_sealed_entry_insert_guard(self):
        self.assertIn("TG_OP='INSERT'",self.sql)
        self.assertIn('definitive answer key entry cannot be inserted',self.sql)
    def test_status_delete_guard(self):
        self.assertIn("TG_OP='DELETE' THEN",self.sql)
        self.assertIn('definitive answer key cannot be deleted',self.sql)
    def test_timestamp_whitelist(self):
        self.assertEqual(self.m['timestamp_trigger_definitions'],12)
        self.assertNotIn('trg_touch_canone_identity_account',self.sql)
    def test_own_sources(self):
        for f in self.m['functions']:self.assertEqual(len(f['source_sha256']),64)
    def test_no_direct_grants(self):
        self.assertNotRegex(self.sql,r'(?im)^GRANT\s+.*\b(?:SELECT|UPDATE|INSERT|DELETE)\b')
    def test_preserve_history(self):
        self.assertEqual(self.m['historical_functions_not_yet_ported'],50)
    def test_compiled_origin(self):
        self.assertEqual(self.m['sql_sha256'],gen.HASH(self.sql.encode()))
if __name__=='__main__':unittest.main()
