#!/usr/bin/env python3
"""NS01 closure queue: all 182 historical SQL declarations must stay visible.

The queue tracks work, not semantic parity or authorization to migrate. No SQL is
executed; candidate or historical security policies are never auto-copied.
"""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json"
QUEUE=ROOT/"inventories/s22/CANONE_NS01_CLOSURE_QUEUE.json"
CATEGORIES=("functions","triggers","views","policies")
RISK=("ANSWER_OR_PRIVILEGED_FLOW","SECURITY_DEFINER_SOURCE","LEGACY_AUTH_GUC_OR_ROLE")
STREAMS={"functions":"FUNCTION_SEMANTICS","triggers":"TRIGGER_INTEGRITY",
         "views":"VIEW_READ_MODEL","policies":"RLS_AUTHORIZATION"}
BLOCKERS={"subscriber.v_my_due":"FUNCTION_DEPENDENCY_UNPORTED_due_items",
          "admin.v_user_overview":"MANAGED_AUTH_IDENTITY_ACCOUNT_REMOVED"}
DECISIONS=["PORT_WITH_PARITY","REPLACE_WITH_VERIFIED_CONTRACT",
           "EXCLUDE_WITH_JUSTIFICATION","HOLD_DEPENDENCY"]
class GateError(ValueError):pass
def git_blob_sha(path):
    raw=path.read_bytes()
    return hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
def priority(category, item):
    if category=="policies" or item["status"]=="DEFERRED_DEPENDENCY" or any(
        x in RISK for x in item.get("risk_tags",[])):return "P0"
    if item["status"] in ("UNPORTED","CONTRACT_SUCCESSOR_REVIEW"):return "P1"
    return "P2"
def proofs(category,item):
    a=["SOURCE_SHA_MATCH","TARGET_SEMANTIC_DECISION","PG17_CI_PROOF",
       "INDEPENDENT_REVIEW_SIGNOFF"]
    if category=="policies":
        a+=["TWO_IDENTITY_RLS_MATRIX","ANON_DENIED","JWT_CLAIM_TRUST"]
    if category=="views":
        a+=["SECURITY_INVOKER","ROW_OWNER_ISOLATION","EDITORIAL_RIGHTS_FILTER"]
    if category in ("functions","triggers"):
        a+=["ROLLBACK_AND_CONCURRENCY","PRIVILEGE_BOUNDARIES"]
    if "ANSWER_OR_PRIVILEGED_FLOW" in item.get("risk_tags",[]):
        a+=["NO_EARLY_ANSWER_KEY"]
    return a
def build(source,*,source_sha):
    result=[]
    for category in CATEGORIES:
        for item in source["objects"][category]:
            result.append({
              "id":f'{category}|{item["source"]}|{item["line"]}|{item["name"]}',
              "category":category,"name":item["name"],
              "source":item["source"],"line":item["line"],
              "source_sha256":item["source_sha256"],
              "inventory_status":item["status"],"risk_tags":item.get("risk_tags",[]),
              "priority":priority(category,item),"workstream":STREAMS[category],
              "dependency_blocker":BLOCKERS.get(item["name"]),
              "candidate_targets":[{
                  "target":c["target"],"source":c.get("candidate"),
                  "sha256":c.get("candidate_sha256"),"line":c.get("line")}
                  for c in item.get("candidates",[])],
              "reason":item["reason"],"required_evidence":proofs(category,item),
              "allowed_closure_decisions":DECISIONS,
              "closure_state":"OPEN_EVIDENCE_REQUIRED",
              "decision":None,"reviewer_signoff":None,"ci_evidence_url":None,"closed_at":None
            })
    counts={}
    for row in result:counts[row["priority"]]=counts.get(row["priority"],0)+1
    return {
      "schema_version":"CANONE_NS01_CLOSURE_QUEUE_V1",
      "project":"auditeduca/canone","date":"2026-11-20",
      "source_path":"inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json",
      "source_git_blob_sha":source_sha,"production_gate":"NO_GO",
      "source_statements":source["source_statements"],
      "counts":{"total":len(result),"priority":counts,"closed":0,
        "distinct_views_deferred":sum(x["category"]=="views" and x["inventory_status"]=="DEFERRED_DEPENDENCY" for x in result),
        "unported_functions":sum(x["category"]=="functions" and x["inventory_status"]=="UNPORTED" for x in result),
        "unported_triggers":sum(x["category"]=="triggers" and x["inventory_status"]=="UNPORTED" for x in result),
        "policies_need_security_review":sum(x["category"]=="policies" and x["inventory_status"]=="SECURITY_REVIEW_REQUIRED" for x in result)},
      "safe_rule":"No automatic migration or proof of semantic equivalence from matching names. Closure requires independent signoff and PG17 proof.",
      "deferred_view_blockers":BLOCKERS,
      "entries":result
    }
def check(data=None,*,root=ROOT):
    source_path=root/"inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json"
    source=json.loads(source_path.read_text(encoding="utf-8"))
    manifest=data if data is not None else json.loads(
        (root/"inventories/s22/CANONE_NS01_CLOSURE_QUEUE.json").read_text(encoding="utf-8"))
    expected=build(source,source_sha=git_blob_sha(source_path))
    if manifest!=expected:raise GateError("NS01_QUEUE_SOURCE_LINEAGE_OR_FALSE_CLOSURE")
    if len(expected["entries"])!=182 or expected["counts"]["distinct_views_deferred"]!=2:
        raise GateError("NS01_OBJECT_COMPLETENESS_DRIFT")
    ids=[x["id"] for x in expected["entries"]]
    if len(ids)!=len(set(ids)):raise GateError("NS01_COLLIDING_SOURCE_DECLARATIONS")
    if expected["counts"]["closed"]!=0 or expected["production_gate"]!="NO_GO":
        raise GateError("NS01_UNAUTHORIZED_CLOSURE")
    return expected["counts"]
if __name__=="__main__":
    try:print("PASS NS01 182 OPEN CLOSURE DECISIONS",json.dumps(check(),sort_keys=True))
    except (GateError,KeyError,TypeError,ValueError,FileNotFoundError) as exc:
        print("FAIL NS01 CLOSURE",exc,file=sys.stderr);raise SystemExit(1)
