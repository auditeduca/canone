"""Pure offline tests for v0.23.0-alpha.7 audit-chain and answer-key seal generator."""
from __future__ import annotations
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import convert_canone_audit_seal as converter

class AuditSealTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql,cls.manifest_text=converter.build(ROOT)
        cls.m=json.loads(cls.manifest_text)

    def test_rebuild_exact_match(self):
        self.assertEqual(self.sql,(ROOT/converter.OUTPUT).read_text())
        self.assertEqual(self.manifest_text,(ROOT/converter.MANIFEST).read_text())

    def test_all_thirty_sources_verified(self):
        self.assertEqual(self.m['source_migrations_verified'],30)
        self.assertEqual(len(self.m['sources']),3)

    def test_audit_covers_every_record_field(self):
        self.assertEqual(len(self.m['audit_fields_covered']),15)
        for f in self.m['audit_fields_covered']:
            self.assertIn("'"+f+"'",self.sql if f!='occurred_at' else self.sql.replace('occurred_at_epoch_us','occurred_at'))

    def test_sequence_written_after_transaction_lock(self):
        p=self.sql.index('pg_advisory_xact_lock')
        q=self.sql.index('NEW.seq := coalesce(v_seq, 0) + 1')
        self.assertLess(p,q)

    def test_actor_cannot_send_own_hash(self):
        for x in ('NEW.seq :=', 'NEW.prev_hash :=', 'NEW.row_hash :='):
            self.assertIn(x,self.sql)

    def test_no_privileged_definer_or_client_audit(self):
        self.assertNotIn('SECURITY DEFINER',self.sql)
        self.assertIn('REVOKE ALL ON TABLE canone_audit.audit_log',self.sql)
        self.assertIn('REVOKE ALL ON FUNCTION canone_audit.verify_chain(bigint)',self.sql)

    def test_full_chain_window_before_filter(self):
        self.assertLess(self.sql.index('lag(a.row_hash) OVER'),self.sql.index('p_from IS NULL OR r.seq'))

    def test_truncate_guard(self):
        self.assertIn('BEFORE TRUNCATE ON canone_audit.audit_log',self.sql)

    def test_existing_audit_cannot_rehash_in_place(self):
        self.assertIn('REQUIRE_EMPTY_AUDIT_CHAIN_FOR_V2_CUTOVER',self.sql)

    def test_direct_definitive_insert_rejected(self):
        self.assertIn("IF TG_OP='INSERT' THEN",self.sql)
        self.assertIn("IF NEW.status='definitivo' THEN",self.sql)

    def test_seal_is_counted_and_contiguous(self):
        for x in ('v_form_count<>v_expected','v_entry_count<>v_expected',
                  'v_form_min<>1','v_entry_min<>1','v_form_max<>v_expected',
                  'v_entry_max<>v_expected','e.ordinal IS NULL'):
            self.assertIn(x,self.sql)

    def test_isolated_guard_and_auth(self):
        self.assertIn("to_regclass('canone_control.migration_catalog')",self.sql)
        self.assertIn("to_regclass('auth.users')",self.sql)
        self.assertEqual(self.m['production_gate'],'NO_GO')

if __name__=='__main__':unittest.main()
