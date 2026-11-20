"""Deterministic tests for Supabase crosswalk; no database, network or secrets."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GEN=ROOT/'tools/canone_supabase_crosswalk.py'
spec=importlib.util.spec_from_file_location('canone_crosswalk',GEN)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestCanonicalCrosswalk(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=mod.build(ROOT)
    def test_01_all_s22_migration_sha_verified(self):
        self.assertEqual(len(self.c['migrations']),30)
        self.assertEqual([x['number'] for x in self.c['migrations']],list(range(1,31)))
        self.assertTrue(all(x['original_retained_unchanged'] for x in self.c['migrations']))
        self.assertTrue(all(x['deployment_state']=='NOT_APPLIED' for x in self.c['migrations']))
    def test_02_fourteen_isolated_schema_names(self):
        schemas=self.c['schemas']
        self.assertEqual(len(schemas),14)
        self.assertEqual(len(set(x['new'] for x in schemas)),14)
        self.assertTrue(all(x['new']=='canone_'+x['old'] for x in schemas))
        self.assertIn(dict(old='public',new='canone_public'),schemas)
        self.assertNotIn('auth',[x['new'] for x in schemas])
        self.assertNotIn('public',[x['new'] for x in schemas])
    def test_03_roles_are_mapped_to_platform_authorities(self):
        roles={x['legacy']:x for x in self.c['roles']}
        self.assertEqual(len(roles),9)
        self.assertEqual(roles['canone_public']['target'],'anon')
        self.assertEqual(roles['canone_subscriber']['target'],'authenticated')
        self.assertNotEqual(roles['canone_auth']['target'],'service_role')
        self.assertIn('JWT', roles['canone_app']['rule'])
    def test_04_auth_separation_and_no_client_metadata_access(self):
        auth={x['legacy']:x for x in self.c['auth_identity']}
        self.assertEqual(auth['identity.account.id']['target'],'auth.users.id')
        self.assertIn('foreign_key',auth['identity.user_profile.user_id']['strategy'])
        self.assertEqual(auth['identity.account.password_hash']['strategy'],'retire_legacy_credential')
        self.assertEqual(auth['identity.magic_link']['strategy'],'replace_auth_runtime')
        self.assertEqual(auth['ops.current_user_id()']['target'],'auth.uid()')
        self.assertFalse(self.c['changes_to_shared_supabase'])
    def test_05_critical_fk_has_lineage_no_wholesale_copy(self):
        refs=self.c['shared_foreign_key_bindings']
        self.assertEqual(len(refs),3)
        self.assertIn('public.regulatory_instruments.instrument_id',[x['legacy_target'] for x in refs])
        self.assertTrue(all(x['method']=='reference_only' for x in refs))
    def test_06_every_migration_has_actionable_transformation(self):
        for item in self.c['migrations']:
            self.assertTrue(item['workstream'],item['source'])
            self.assertTrue(len(item['transformation_rule'])>30,item['source'])
            self.assertTrue(all(v.startswith('canone_') for v in item['target_schemas']))
    def test_07_output_is_deterministic_no_unreviewed_source_change(self):
        canonical=(ROOT/mod.OUT).read_text(encoding='utf-8')
        self.assertEqual(canonical,json.dumps(self.c,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
        self.assertEqual((ROOT/'docs/CROSSWALK_PADRAO_SUPABASE_0_23_0_ALPHA2.md').read_text(encoding='utf-8'),mod.render_md(self.c))
    def test_08_version_and_release_gate(self):
        self.assertEqual(self.c['version'],'0.23.0-alpha.2')
        self.assertEqual(self.c['production_gate'],'NO_GO')
        self.assertEqual(self.c['ci_contract'],'map-all-30, sha-all-30, no-write, test security boundaries')

if __name__=='__main__':unittest.main()
