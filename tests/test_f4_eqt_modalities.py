import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from f4_eqt_modalities import check,EQTError
BASE=json.loads((ROOT/"governance/f4_eqt_modalities_2026_2_v1.json").read_text())
class EQT(unittest.TestCase):
 def test_baseline(self):self.assertEqual(check()["modalities_official"],6)
 def invalid(self,change,pat):
  d=copy.deepcopy(BASE);change(d)
  with self.assertRaisesRegex(EQTError,pat):check(d)
 def test_not_sufficiency_50x4(self):self.invalid(lambda d:d["assessment_contract"].update(objective_options=4),"EQT_FORMAT_DRIFT")
 def test_discursive_required(self):self.invalid(lambda d:d["assessment_contract"].update(discursive_questions=0),"EQT_FORMAT_DRIFT")
 def test_norm_cutoff_not_90_days(self):self.invalid(lambda d:d["sources"].update(normative_cutoff_basis="EXAM_MINUS_90_DAYS"),"EQT_NORM_RULE")
 def test_not_released(self):self.invalid(lambda d:d["sources"].update(legal_rights="PUBLIC"),"UNLICENSED_CONTENT")
 def test_no_fake_human_approval(self):self.invalid(lambda d:d["release_gates"].update(license_human_signoff=True),"FALSE_EQT_GO")
 def test_all_six_modalities(self):self.invalid(lambda d:d["modalities"].pop(),"EQT_MODALITIES_MISMATCH")
 def test_date_drift(self):self.invalid(lambda d:d["modalities"][0].update(exam_date="2026-09-29"),"EQT_MODALITIES_MISMATCH")
 def test_no_sufficiency_rules(self):self.invalid(lambda d:d["release_gates"].update(sufficiency_rules_may_be_reused=True),"FALSE_EQT_GO")
 def test_untrusted_notice(self):self.invalid(lambda d:d["sources"].update(official_page="https://some-site.example/page"),"EQT_UNTRUSTED")
 def test_no_approved_content(self):self.invalid(lambda d:d["modalities"][0].update(content_approved=25),"FALSE_EQT_HOMOLOGATION")
if __name__=="__main__":unittest.main()
