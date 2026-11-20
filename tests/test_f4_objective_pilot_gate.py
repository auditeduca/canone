import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f4_objective_pilot_gate import GateError,check
DATA=json.loads((ROOT/"governance/f4_learning_objectives_pilot_v1.json").read_text())
class ObjectivesPilot(unittest.TestCase):
 def test_baseline(self):
  x=check()
  self.assertEqual(x["pilot_groups"],18)
  self.assertEqual(x["candidate_objectives"],63)
 def fail(self,edit,match):
  d=copy.deepcopy(DATA)
  edit(d)
  with self.assertRaisesRegex(GateError,match):check(d)
 def test_parent_blob_version(self):
  self.fail(lambda d:d.update(parent_git_blob_sha="0"*40),"PARENT_GIT_BLOB_DRIFT")
 def test_no_promotion(self):
  self.fail(lambda d:d["groups"][0]["objectives"][0].update(approved_lesson=True),"UNREVIEWED_CONTENT_PROMOTED")
 def test_no_publication(self):
  self.fail(lambda d:d.update(release_gate="GO"),"FALSE_PUBLICATION")
 def test_no_rights(self):
  self.fail(lambda d:d["groups"][0]["objectives"][0].update(rights_review="PUBLIC"),"UNREVIEWED")
 def test_no_forged_norm(self):
  self.fail(lambda d:d["groups"][0]["objectives"][0].update(normative_review="VERIFIED"),"UNREVIEWED")
 def test_no_missing_group(self):
  self.fail(lambda d:d["groups"].pop(),"PILOT_GROUP_COVERAGE")
 def test_group_order(self):
  self.fail(lambda d:d["groups"][0].update(parent_group_id="wrong"),"GROUP_SOURCE_ANCHOR")
 def test_objective_order(self):
  self.fail(lambda d:d["groups"][0]["objectives"][0].update(id="wrong"),"OBJECTIVE_ID")
 def test_no_exact_text_dump(self):
  self.fail(lambda d:d["groups"][0]["objectives"][0].update(original_learning_objective="x"*300),
    "OBJECTIVE_NOT_ORIGINAL")
 def test_no_repeated_difficulty(self):
  self.fail(lambda d:d["groups"][0]["objectives"][3].update(level="INTERMEDIARIO"),
    "MISSING_LEVEL_PROGRESSION")
 def test_no_objective_count_inflation(self):
  self.fail(lambda d:d["metrics"].update(candidate_objectives=999),"METRICS_OR_FALSE")
 def test_wrong_edition(self):
  self.fail(lambda d:d.update(edition="EQT-2026.2"),"FALSE_PUBLICATION")
 def test_no_wrong_pages(self):
  self.fail(lambda d:d["groups"][0].update(source_pdf_page_index=29),"GROUP_SOURCE_ANCHOR")
if __name__=="__main__":unittest.main()
