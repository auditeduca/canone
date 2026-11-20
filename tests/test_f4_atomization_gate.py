import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f4_atomization_gate import check,GateError
BASE=json.loads((ROOT/"governance/f4_annex02_outline_v1.json").read_text(encoding="utf8"))
class F4AtomizationTest(unittest.TestCase):
 def test_baseline(self):
  result=check()
  self.assertEqual((result["sections"],result["source_letter_groups"],result["eqt_modalities"],
                   result["eqt_candidate_clusters"],result["approved_lessons"]),(13,82,6,30,0))
 def bad(self,edit,reason):
  d=copy.deepcopy(BASE)
  edit(d)
  with self.assertRaisesRegex(GateError,reason):check(d)
 def test_no_missing_source_group(self):
  self.bad(lambda d:d["sufficiency"][2]["groups"].pop(3),"MISSING_OR_EXTRA")
 def test_duplicate_letter_is_not_overwritten(self):
  self.bad(lambda d:d["sufficiency"][2]["groups"][14].update(source_occurrence=1),"SUBGROUP_LABEL")
 def test_preserve_sequence_ids(self):
  self.bad(lambda d:d["sufficiency"][0]["groups"][0].update(id="CFC-A07-A"),"SUBGROUP_LABEL")
 def test_no_editors_approved_without_review(self):
  self.bad(lambda d:d["sufficiency"][0]["groups"][0].update(approved_lessons=1),"UNVERIFIED_SUBTOPIC")
 def test_no_deep_claim(self):
  self.bad(lambda d:d.update(granularity="EVERY_PARAGRAPH_VALIDATED"),"FALSE_DEEP")
 def test_no_wrong_regulatory_cutoff(self):
  self.bad(lambda d:d["sources"][1].update(cutoff_basis="EXAM_MINUS_90_DAYS"),"EQT_SOURCE")
 def test_no_wrong_publication_cutoff(self):
  self.bad(lambda d:d["sources"][0].update(norm_cutoff="2026-12-13"),"SUFFICIENCY_SOURCE")
 def test_missing_eqt_disciplines(self):
  self.bad(lambda d:d["eqt_outline"].pop(),"EQT_SIX_SECTIONS")
 def test_eqt_no_official_release(self):
  self.bad(lambda d:d["eqt_outline"][0]["clusters"][0].update(rights_status="PUBLIC"),"EQT_CLUSTER")
 def test_no_unverified_norm_version(self):
  self.bad(lambda d:d["normative_candidates"][0].update(version_at_eqt_2026_2_publication="R2 VERIFIED"),"UNVERIFIED_NORM")
 def test_no_norm_text_without_hash(self):
  self.bad(lambda d:d["normative_candidates"][0].update(primary_full_text_url="https://cfc.org.br/fake.pdf"),"UNVERIFIED_NORM")
 def test_no_false_metrics(self):
  self.bad(lambda d:d["declared_metrics"].update(approved_lessons=1),"METRICS_DRIFT")
 def test_paraphrases_short(self):
  self.bad(lambda d:d["sufficiency"][0]["groups"][0].update(label_paraphrase="long"*40),"PARAPHRASE")
 def test_orphan_norm(self):
  self.bad(lambda d:d["normative_candidates"].pop(),"NORMATIVE_CANDIDATE_LINEAGE")
if __name__=="__main__":unittest.main()
