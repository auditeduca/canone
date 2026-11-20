"""NS-01 source-to-candidate declaration reconciliation adversarial tests."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('ns01_reconciliation',ROOT/'tools/reconcile_s22_objects.py')
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)

class ReconciliationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inventory, cls.md = MOD.reconstruct(ROOT)

    def test_all_source_statements_are_preserved(self):
        inv = self.inventory
        self.assertEqual(inv['source_migrations_verified'],30)
        self.assertEqual(inv['candidate_file_count'],10)
        self.assertEqual(sum(inv['source_statements'].values()),182)
        for cat, expected in MOD.COUNTS.items():
            self.assertEqual(len(inv['objects'][cat]),expected)
            self.assertEqual(sum(inv['status_counts'][cat].values()),expected)
            self.assertTrue(all(not x['production_ready'] for x in inv['objects'][cat]))
            self.assertTrue(all(x['source_sha256'] and x['source'] and x['line'] for x in inv['objects'][cat]))

    def test_closed_inventory_does_not_claim_finished_functions(self):
        self.assertEqual(self.inventory['status_counts']['functions']['UNPORTED'],40)
        self.assertEqual(self.inventory['status_counts']['functions']['CONTRACT_SUCCESSOR_REVIEW'],7)
        self.assertEqual(self.inventory['status_counts']['functions']['SAME_NAME_CANDIDATE_PRESENT'],11)

    def test_triggers_account_for_missing_and_renamed_hash_guard(self):
        items=self.inventory['objects']['triggers']
        self.assertEqual(self.inventory['status_counts']['triggers']['UNPORTED'],17)
        old=next(x for x in items if x['name']=='trg_audit_hash')
        self.assertEqual(old['status'],'CONTRACT_SUCCESSOR_REVIEW')
        self.assertEqual(old['candidates'][-1]['target'],'trg_audit_chain_insert')
        self.assertIn('canone_audit',old['candidates'][-1]['table'])

    def test_source_views_explicitly_deferred_without_fabricating_success(self):
        statuses={x['name']:x['status'] for x in self.inventory['objects']['views']}
        self.assertEqual(statuses['subscriber.v_my_due'],'DEFERRED_DEPENDENCY')
        self.assertEqual(statuses['admin.v_user_overview'],'DEFERRED_DEPENDENCY')
        self.assertEqual(sum(x=='VIEW_CANDIDATE_PRESENT' for x in statuses.values()),16)

    def test_rls_sources_are_not_blindly_ported(self):
        items=self.inventory['objects']['policies']
        self.assertEqual(self.inventory['status_counts']['policies']['SECURITY_REVIEW_REQUIRED'],67)
        self.assertEqual(self.inventory['status_counts']['policies']['NARROWER_OWNER_POLICY_CANDIDATE'],13)
        for row in items:
            if row['name'].startswith(('admin_','staff_')):
                self.assertEqual(row['status'],'SECURITY_REVIEW_REQUIRED')
        self.assertEqual(next(x for x in items if x['name']=='sub_insert_request')['status'],
                         'NARROWER_OWNER_POLICY_CANDIDATE')

    def test_risk_tags_surface_privileged_original_code(self):
        items=self.inventory['objects']['functions']
        self.assertTrue(any('SECURITY_DEFINER_SOURCE' in r['risk_tags'] for r in items))
        self.assertTrue(any('LEGACY_AUTH_GUC_OR_ROLE' in r['risk_tags'] for r in items))
        self.assertTrue(any(r['status']=='UNPORTED' and 'SECURITY_DEFINER_SOURCE' in r['risk_tags'] for r in items))

    def test_candidate_order_hashes_and_overrides(self):
        inputs=self.inventory['candidate_sha256']
        self.assertEqual(len(inputs),10)
        self.assertEqual([int(Path(k).name[:3]) for k in sorted(inputs)],list(range(1,11)))
        self.assertGreaterEqual(len(self.inventory['staged_name_overrides']),2)
        self.assertIn('NO_DEPLOY',self.inventory['status'])

    def test_markdown_matches_manifest_and_retains_unported_evidence(self):
        self.assertIn('UNPORTED',self.md)
        self.assertIn('SECURITY_REVIEW_REQUIRED',self.md)
        self.assertIn('subscriber.v_my_due',self.md)
        self.assertIn('admin.v_user_overview',self.md)
        self.assertIn('Supabase',self.md)

    def test_detects_tampered_historical_migration(self):
        with tempfile.TemporaryDirectory() as td:
            r=self._fixture(Path(td))
            path=r/MOD.SOURCE/'001_schemas_roles.sql'
            path.write_bytes(path.read_bytes()+b'\n--tampered\n')
            with self.assertRaisesRegex(ValueError,'Historical source SQL hash mismatch'):
                MOD.reconstruct(r)

    def test_detects_tampered_candidate_even_if_ddl_still_compiles(self):
        with tempfile.TemporaryDirectory() as td:
            r=self._fixture(Path(td))
            path=next((r/MOD.CANDIDATES).glob('010_*.candidate.sql.txt'))
            path.write_bytes(path.read_bytes()+b'\n--tampered\n')
            with self.assertRaisesRegex(ValueError,'Previously attested candidate SQL hash mismatch'):
                MOD.reconstruct(r)

    def test_detects_fabricated_historical_statement_sha(self):
        with tempfile.TemporaryDirectory() as td:
            r=self._fixture(Path(td))
            f=r/MOD.HISTORICAL
            doc=json.loads(f.read_text())
            doc['objects']['functions'][0]['sha256']='0'*64
            f.write_text(json.dumps(doc))
            with self.assertRaisesRegex(ValueError,'Historical statement SHA/line mismatch'):
                MOD.reconstruct(r)

    def test_generated_files_reproducible(self):
        self.assertEqual((ROOT/MOD.OUTPUT_JSON).read_text(),
                         json.dumps(self.inventory,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
        self.assertEqual((ROOT/MOD.OUTPUT_MD).read_text(),self.md)

    @staticmethod
    def _fixture(root):
        # Copy only the <=1MB needed for the exact source/attestation contract.
        dirs=[MOD.SOURCE,MOD.CANDIDATES]
        for d in dirs:
            shutil.copytree(ROOT/d,root/d)
        files=[MOD.SOURCE_MANIFEST,MOD.HISTORICAL,MOD.CROSSWALK,
               Path('tools/convert_canone_schema.py')]
        for f in files:
            dest=root/f
            dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/f,dest)
        return root

if __name__=='__main__':unittest.main()
