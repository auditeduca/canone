import json,sys,unittest
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from verify_f3_reconciliation import PATH,check,read_s23_rows,actual_routes
class F3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.data=json.loads(PATH.read_text())
    def test_baseline(self):self.assertEqual(check(self.data),[])
    def test_routes(self):self.assertEqual(len(actual_routes()),26)
    def test_csv(self):
        self.assertEqual(len(read_s23_rows(ROOT/"planning/s23/S23_MODULOS_26.csv")),26)
        self.assertEqual(len(read_s23_rows(ROOT/"planning/s23/S23_FASEAMENTO_26.csv")),26)
    def test_no_go(self):
        x=deepcopy(self.data);x["production_gate"]="GO"
        self.assertIn("GATE_NOT_NO_GO",check(x))
    def test_handler_drift(self):
        x=deepcopy(self.data);x["modules"][0]["route_handler"]="NOT_ROUTED"
        self.assertTrue(any(t.startswith("HANDLER_DRIFT") for t in check(x)))
    def test_no_fake_homologation(self):
        x=deepcopy(self.data);x["modules"][0]["p0_production_homologated"]=True
        self.assertTrue(any(t.startswith("UNPROVEN_HOMOLOGATION") for t in check(x)))
    def test_blob_drift(self):
        x=deepcopy(self.data);x["source_blobs"][0]["sha1"]="0"*40
        self.assertTrue(any(t.startswith("SOURCE_BLOB_DRIFT") for t in check(x)))
if __name__=="__main__":unittest.main()
