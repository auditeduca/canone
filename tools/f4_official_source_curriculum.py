#!/usr/bin/env python3
"""F4-01 authoritative edition/source/discipline planning crosswalk.
Mechanical checks are NOT editorial/copyright signoff.
"""
import argparse,csv,io,json,sys
from datetime import date,timedelta
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"governance/f4_official_source_curriculum_v1.json"
RIGHTS=ROOT/"governance/editorial_rights_registry_v1.json"
AREAS=[
"Língua Portuguesa Aplicada","Matemática Financeira e Estatística",
"Noções de Direito e Legislação Aplicada","Legislação e Ética Profissional",
"Teoria da Contabilidade","Princípios de Contabilidade e Normas Brasileiras de Contabilidade",
"Contabilidade Geral","Contabilidade de Custos","Contabilidade Gerencial",
"Contabilidade Aplicada ao Setor Público","Controladoria","Auditoria Contábil","Perícia Contábil"]
class GateError(ValueError):pass

def s23_rows(path):
    txt=path.read_text(encoding="utf-8-sig")
    if txt.startswith("<PARSED TEXT FOR SHEET:"):
        marker=">index,"
        pos=txt.find(marker)
        if pos<0:raise GateError("S23_CSV_WRAPPER")
        txt=txt[pos+1:]
    return list(csv.DictReader(io.StringIO(txt)))

def check(data=None, *, root=ROOT):
    if data is None:data=json.loads((root/"governance/f4_official_source_curriculum_v1.json").read_text(encoding="utf8"))
    def must(expr,msg):
        if not expr:raise GateError(msg)
    must(data.get("schema_version")=="CANONE_F4_01_EDITORIAL_SOURCE_MATRIX_V1" and
      data.get("project")=="auditeduca/canone" and data.get("publication_gate")=="NO_GO","F4_NOT_NO_GO")
    must(data.get("item_rights_registry")=="governance/editorial_rights_registry_v1.json","RIGHTS_REF_MISSING")
    rights=json.loads((root/"governance/editorial_rights_registry_v1.json").read_text())
    must(rights.get("production_gate")=="NO_GO" and
      not any(x["state"]=="APPROVED_FOR_PUBLICATION" for x in rights["assets"]),"RIGHTS_RELEASE_BYPASS")
    sources=data.get("sources",[])
    source_ids=[s["id"] for s in sources]
    must(len(source_ids)>=7 and len(source_ids)==len(set(source_ids)),"SOURCE_DUPLICATE")
    for s in sources:
        u=urlparse(s["url"])
        must(u.scheme=="https" and bool(u.hostname) and not u.username and not u.password
            and s["reproduction_permission"]=="NOT_ESTABLISHED","SOURCE_NOT_VERIFIED_OR_RIGHTS_GUESS")
        if s["id"]=="CFC_EQT_INDEX":must(s["metadata_verified"] is False,"EQT_NOT_EVIDENCED")
    editions=data.get("exam_editions",[])
    must({x["id"] for x in editions}=={"CFC-SUF-2026.2","CFC-SUF-2026.3"},"EDITION_MISSING")
    sources_by_id={x["id"]:x for x in sources}
    for e in editions:
        must(e["source_id"] in sources_by_id and e["question_count"]==50 and
            e["options_per_question"]==4 and e["subject_count"]==13,"EDITAL_FORMAT_DRIFT")
        must(e["norm_cutoff"]==str(date.fromisoformat(e["exam_date"])-timedelta(days=90)),
            "NORMATIVE_CUTOFF_DRIFT")
        must(e["rights"]=="HOLD_RIGHTS" and e["licensed_questions"]==0,"UNLICENSED_EXAM_RELEASE")
    e3=next(x for x in editions if x["id"]=="CFC-SUF-2026.3")
    must(e3["stage"]=="SCHEDULED_NO_OFFICIAL_POST_EXAM_KEY","EXAM_2026_3_PREMATURE_KEY")
    areas=data.get("curriculum_areas",[])
    must(len(areas)==13 and [a["name"] for a in areas]==AREAS,"EDITAL_SUBJECTS_DRIFT")
    must([a["id"] for a in areas]==[f"CFC-A{i:02d}" for i in range(1,14)],"SUBJECT_ID_MISMATCH")
    all_modules={r["ID canônico"] for r in s23_rows(root/"planning/s23/S23_MODULOS_26.csv")}
    track_ids={r["Código"] for r in s23_rows(root/"planning/s23/S23_EXAMES_CFC.csv")}
    must(len(all_modules)==26 and len(track_ids)==7,"S23_INVENTORY_DRIFT")
    mapped=set()
    for a in areas:
        ids=a["candidate_module_ids"]
        must(isinstance(ids,list) and len(ids)>=1 and len(set(ids))==len(ids)
          and set(ids)<=all_modules,"UNKNOWN_MODULE_OR_UNMAPPED_SUBJECT")
        mapped.update(ids)
        must(a["source_section"]=="FGV_CFC_2026_3:6.8_ANNEX_II" and
          a["content_validation"]=="HOLD_EDITORIAL" and
          a["normative_validation"]=="HOLD_PER_ITEM" and
          a["rights_validation"]=="HOLD_RIGHTS" and
          a["approved_lessons"]==0 and a["approved_questions"]==0,"FALSE_CONTENT_COVERAGE")
    t=data["track_policy"]
    must(t["expected_tracks"]==7 and t["source"]=="planning/s23/S23_EXAMES_CFC.csv" and
      t["sufficiency"]["active_edition"]=="CFC-SUF-2026.3" and
      t["eqt"]["status"]=="HOLD_EDITION_SPECIFIC_SYLLABUS","TRACK_PREMATURE_RELEASE")
    release=data["release_policy"]
    must(all(release[k]==0 for k in ("public_questions","public_lessons","approved_exam_tracks")),"FALSE_PRODUCTION_PROGRESS")
    must("PUBLISHING_AND_COMMERCIAL_RIGHTS_DOCUMENT_HASH" in release["required_checks"]
      and "INDEPENDENT_LEGAL_SIGNOFF" in release["required_checks"],"LEGAL_SIGNOFF_MISSING")
    return {"official_editions":len(editions),"subjects_mapped_as_planning_only":len(areas),
      "tracks_in_s23":len(track_ids),"modules_in_s23":len(all_modules),
      "candidate_subject_modules":len(mapped),"cross_cutting_modules":len(all_modules-mapped),
      "licensed_questions":0,"public_items":0}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--check",action="store_true")
    p.parse_args()
    try: print("PASS F4-01 METADATA_ONLY NO_GO",json.dumps(check(),ensure_ascii=False))
    except (GateError,KeyError,TypeError,ValueError,FileNotFoundError) as e:
        print("FAIL F4-01",e,file=sys.stderr);raise SystemExit(1)
