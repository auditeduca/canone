import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f4_norm_revision_gate import check,NormGateError
BASE=json.loads((ROOT/"governance/f4_norm_revision_alerts_2026_v1.json").read_text())
class NormRevisionGate(unittest.TestCase):
 def test_baseline(self):self.assertEqual(check()["affected_candidate_norms"],6)
 def bad(self,edit,error):
  x=copy.deepcopy(BASE);edit(x)
  with self.assertRaisesRegex(NormGateError,error):check(x)
 def test_notice_source(self):self.bad(lambda x:x["revision_notices"][0].update(url="https://other.example/path"),"INVALID_OFFICIAL")
 def test_notice_date(self):self.bad(lambda x:x["revision_notices"][0].update(published_dou="2027-01-01"),"INVALID_OFFICIAL")
 def test_missing_revision(self):self.bad(lambda x:x["revision_notices"].pop(),"REVISION_NOTICES_INCOMPLETE")
 def test_missing_alert(self):self.bad(lambda x:x["candidates"].pop(),"CANDIDATE_ALERT_MISSING")
 def test_unverified_effective_date(self):self.bad(lambda x:x["candidates"][0].update(text_version_for_sufficiency_cutoff_2026_09_14="CONFIRMED"),"PREMATURE_NORM")
 def test_unverified_eqt_version(self):self.bad(lambda x:x["candidates"][0].update(text_version_for_eqt_publication_2026_07_13="CONFIRMED"),"PREMATURE_NORM")
 def test_no_rights(self):self.bad(lambda x:x["candidates"][0].update(licensed_for_redistribution=True),"PREMATURE_NORM")
 def test_no_doc_hash_without_document(self):self.bad(lambda x:x["candidates"][0].update(full_norm_document_sha256="f"*64),"PREMATURE_NORM")
 def test_no_false_coverage(self):self.bad(lambda x:x["metrics"].update(verified_effective_versions=6),"FALSE_NORM")
 def test_version_source_still_hold(self):self.bad(lambda x:x["candidates"][0].update(reviewer_approved=True),"PREMATURE_NORM")
if __name__=="__main__":unittest.main()
