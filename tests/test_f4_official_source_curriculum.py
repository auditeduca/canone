import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f4_official_source_curriculum import check,GateError
BASE=json.loads((ROOT/"governance/f4_official_source_curriculum_v1.json").read_text())
class F4Case(unittest.TestCase):
 def test_baseline(self):
  metrics=check()
  self.assertEqual(metrics["official_editions"],2)
  self.assertEqual(metrics["subjects_mapped_as_planning_only"],13)
  self.assertEqual(metrics["tracks_in_s23"],7)
  self.assertEqual(metrics["modules_in_s23"],26)
  self.assertEqual(metrics["public_items"],0)
 def bad(self,edit,code):
  data=copy.deepcopy(BASE);edit(data)
  with self.assertRaisesRegex(GateError,code):check(data)
 def test_no_go(self):self.bad(lambda d:d.update(publication_gate="GO"),"F4_NOT_NO_GO")
 def test_rights_not_inferred(self):
  self.bad(lambda d:d["sources"][2].update(reproduction_permission="PUBLIC"),"SOURCE_NOT_VERIFIED")
 def test_no_source_licenses(self):
  self.bad(lambda d:d["exam_editions"][1].update(licensed_questions=1),"UNLICENSED_EXAM_RELEASE")
 def test_no_early_gabarito(self):
  self.bad(lambda d:d["exam_editions"][1].update(stage="OFFICIAL_FINAL_KEY"),"EXAM_2026_3_PREMATURE_KEY")
 def test_no_false_coverage(self):
  self.bad(lambda d:d["curriculum_areas"][0].update(approved_questions=100),"FALSE_CONTENT_COVERAGE")
 def test_no_unsupported_module(self):
  self.bad(lambda d:d["curriculum_areas"][0]["candidate_module_ids"].append("invented-mod"),"UNKNOWN_MODULE")
 def test_wrong_cutoff(self):
  self.bad(lambda d:d["exam_editions"][1].update(norm_cutoff="2026-12-13"),"NORMATIVE_CUTOFF_DRIFT")
 def test_no_public_items(self):
  self.bad(lambda d:d["release_policy"].update(public_questions=1),"FALSE_PRODUCTION")
 def test_eight_tracks_unapproved(self):
  self.bad(lambda d:d["track_policy"].update(expected_tracks=8),"TRACK_PREMATURE")
 def test_legal_review_required(self):
  self.bad(lambda d:d["release_policy"].update(required_checks=[]),"LEGAL_SIGNOFF_MISSING")
 def test_every_area_exactly_from_edital(self):
  self.bad(lambda d:d["curriculum_areas"][0].update(name="invented"),"EDITAL_SUBJECTS_DRIFT")
if __name__=="__main__":unittest.main()
