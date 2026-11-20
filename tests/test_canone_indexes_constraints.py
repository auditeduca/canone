"""No-DB checks for S22 indexed/ALTER conversion."""
import importlib.util,json,unittest,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('candidate',ROOT/'tools/convert_canone_constraints.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class ConvertedIndexesTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql,cls.manifest=mod.build(ROOT)
 def test_count_exact(self):
  m=self.manifest
  self.assertEqual((m['source_indexes'],m['index_generated'],m['structural_alter_generated'],len(m['index_skipped'])),(71,67,12,4))
  self.assertEqual(m['already_enforced_rls_alter_skipped'],16)
 def test_outputs_deterministic(self):
  self.assertEqual((ROOT/mod.OUT).read_text(),self.sql)
  self.assertEqual(json.loads((ROOT/mod.MANIFEST).read_text()),self.manifest)
  self.assertEqual(mod.base.sha(self.sql.encode()),self.manifest['sql_sha256'])
 def test_no_extension_index_silent_port(self):
  self.assertNotIn('gin_trgm_ops',self.sql)
  self.assertTrue(any(x['index']=='ix_content_item_search_trgm' for x in self.manifest['index_skipped']))
 def test_auth_index_not_recreated(self):
  self.assertNotRegex(self.sql,r'(?i)\bON\s+canone_identity\.session\b')
  self.assertEqual(len([x for x in self.manifest['index_skipped'] if x['reason']=='PILOT_EQUIVALENT']),2)
 def test_safe_policies_and_roles_untouched(self):
  self.assertNotRegex(self.sql,r'(?im)^\s*GRANT\b|^\s*CREATE\s+POLICY\b|^\s*CREATE\s+ROLE\b')
  self.assertIn('REFUSE_SHARED_CANONE_SOURCE',self.sql)
  self.assertNotRegex(self.sql,r'(?i)\bALTER\s+TABLE\s+identity\.account\b')
 def test_structural_fk_sequencing_before_indexes(self):
  self.assertLess(self.sql.index('fk_field_definition_enumeration'),self.sql.index('CREATE INDEX'))
  self.assertIn('canone_editorial.content_item_version(id)',self.sql)
 def test_no_shared_db_writes(self):
  self.assertFalse(self.manifest['source_db_writes'])
  self.assertEqual(self.manifest['app_release'],'NO_GO')
  self.assertEqual(self.sql.count('-- Source structural ALTER:'),12)
  self.assertEqual(self.sql.count('-- Source index:'),67)

if __name__=='__main__':unittest.main()
