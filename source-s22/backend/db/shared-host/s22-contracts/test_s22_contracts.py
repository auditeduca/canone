import json
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[3]
AUDIT=json.loads((ROOT/'backend/db/shared-host/s21-runtime/S21_BACKEND_CONTRACT_AUDIT.json').read_text())

class S22Contracts(unittest.TestCase):
    def test_historical_s21_discrepancies_precisely_43(self):
        self.assertEqual(AUDIT['legacy_backend_sql_ref_count'],43)
    def test_current_backend_no_old_sql_qualifiers(self):
        from importlib import util
        p=ROOT/'backend/db/shared-host/s21-runtime/audit_contracts.py'
        spec=util.spec_from_file_location('s21_runtime_audit',p)
        m=util.module_from_spec(spec);spec.loader.exec_module(m)
        result=m.inspect()
        self.assertEqual(result['legacy_backend_sql_ref_count'],0)
        self.assertEqual(result['missing_roles'],['canone_auth']) # S13 001-017 only.
    def test_pg_role_defined_by_original_029_not_bootstrap(self):
        m29=(ROOT/'backend/db/migrations/029_papel_de_acesso.sql').read_text()
        self.assertIn('CREATE ROLE canone_auth NOLOGIN NOINHERIT',m29)
        self.assertIn('GRANT canone_auth TO canone_app',m29)
    def test_schema_identity_usage_defined_in_original_025(self):
        m25=(ROOT/'backend/db/migrations/025_identity_usage.sql').read_text()
        self.assertRegex(m25,r'GRANT\s+USAGE\s+ON\s+SCHEMA\s+identity\s+TO')
    def test_source_30_sha256_immutable(self):
        a=json.loads((ROOT/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json').read_text())
        import hashlib
        self.assertEqual(len(a['original_migrations']),30)
        for r in a['original_migrations']:
            with self.subTest(r['file']):
                self.assertEqual(hashlib.sha256((ROOT/'backend/db/migrations'/r['file']).read_bytes()).hexdigest(),r['sha256'])
    def test_43_record_refs_ported_with_exact_map(self):
        for row in AUDIT['legacy_backend_sql_refs']:
            t=(ROOT/row['file']).read_text()
            self.assertIn('canone_'+row['schema']+'.'+row['object'],t)
    def test_canonical_roles_not_added_to_shared_global_bootstrap(self):
        bootstrap=(ROOT/'backend/db/shared-host/s13-isolated/prepare.py').read_text()
        self.assertNotIn("'canone_auth'",bootstrap) # 029 owns creation, no duplicates.
    def test_overlay_generation_13_review_only(self):
        a=subprocess.run([sys.executable,str(HERE/'review_overlay.py')],capture_output=True,text=True,check=True)
        d=json.loads(a.stdout)
        self.assertEqual(d['overlay_migrations'],13)
        self.assertFalse(d['safe_to_apply_to_shared_db'])
        self.assertTrue(all(x['status']=='HOLD_REVIEW_NO_GO' for x in d['rows']))
    def test_overlay_reproducible_in_temp(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            a=subprocess.run([sys.executable,str(HERE/'review_overlay.py'),'--output',temp],capture_output=True,text=True,check=True)
            for r in json.loads(a.stdout)['rows']:
                data=(pathlib.Path(temp)/(r['file']+'.txt')).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(),r['proposed_sha256'])
    def test_overlay_ported_auth_029(self):
        o=(HERE/'reviews/029_papel_de_acesso.sql.txt').read_text()
        self.assertIn('SCHEMA canone_identity',o)
        self.assertIn("n.nspname = 'canone_identity'",o)
        self.assertIn('CREATE ROLE canone_auth NOLOGIN NOINHERIT',o)
    def test_overlay_ported_027_role_owner_query(self):
        o=(HERE/'reviews/027_papel_de_sistema.sql.txt').read_text()
        self.assertIn("'canone_learning'",o)
        self.assertIn('SCHEMA canone_identity, canone_editorial',o)
        self.assertIn('ALTER FUNCTION %s OWNER TO canone_system',o)
    def test_original_029_auth_full_policy_is_explicit_release_risk(self):
        o=(HERE/'reviews/029_papel_de_acesso.sql.txt').read_text()
        self.assertIn('CREATE POLICY auth_full',o)
        self.assertIn('USING (true) WITH CHECK (true)',o)
    def test_overlay_changes_are_not_applied_to_production_source(self):
        for p in (ROOT/'backend/db/migrations').glob('*.sql'):
            self.assertNotIn('S22 REVIEW CANDIDATE ONLY',p.read_text())
    def test_distinct_app_sql_canone_identifiers(self):
        a=(ROOT/'backend/src/areas/auth/conta.ts').read_text()
        self.assertIn('canone_identity.magic_link',a)
        b=(ROOT/'backend/src/http/api.ts').read_text()
        self.assertIn('canone_commerce.subscription',b)
    def test_existing_auth_api_session_must_be_verified(self):
        t=(ROOT/'backend/src/http/server.ts').read_text()
        self.assertIn('usuarioDaSessao',t)
        self.assertIn('Bearer',t)
    def test_canone_qa_does_not_deploy(self):
        source=(ROOT/'backend/db/shared-host/s22_contracts_create.py').read_text()
        self.assertIn('deploy_allowed',source)
        self.assertNotIn('CREATE TABLE ',source)

if __name__=='__main__':unittest.main()
