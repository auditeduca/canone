import json,sys,unittest
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from verify_f3_reconciliation import PATH,check,read_s23_rows
class F3(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.data=json.loads(PATH.read_text())
    def test_crosswalk(self): self.assertEqual(check(self.data),[])
    def test_s23_csv_reading_formats(self):
        self.assertEqual(len(read_s23_rows(ROOT/"planning/s23/S23_MODULOS_26.csv")),26)
        self.assertEqual(len(read_s23_rows(ROOT/"planning/s23/S23_FASEAMENTO_26.csv")),26)
    def test_gate(self):
        d=deepcopy(self.data);d["production_gate"]="GO"
        self.assertIn("GATE_NOT_NO_GO",check(d))
    def test_fake_integration(self):
        d=deepcopy(self.data);d["modules"][0]["legacy_specialized_mounted"]=True
        self.assertTrue(any(s.startswith("UNPROVEN_INTEGRATION") for s in check(d)))
    def test_drift(self):
        d=deepcopy(self.data);d["source_blobs"][0]["sha1"]="0"*40
        self.assertTrue(any(s.startswith("SOURCE_BLOB_DRIFT") for s in check(d)))
if __name__=="__main__":unittest.main()
