"""Safety tests for versioned S22 behaviour candidate conversion (never DB/deploy)."""
from __future__ import annotations
import importlib.util, json, pathlib, re, shutil, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('canone_behavior_convert',ROOT/'tools/convert_canone_behaviour.py')
m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)

class BehaviourConversionContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.views,cls.policies,cls.auth_function,cls.report=m.build(ROOT)
    def test_source_inventory_parity(self):
        self.assertEqual(self.report['objects_by_category'],{'functions':58,'triggers':26,'views':18,'policies':80})
    def test_view_projection_denies_definer(self):
        self.assertEqual(self.views.count('WITH (security_invoker = true)'),16)
        self.assertNotIn('OWNER TO canone_system',self.views)
        self.assertNotIn('SECURITY DEFINER',self.views)
    def test_managed_auth_never_restored(self):
        self.assertNotRegex(self.views,r'(?i)FROM\s+(?:identity|canone_identity)\.account\b')
        self.assertNotRegex(self.views,r'(?i)ops\.current_user_id\(')
        self.assertNotRegex(self.views,r'(?i)app\.current_user_id')
    def test_view_gaps_named(self):
        self.assertEqual(set(self.report['views_excluded']),{'subscriber.v_my_due','admin.v_user_overview'})
    def test_public_data_api_not_granted(self):
        self.assertNotRegex(self.views,r'(?i)GRANT\s+')
        self.assertNotRegex(self.policies,r'(?i)TO\s+anon\b')
    def test_legacy_staff_admin_not_trusted(self):
        self.assertNotRegex(self.policies,r'(?i)TO\s+canone_(?:staff|admin|app|system)\b')
        self.assertNotIn('WITH CHECK (true)',self.policies)
    def test_owner_bound_scope(self):
        self.assertEqual(self.report['read_policy_tables'],12)
        self.assertEqual(self.report['owner_policy_operations'],18)
        self.assertEqual(self.policies.count('CREATE POLICY'),18)
        self.assertIn('user_id = (select auth.uid())',self.policies)
    def test_grade_immutability_and_billing_writes_not_exposed(self):
        self.assertNotRegex(self.policies,r'(?i)GRANT\s+(?:UPDATE|DELETE|INSERT)\s+ON\s+TABLE\s+canone_learning\.review_event')
        self.assertNotRegex(self.policies,r'(?i)GRANT\s+(?:UPDATE|DELETE|INSERT)\s+ON\s+TABLE\s+canone_commerce\.')
        self.assertNotIn('canone_learning.answer_key',self.policies)
        self.assertNotIn('canone_learning.item_option',self.policies)
    def test_hashes_and_snapshot(self):
        self.assertEqual(self.report['out_views_sha256'],m.base.sha(self.views.encode('utf8')))
        self.assertEqual(self.report['out_policies_sha256'],m.base.sha(self.policies.encode('utf8')))
        self.assertEqual((ROOT/m.OUT_VIEWS).read_text(),self.views)
        self.assertEqual((ROOT/m.OUT_POLICIES).read_text(),self.policies)
        self.assertEqual((ROOT/m.OUT_AUTH).read_text(),self.auth_function)
        self.assertIn('SELECT auth.uid()',self.auth_function)
        self.assertNotIn('app.current_user_id',self.auth_function.split('BEGIN;')[1])
    def test_no_unreviewed_function_or_trigger_migration(self):
        self.assertEqual(self.report['unported_functions'],57)
        self.assertEqual(self.report['unported_triggers'],26)
        self.assertNotRegex(self.views+r'\n'+self.policies,r'(?i)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b')
        self.assertNotRegex(self.views+r'\n'+self.policies,r'(?i)CREATE\s+TRIGGER\b')
    def test_deny_by_default_no_legacy_guc(self):
        for sql in (self.views,self.policies):
            self.assertIn('REFUSE_SHARED_CANONE_SOURCE',sql)
            self.assertNotIn('SET LOCAL ROLE',sql)
            self.assertNotIn('app.current_area',sql)
    def test_determinism(self):
        v,p,f,o=m.build(ROOT)
        self.assertEqual((v,p,f), (self.views,self.policies,self.auth_function))
        self.assertEqual(json.dumps(o,sort_keys=True),json.dumps(self.report,sort_keys=True))

if __name__=='__main__':unittest.main()
