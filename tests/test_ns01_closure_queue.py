import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from ns01_closure_queue import check,GateError,build,git_blob_sha
BASE=json.loads((ROOT/"inventories/s22/CANONE_NS01_CLOSURE_QUEUE.json").read_text())
class NS01Closure(unittest.TestCase):
 def test_all_source_declarations_visible(self):
  v=check()
  self.assertEqual(v["total"],182)
  self.assertEqual(v["closed"],0)
  self.assertEqual(v["distinct_views_deferred"],2)
  self.assertEqual(v["policies_need_security_review"],67)
 def bad(self,transform):
  c=copy.deepcopy(BASE);transform(c)
  with self.assertRaisesRegex(GateError,"SOURCE_LINEAGE_OR_FALSE_CLOSURE"):check(c)
 def test_no_fake_seal(self):
  self.bad(lambda d:d["entries"][0].update(closure_state="SEALED"))
 def test_no_fake_review(self):
  self.bad(lambda d:d["entries"][0].update(reviewer_signoff="approved"))
 def test_no_dropped_policy(self):
  self.bad(lambda d:d["entries"].pop())
 def test_no_missing_auth_deferred_view(self):
  self.bad(lambda d:d["deferred_view_blockers"].pop("admin.v_user_overview"))
 def test_no_closure_count_inflation(self):
  self.bad(lambda d:d["counts"].update(closed=182))
 def test_no_hash_drift(self):
  self.bad(lambda d:d.update(source_git_blob_sha="0"*40))
 def test_legacy_rls_not_automatically_ported(self):
  rows=[x for x in BASE["entries"] if x["category"]=="policies"]
  self.assertEqual(len(rows),80)
  self.assertTrue(all(x["closure_state"]=="OPEN_EVIDENCE_REQUIRED" for x in rows))
  self.assertTrue(all("TWO_IDENTITY_RLS_MATRIX" in x["required_evidence"] for x in rows))
 def test_two_views_blocked_by_dependencies(self):
  rows={x["name"]:x for x in BASE["entries"] if x["inventory_status"]=="DEFERRED_DEPENDENCY"}
  self.assertEqual(set(rows),{"subscriber.v_my_due","admin.v_user_overview"})
  self.assertTrue(all(x["priority"]=="P0" for x in rows.values()))
if __name__=="__main__":unittest.main()
