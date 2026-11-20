import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from f4_remaining_objectives_gate import check, GateError

BASE = json.loads((ROOT / "governance/f4_learning_objectives_remaining_64_v1.json").read_text())

class RemainingObjectives(unittest.TestCase):
    def test_baseline(self):
        self.assertEqual(check()["candidate_objectives"], 255)

    def must_fail(self, fn, expected):
        document = copy.deepcopy(BASE)
        fn(document)
        with self.assertRaisesRegex(GateError, expected):
            check(document)

    def test_source_blob(self):
        self.must_fail(lambda d: d.update(source_git_blob_sha="0" * 40), "SOURCE_OUTLINE_BLOB_DRIFT")

    def test_pilot_blob_preserved(self):
        self.must_fail(lambda d: d.update(pilot_git_blob_sha="0" * 40), "PRESERVED_PILOT_BLOB_DRIFT")

    def test_no_publication(self):
        self.must_fail(lambda d: d.update(release_gate="GO"), "EARLY_RELEASE")

    def test_no_overstated_pdf_atomization(self):
        self.must_fail(lambda d: d.update(granularity="ALL_PARAGRAPHS_APPROVED"), "EARLY_RELEASE")

    def test_all_groups_present(self):
        self.must_fail(lambda d: d["groups"].pop(), "REMAINING_64_MISSING")

    def test_parent_group_sequence(self):
        self.must_fail(lambda d: d["groups"][1].update(parent_group_id="wrong"), "GROUP_ANCHOR")

    def test_parent_letter_occurrence(self):
        self.must_fail(lambda d: d["groups"][14].update(source_occurrence=1), "GROUP_ANCHOR")

    def test_all_three_levels(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"][2].update(level="INTERMEDIARIO"),
                       "PROGRESSION_BASICO")

    def test_no_missing_objective(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"].pop(), "THREE_OBJECTIVES")

    def test_false_normative_version(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"][0].update(normative_review="VERIFIED"),
                       "OBJECTIVE_FALSE")

    def test_false_editorial_approval(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"][0].update(approved_lesson=True),
                       "OBJECTIVE_FALSE")

    def test_no_rights_release(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"][0].update(rights_review="PUBLIC"),
                       "OBJECTIVE_FALSE")

    def test_no_fake_global_percentage(self):
        self.must_fail(lambda d: d["metrics"].update(approved_lessons=255), "METRICS_DRIFT")

    def test_no_copied_large_content(self):
        self.must_fail(lambda d: d["groups"][0]["objectives"][0].update(
            original_learning_objective="texto" * 50), "DUPLICATE_OR_INVALID")

    def test_no_normative_crosswalk_forgery(self):
        self.must_fail(lambda d: d["groups"][0].update(normative_candidates=["NBC 999 FAKE"]),
                       "GROUP_FALSE_APPROVAL")

if __name__ == "__main__":
    unittest.main()
