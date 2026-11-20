import copy
from datetime import date
import json
import sys
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f3_rec07_editorial_rights_gate import check, RightsGateError, POLICY

class EditorialRightsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline=json.loads(POLICY.read_text(encoding="utf8"))
    def candidate(self):
        return copy.deepcopy(self.baseline)
    def assertHold(self,change,reason):
        data=self.candidate()
        change(data)
        with self.assertRaisesRegex(RightsGateError,reason):
            check(data,today=date(2026,11,20))
    def test_baseline_test_only_and_external_hold(self):
        self.assertEqual(check(self.candidate(),today=date(2026,11,20),require_baseline=True),
                         {"TEST_ONLY":2,"HOLD_RIGHTS":3,"REJECTED":0})
    def test_cannot_go_live_by_editing_registry(self):
        self.assertHold(lambda x:x.update(production_gate="GO"),"EARLY_PRODUCTION")
    def test_public_release_not_in_v1(self):
        self.assertHold(lambda x:x["assets"][0].update(state="APPROVED_FOR_PUBLICATION"),"RELEASE_REQUIRES_F4")
    def test_third_party_reproduction_cannot_be_test_only(self):
        self.assertHold(lambda x:x["assets"][2].update(state="TEST_ONLY"),"TEST_SCOPE")
    def test_third_party_hold_cannot_claim_distribution(self):
        self.assertHold(lambda x:x["assets"][2].update(permitted_scope=["COMMERCIAL_APP"]), "HOLD_OR_REJECTED")
    def test_test_only_must_use_synthetic_scope(self):
        self.assertHold(lambda x:x["assets"][0].update(permitted_scope=["PUBLIC_WEB"]), "TEST_SCOPE")
    def test_reviewers_independent(self):
        self.assertHold(lambda x:x["assets"][0].update(reviewers=["ci-reviewer","ci-reviewer"]),"INDEPENDENT")
    def test_synthetic_grant_expiration(self):
        self.assertHold(lambda x:x["assets"][0].update(expires_on="2020-01-01"),"EXPIRED")
    def test_duplicate_ids(self):
        self.assertHold(lambda x:x["assets"].append(copy.deepcopy(x["assets"][0])),"DUPLICATE")
    def test_unexpected_release_key_not_silently_ignored(self):
        self.assertHold(lambda x:x["assets"][0].update(correct_option="A"),"ENTRY_SHAPE")
    def test_disallow_missing_baseline_assets(self):
        d=self.candidate()
        d["assets"].pop()
        with self.assertRaisesRegex(RightsGateError,"BASELINE|MISSING"):
            check(d,today=date(2026,11,20),require_baseline=True)

if __name__=="__main__":unittest.main()
