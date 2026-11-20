#!/usr/bin/env python3
"""F4-04-B: fail-closed checks for a pilot of original learning objectives.
No official content is reproduced and no topic/norm is automatically approved.
"""
from __future__ import annotations
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"governance/f4_learning_objectives_pilot_v1.json"
class GateError(ValueError):pass
def blob_sha(path:Path)->str:
    b=path.read_bytes()
    return hashlib.sha1(b"blob "+str(len(b)).encode("ascii")+b"\0"+b).hexdigest()
def check(d=None,*,root=ROOT):
    if d is None:
        d=json.loads((root/"governance/f4_learning_objectives_pilot_v1.json").read_text(encoding="utf-8"))
    def must(x,msg):
        if not x:raise GateError(msg)
    must(d.get("schema_version")=="CANONE_F4_04B_OBJECTIVES_PILOT_V1"
       and d.get("project")=="auditeduca/canone"
       and d.get("edition")=="CFC-SUF-2026.3"
       and d.get("release_gate")=="NO_GO"
       and d.get("scope")=="TWO_AREAS_18_GROUPS_PILOT"
       and d.get("rights")=="REFERENCE_ONLY"
       and d.get("no_official_text_copied") is True,"FALSE_PUBLICATION_OR_SCOPE")
    must(d.get("parent_path")=="governance/f4_annex02_outline_v1.json","PARENT_PATH_DRIFT")
    outline_path=root/d["parent_path"]
    must(d.get("parent_git_blob_sha")==blob_sha(outline_path),"PARENT_GIT_BLOB_DRIFT")
    parent=json.loads(outline_path.read_text(encoding="utf-8"))
    must(parent.get("release_gate")=="NO_GO" and
      d.get("source_url")==parent["sources"][0]["url"],"SOURCE_EDITIONS_DRIFT")
    groups=d.get("groups")
    must(isinstance(groups,list) and len(groups)==18,"PILOT_GROUP_COVERAGE")
    expected=parent["sufficiency"][0]["groups"]+parent["sufficiency"][1]["groups"]
    must(len(expected)==18,"PARENT_18_GROUPS_DRIFT")
    used=set()
    total=0
    areas=set()
    for idx,(group,p) in enumerate(zip(groups,expected)):
        area=parent["sufficiency"][0] if idx<12 else parent["sufficiency"][1]
        page=22 if idx<7 else 23
        must(group.get("parent_group_id")==p["id"] and
          group.get("area_id")==area["area_id"] and
          group.get("source_locator")==p["source_locator"] and
          group.get("source_pdf_page_index")==page,"GROUP_SOURCE_ANCHOR_MISMATCH")
        must(group.get("state")=="CANDIDATE_OBJECTIVES_UNREVIEWED"
          and group.get("normative_candidates")==area["normative_candidates"]
          and group.get("authorized_for_publication") is None,
          "GROUP_EARLY_APPROVAL")
        objectives=group.get("objectives")
        must(isinstance(objectives,list) and 3<=len(objectives)<=8,"OBJECTIVES_SHAPE")
        levels=set()
        for j,item in enumerate(objectives,1):
            code=f"{p['id']}-OBJ{j:02}"
            statement=item.get("original_learning_objective")
            must(item.get("id")==code and code not in used,"OBJECTIVE_ID_OR_DUPLICATE")
            used.add(code)
            must(isinstance(statement,str) and 25<=len(statement)<=180
              and not any(c in statement for c in ("\n","http://","https://")),
              "OBJECTIVE_NOT_ORIGINAL_SHORT_PARAPHRASE")
            must(item.get("source_locator")==p["source_locator"]
               and item.get("source_pdf_page_index")==page,"OBJECTIVE_SOURCE_DRIFT")
            must(item.get("level") in {"BASICO","INTERMEDIARIO","AVANCADO"},
              "INVALID_COGNITIVE_LEVEL")
            levels.add(item["level"])
            must(item.get("editorial_review")=="HOLD_EXPERT" and
              item.get("normative_review")=="HOLD_EFFECTIVE_VERSION" and
              item.get("rights_review")=="REFERENCE_ONLY" and
              item.get("approved_lesson") is False and
              item.get("approved_questions")==0,
              "UNREVIEWED_CONTENT_PROMOTED")
            total+=1
        must(levels=={"BASICO","INTERMEDIARIO","AVANCADO"},"MISSING_LEVEL_PROGRESSION")
        areas.add(group["area_id"])
    must(areas=={"CFC-A07","CFC-A08"},"PILOT_AREA_DRIFT")
    m=d.get("metrics",{})
    must(m.get("pilot_areas")==2 and m.get("pilot_groups")==18
      and m.get("parent_group_total")==82 and
      m.get("candidate_objectives")==total and
      all(m.get(k)==0 for k in
       ("editorial_approved","normative_verified","lessons_approved",
        "questions_approved","publication_permissions")),"METRICS_OR_FALSE_HOMOLOGATION")
    return {"pilot_groups":len(groups),"candidate_objectives":total,
       "approved":0,"coverage":"18_of_82","production":"NO_GO"}
if __name__=="__main__":
    try:print("PASS F4-04B PILOT",json.dumps(check(),ensure_ascii=False))
    except (GateError,KeyError,TypeError,ValueError,FileNotFoundError) as ex:
        print("FAIL F4-04B",ex,file=sys.stderr)
        raise SystemExit(1)
