"""Regression tests for bounded Cânone Supabase candidate, no live connection."""
from pathlib import Path
import importlib.util
import json
import re
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pilot',ROOT/'tools/verify_supabase_stage_pilot.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestPilot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report=mod.analyze(ROOT)
        cls.sql=(ROOT/mod.SQL).read_text()
    def test_01_seven_tables_and_migration_source_integrity(self):
        self.assertEqual(self.report['table_count'],7)
        self.assertEqual(self.report['source_migrations_verified'],30)
        self.assertEqual(self.report['source_migrations_modified'],0)
    def test_02_auth_is_managed_and_not_duplicated(self):
        self.assertEqual(self.report['auth_managed_legacy_tables_recreated'],0)
        for name in ('identity.account','identity.session','identity.magic_link'):
            self.assertNotRegex(self.sql,rf'CREATE TABLE\s+{re.escape(name)}\b')
    def test_03_role_registry_cannot_be_self_granted(self):
        self.assertNotRegex(self.sql,r'(?is)CREATE POLICY[^;]*(?:user_role|role)')
        self.assertNotRegex(self.sql,r'(?is)GRANT[^;]*ON\s+canone_identity\.user_role')
    def test_04_private_data_and_source_binding_no_client_grants(self):
        for tab in ('private_profile','source_binding','consent'):
            self.assertNotRegex(self.sql,rf'(?is)GRANT[^;]*\b{tab}\b[^;]*\bTO\s+authenticated')
    def test_05_rls_all_tables(self):
        for name in mod.TABLES:
            self.assertIn(f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY;',self.sql)
            self.assertIn(f'ALTER TABLE {name} FORCE ROW LEVEL SECURITY;',self.sql)
    def test_06_all_client_policies_tied_to_jwt_user(self):
        self.assertEqual(self.sql.count('CREATE POLICY '),3)
        self.assertEqual(self.sql.count('(SELECT auth.uid()) = user_id'),4)
    def test_07_source_shared_db_guard(self):
        self.assertIn("to_regclass('canone_control.migration_catalog')",self.sql)
    def test_08_no_other_project_schema_creation(self):
        self.assertNotRegex(self.sql,r'(?im)^\s*CREATE SCHEMA\s+(?:public|auth|storage|cko_|ce_)')
    def test_09_inventory_status_is_not_production(self):
        self.assertEqual(self.report['gate'],'NO_GO')
        self.assertFalse(self.report['shared_source_changes'])
    def test_10_manifest_reproducibility(self):
        from hashlib import sha256
        self.assertEqual(self.report['source_sql_sha256'],sha256(self.sql.encode()).hexdigest())
        m=json.loads((ROOT/mod.MANIFEST).read_text())
        self.assertEqual(m,self.report)
    def test_11_refuse_missing_rls(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d)
            (d/'staging/supabase').mkdir(parents=True)
            (d/'crosswalk/supabase').mkdir(parents=True)
            (d/'source-s22/backend/db/migrations').mkdir(parents=True)
            import shutil
            shutil.copy(ROOT/mod.CROSSWALK,d/mod.CROSSWALK)
            cross=json.loads((ROOT/mod.CROSSWALK).read_text())
            for row in cross['migrations']:
                shutil.copy(ROOT/mod.BASELINE/row['source'],d/mod.BASELINE/row['source'])
            (d/mod.SQL).write_text(self.sql.replace('ALTER TABLE canone_identity.role ENABLE ROW LEVEL SECURITY;','-- missing'))
            with self.assertRaises(mod.CandidateError):mod.analyze(d)

if __name__=='__main__':unittest.main()
