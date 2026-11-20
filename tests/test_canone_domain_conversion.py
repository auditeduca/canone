"""Independent controls for physical Cânone 82-table conversion (no DB)."""
import importlib.util, json, re, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'tools/convert_canone_schema.py'
spec=importlib.util.spec_from_file_location('canone_domain_convert',SCRIPT)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class DomainConversionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql,cls.manifest=mod.build(ROOT)

    def test_tables_accounted(self):
        m=self.manifest
        self.assertEqual((m['table_total'],m['generated_table_count'],m['managed_auth_tables'],m['pilot_owned_existing_tables']),(90,82,3,5))
        self.assertEqual(m['canonical_domain_tables_accounted'],87)

    def test_source_parity_and_sha(self):
        self.assertEqual(len(self.manifest['source_migrations']),30)
        for obj in self.manifest['source_migrations']:
            self.assertEqual(mod.sha((ROOT/mod.SOURCE/obj['file']).read_bytes()),obj['sha256'])

    def test_generator_is_deterministic(self):
        self.assertEqual((ROOT/mod.OUT_SQL).read_text(),self.sql)
        self.assertEqual(json.loads((ROOT/mod.OUT_MANIFEST).read_text()),self.manifest)
        self.assertEqual(mod.sha(self.sql.encode()),self.manifest['generated_sql_sha256'])

    def test_enum_dependencies_generated_before_tables(self):
        self.assertEqual(self.manifest['generated_enum_type_count'],3)
        expected={'canone_learning.review_grade','canone_learning.review_basis','canone_learning.session_kind'}
        self.assertEqual({x['target'] for x in self.manifest['generated_enum_types']},expected)
        self.assertLess(self.sql.index('CREATE TYPE canone_learning.session_kind'),self.sql.index('CREATE TABLE canone_learning.session'))

    def test_no_custom_auth_credential_tables(self):
        self.assertNotRegex(self.sql,r'(?i)\bCREATE\s+TABLE\s+(?:canone_)?identity\.(?:account|session|magic_link)\b')
        self.assertEqual(len(re.findall(r'(?im)^CREATE TABLE canone_\w+\.\w+',self.sql)),82)

    def test_auth_fk_rewritten_no_reference_to_legacy(self):
        self.assertEqual(self.manifest['auth_fk_in_generated_statements'],38)
        self.assertNotRegex(self.sql,r'(?i)\bREFERENCES\s+(?:canone_)?identity\.account\b')
        self.assertIn('REFERENCES auth.users(id)',self.sql)

    def test_all_fk_targets_accounted(self):
        obj={x['target'] for x in self.manifest['generated'] if x['strategy']=='generated_candidate'}
        pilot={'canone_identity.user_profile','canone_identity.private_profile','canone_identity.role',
               'canone_identity.user_role','canone_identity.consent_purpose','canone_identity.consent','canone_bridge.source_binding'}
        ref=set(re.findall(r'(?i)\bREFERENCES\s+([a-z_]+\.[a-z_]+)\s*\(',self.sql))
        self.assertFalse(ref-obj-pilot-{'auth.users'},ref-obj-pilot-{'auth.users'})

    def test_no_client_grants_or_policies_emitted(self):
        self.assertNotRegex(self.sql,r'(?im)^\s*CREATE\s+POLICY\b')
        self.assertNotRegex(self.sql,r'(?im)^\s*GRANT\b')
        self.assertEqual(len(re.findall(r'(?im)^ALTER TABLE canone_\w+\.\w+ FORCE ROW LEVEL SECURITY;',self.sql)),82)
        self.assertEqual(len(re.findall(r'(?im)^ALTER TABLE canone_\w+\.\w+ ENABLE ROW LEVEL SECURITY;',self.sql)),82)
        self.assertEqual(len(re.findall(r'(?im)^REVOKE ALL ON TABLE canone_\w+\.\w+ FROM PUBLIC, anon, authenticated;',self.sql)),82)

    def test_shared_source_guard_and_no_service_role(self):
        self.assertIn('REFUSE_SHARED_CANONE_SOURCE',self.sql)
        self.assertNotRegex(self.sql,r'(?im)^\s*CREATE\s+ROLE\b|SET\s+(?:LOCAL\s+)?ROLE\b')
        self.assertNotIn('SERVICE_ROLE_KEY',self.sql)

    def test_sql_split_handles_procedural_and_comments(self):
        src="-- before;\nCREATE TABLE identity.thing (n text DEFAULT 'a;b');\nDO $x$ BEGIN PERFORM 1; PERFORM 2; END $x$;\n/* comment; */ SELECT 1;"
        vals=mod.split_statements(src)
        self.assertEqual(len(vals),3)
        self.assertTrue(mod.clean_leading(vals[0][0]).startswith('CREATE TABLE'))
        self.assertTrue(mod.clean_leading(vals[1][0]).startswith('DO'))

    def test_quoted_strings_and_comments_remain_unchanged(self):
        s="CREATE TABLE identity.foo (message text DEFAULT 'identity.account', ref uuid REFERENCES identity.account(id)); -- identity.account\n"
        changed=mod.rewrite_identifiers(s,{'identity':'canone_identity'})
        self.assertIn("DEFAULT 'identity.account'",changed)
        self.assertIn('REFERENCES canone_identity.account(id)',changed)
        self.assertIn('-- identity.account',changed)

    def test_all_other_statements_inventory_and_no_direct_application(self):
        self.assertGreater(sum(x['other_statement_count'] for x in self.manifest['not_converted']),100)
        self.assertEqual(self.manifest['release_gate'],'NO_GO')
        self.assertIs(self.manifest['changes_to_remote_supabase'],False)
        self.assertTrue(str(mod.OUT_SQL).endswith('.candidate.sql.txt'))

if __name__=='__main__':unittest.main()
