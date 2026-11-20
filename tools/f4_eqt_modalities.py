#!/usr/bin/env python3
"""EQT 2026.2 six official modalities, not the CFC-SUF 50x4 exam. Metadata only."""
import csv,io,json,sys
from pathlib import Path
from datetime import date
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"governance/f4_eqt_modalities_2026_2_v1.json"
class EQTError(ValueError):pass
DATES=("2026-09-28","2026-09-29","2026-09-30","2026-10-01","2026-10-02","2026-10-03")
IDS=("CFC-EQT-QTG","CFC-EQT-PER","CFC-EQT-CVM","CFC-EQT-BCB","CFC-EQT-SUSEP","CFC-EQT-PREVIC")
def read_csv(path):
 t=path.read_text(encoding="utf-8-sig")
 if t.startswith("<PARSED TEXT FOR SHEET:"):
  p=t.find(">index,")
  if p<0:raise EQTError("S23_CSV_INVALID")
  t=t[p+1:]
 return list(csv.DictReader(io.StringIO(t)))
def check(data=None,*,root=ROOT):
 d=data if data is not None else json.loads((root/"governance/f4_eqt_modalities_2026_2_v1.json").read_text())
 def ok(condition,message):
  if not condition:raise EQTError(message)
 ok(d.get("schema_version")=="CANONE_F4_02_EQT_MODALITIES_V1" and
    d.get("project")=="auditeduca/canone" and d.get("publication_gate")=="NO_GO","EQT_RELEASE_FORBIDDEN")
 ed=d["sources"];ass=d["assessment_contract"];rows=d["modalities"]
 ok(d["exam_edition"]=="EQT-2026.2","EQT_EDITION_INVALID")
 for k in ("official_page","official_notice_corrected"):
  u=urlparse(ed[k]);ok(u.scheme=="https" and u.hostname=="conhecimento.fgv.br","EQT_UNTRUSTED_ORIGINAL")
 ok(ed["original_publication_date"]=="2026-07-13" and ed["corrected_notice_date"]=="2026-08-12",
    "EQT_RETIFICATION_NOT_TRACKED")
 ok(ed["normative_rule_reference"]=="5.12" and
    ed["normative_cutoff_basis"]=="OFFICIAL_NOTICE_PUBLICATION_DATE" and
    ed["normative_version_audit"]=="HOLD_PER_NORM_AND_RETIFICATION","EQT_NORM_RULE_CONFLATED_WITH_SUFFICIENCY")
 ok(ed["legal_rights"]=="HOLD_RIGHTS" and ed["authorized_public_questions"]==0,
    "EQT_UNLICENSED_CONTENT")
 ok(ed["official_objective_key_available_date"]=="2026-11-03" and
    ed["discursive_final_result_scheduled"]=="2026-12-18","EQT_RESULTS_STATE_GUESS")
 ok((ass["objective_questions"],ass["objective_options"],ass["objective_points_each"],
      ass["discursive_questions"],ass["discursive_points_each"],ass["total_points"],
      ass["objective_pass_percent"])==(25,5,2,2,25,100,60),"EQT_FORMAT_DRIFT")
 ok(ass["objective_questions"]*ass["objective_points_each"]+
    ass["discursive_questions"]*ass["discursive_points_each"]==100,"EQT_SCORE_INVALID")
 ok(len(rows)==6 and tuple(x["id"] for x in rows)==IDS and
    tuple(x["exam_date"] for x in rows)==DATES,"EQT_MODALITIES_MISMATCH")
 s23={x["Código"] for x in read_csv(root/"planning/s23/S23_EXAMES_CFC.csv")}
 modids={x["ID canônico"] for x in read_csv(root/"planning/s23/S23_MODULOS_26.csv")}
 ok(len(s23)==7 and set(IDS)==s23-{"CFC-SUF"},"EQT_S23_MAPPING_MISMATCH")
 for i,x in enumerate(rows):
  ok(x["schedule_section"]=="5.1."+str(i+1) and
     x["format_section"]=="5.10."+str(i+1),"EQT_ANCHOR_DRIFT")
  ok(x["rights_status"]=="HOLD_RIGHTS" and x["normative_status"]=="HOLD_VERSIONED_CFC_NBC_OR_REGULATOR" and
     x["content_approved"]==0 and x["discursive_engine"]=="NOT_E2E_HOMOLOGATED" and
     x["curriculum_status"]=="OFFICIAL_ANNEX_IDENTIFIED_NOT_ATOMIZED","FALSE_EQT_HOMOLOGATION")
  ok(set(x["candidate_modules"])<=modids and bool(x["candidate_modules"]),"UNKNOWN_PRODUCT_MODULE")
 gates=d["release_gates"]
 ok(not any(gates[k] for k in ("license_human_signoff","normative_per_item_checked","discourse_grading_approved"))
   and gates["sufficiency_rules_may_be_reused"] is False,"FALSE_EQT_GO")
 return {"modalities_official":6,"content_homologated":0,"objectives_per_exam":25,
         "discursives_per_exam":2,"options":5,"rights_release":0}
if __name__=="__main__":
 try:print("PASS F4-02 EQT EDITAL_ONLY NO_GO",json.dumps(check()))
 except (EQTError,KeyError,ValueError,TypeError) as e:
  print("FAIL F4-02",str(e),file=sys.stderr);raise SystemExit(1)
