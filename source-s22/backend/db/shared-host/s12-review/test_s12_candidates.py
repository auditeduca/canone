#!/usr/bin/env python3
"""S12 gates are static, intentionally not a substitute for PostgreSQL integration."""
from pathlib import Path
import json
import re
import subprocess
import sys
import os
import tempfile
import unittest
from importlib.machinery import SourceFileLoader

ROOT=Path(__file__).parent
SOURCE=Path(os.environ.get('S12_SOURCE_ROOT') or (ROOT.parents[3] if len(ROOT.parents)>3 and (ROOT.parents[3]/'backend/db/migrations').exists() else (ROOT.parent/'canone_s11_source'))).resolve()
GEN=ROOT/'s12_generate_candidates.py'
M=json.loads((ROOT/'S12_MANIFEST.json').read_text())
F=lambda n: next((ROOT/'reviews').glob(f'S12_REVIEW_ONLY_{n:03d}_*.sql.txt')).read_text()

class GateS12(unittest.TestCase):
    def test_01_all_10_review_candidates_and_hashes(self):
        self.assertEqual([x['migration'] for x in M['items']],[6,7,8,9,10,11,12,13,14,17])
        self.assertEqual(M['source_migrations_modified'],0)
        self.assertEqual(M['live_executable_count'],0)
        self.assertEqual(M['production_gate'],'HOLD_HUMAN_NO_GO')
        import hashlib
        for r in M['items']:
            content=F(r['migration']);self.assertEqual(hashlib.sha256(content.encode()).hexdigest(),r['s12_candidate_sha256'])
            self.assertIn('NEVER EXECUTE',content)
    def test_02_no_old_schema_code_in_dollar_body(self):
        pat=re.compile(r'(?<![\w])(?:identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit|public|subscriber)\.[a-zA-Z_]')
        for r in M['items']:
            content=F(r['migration'])
            bodies=re.findall(r'\$\$(.*?)\$\$',content,re.S)
            self.assertFalse([m.group(0) for body in bodies for m in pat.finditer(body)],r['file'])
    def test_03_rls_loop_scoped_9_schemas(self):
        a=F(14)
        for name in ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit'):
            self.assertIn("'canone_"+name+"'",a)
        self.assertNotIn("('identity','editorial'",a)
        self.assertIn('ENABLE ROW LEVEL SECURITY',a)
        self.assertIn('FORCE ROW LEVEL SECURITY',a)
    def test_04_staff_not_self_issuing_access(self):
        a=F(14);b=F(17)
        self.assertNotIn('CREATE POLICY staff_insert_grant',a)
        self.assertIn('staff_read_grant ON canone_admin.support_access_grant FOR SELECT',a)
        self.assertIn('REVOKE INSERT, UPDATE, DELETE ON canone_admin.support_access_grant FROM canone_staff',b)
        self.assertNotIn('canone_admin.support_access_grant, canone_admin.moderation_queue',b)
        self.assertIn('p_staff_user_id IS DISTINCT FROM canone_ops.current_user_id()',a)
    def test_05_no_global_public_schema_ddl_or_acl(self):
        a=F(17)
        self.assertNotRegex(a,r'(?m)^\s*(?:GRANT|REVOKE)\s+[^;]*?\bSCHEMA\s+public\b')
        self.assertIn('GRANT USAGE ON SCHEMA canone_public, canone_subscriber',a)
    def test_06_grade_definer_hardened(self):
        a=F(6)
        self.assertIn('SET search_path = pg_catalog, canone_learning, pg_temp',a)
        self.assertIn('REVOKE ALL ON FUNCTION canone_learning.grade_answer(uuid, text) FROM PUBLIC',a)
        self.assertIn('SELECT 1 FROM canone_learning.item_option',a)
    def test_07_subscriber_view_and_acl(self):
        a=F(13);b=F(17)
        self.assertIn('v_my_progress WITH (security_invoker = true)',a)
        self.assertIn('WHERE s.user_id = canone_ops.current_user_id()',a)
        self.assertIn('GRANT SELECT ON canone_taxonomy.subject TO canone_subscriber',b)
        self.assertNotIn('canone_admin.v_user_mastery,\n',b)
    def test_08_no_dynamic_trigger_legacy(self):
        a=F(11)
        self.assertIn('FUNCTION canone_ops.touch_updated_at()',a)
        for name in ('identity.account','identity.user_profile','editorial.content_item','editorial.verification',
                     'learning.item','learning.user_item_state','learning.mastery','learning.note',
                     'commerce.plan','commerce.subscription','ops.setting','ops.integration','ops.webhook'):
            self.assertIn("'canone_"+name+"'",a)
    def test_09_audit_serialization_proposed(self):
        a=F(9)
        self.assertIn('pg_advisory_xact_lock(93112026)',a)
        self.assertIn('FROM canone_audit.audit_log ORDER BY seq DESC',a)
    def test_10_staff_cannot_see_secret_settings(self):
        a=F(14)
        self.assertIn("NOT is_secret AND scope IN ('staff','global')",a)
        self.assertNotIn("NOT is_secret OR scope IN ('staff','global')",a)
    def test_11_privileged_grants_are_specific(self):
        a=F(14);b=F(6);c=F(17)
        self.assertIn('REVOKE ALL ON FUNCTION canone_admin.read_user_progress_as(uuid, uuid, uuid) FROM PUBLIC',a)
        self.assertIn('REVOKE ALL ON FUNCTION canone_learning.grade_answer(uuid, text) FROM PUBLIC',b)
        self.assertIn('GRANT EXECUTE ON FUNCTION canone_admin.read_user_progress_as',c)
    def test_12_no_live_output_suffix(self):
        self.assertFalse(list(ROOT.glob('reviews/*.sql')))
        self.assertEqual(len(list(ROOT.glob('reviews/*.txt'))),10)
    def test_13_deterministic_generator(self):
        with tempfile.TemporaryDirectory() as folder:
            r=subprocess.run([sys.executable,str(GEN),'--source',str(SOURCE),
                              '--output',folder],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr)
            import hashlib
            for x in M['items']:
                target=Path(folder)/'reviews'/f"S12_REVIEW_ONLY_{x['file']}.txt"
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(),x['s12_candidate_sha256'])
    def test_14_gate_rejects_mutated_s11_sources(self):
        with tempfile.TemporaryDirectory() as folder:
            from shutil import copytree
            f=Path(folder)/'app'
            src=SOURCE
            copytree(src/'backend/db/migrations',f/'backend/db/migrations')
            copytree(src/'backend/db/shared-host/generated/s11-review-only',f/'backend/db/shared-host/generated/s11-review-only')
            (f/'backend/db/shared-host').mkdir(parents=True,exist_ok=True)
            from shutil import copy2
            copy2(src/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json',f/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json')
            copy2(src/'backend/db/shared-host/s11-review-all.mjs',f/'backend/db/shared-host/s11-review-all.mjs')
            (f/'backend/db/migrations/014_rls.sql').write_text((f/'backend/db/migrations/014_rls.sql').read_text()+'\n--tamper')
            r=subprocess.run([sys.executable,str(GEN),'--source',str(f),'--output',str(Path(folder)/'out')],capture_output=True,text=True)
            self.assertEqual(r.returncode,5)
            self.assertIn('source changed 014_rls.sql',r.stderr)

if __name__=='__main__':unittest.main(verbosity=2)
