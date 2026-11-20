#!/usr/bin/env python3
"""F4-04C: guard discovered CFC amendment notices from becoming verified norms."""
import json,sys
from pathlib import Path
from datetime import date
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"governance/f4_norm_revision_alerts_2026_v1.json"
class NormGateError(ValueError):pass
EXPECTED_IDS=("REV_NBC_032_2026","REV_NBC_033_2026","ERRATA_NBC_TG03_2026")
EXPECTED_CODES={"NBC TA 260","NBC TA 700","NBC TA 706","NBC TG 03","NBC TG 36","NBC TG 48"}
def check(d=None,*,root=ROOT):
    if d is None:
        d=json.loads((root/"governance/f4_norm_revision_alerts_2026_v1.json").read_text())
    def must(x,why):
        if not x:raise NormGateError(why)
    must(d.get("schema_version")=="CANONE_F4_04C_NORM_REVISION_ALERTS_V1"
      and d.get("project")=="auditeduca/canone"
      and d.get("release_gate")=="NO_GO"
      and d.get("source_candidate_registry")=="governance/f4_annex02_outline_v1.json"
      and d.get("scope")=="PRIMARY_NOTICE_METADATA_ONLY_NOT_NORMATIVE_EFFECTIVENESS",
      "NORM_NOTICE_FALSE_RELEASE")
    parent=json.loads((root/d["source_candidate_registry"]).read_text())
    codes={x["code"] for x in parent["normative_candidates"]}
    notices=d.get("revision_notices")
    must(isinstance(notices,list) and tuple(x.get("id") for x in notices)==EXPECTED_IDS,
         "REVISION_NOTICES_INCOMPLETE")
    dates=("2026-04-29","2026-04-17","2026-05-26")
    hits=set()
    for i,notice in enumerate(notices):
        u=urlparse(notice.get("url",""))
        must(u.scheme=="https" and u.hostname in ("www2.cfc.org.br","cfc.org.br") and
          notice.get("published_dou")==dates[i],"INVALID_OFFICIAL_NOTICE_OR_DOU_DATE")
        must(notice.get("source_type") in
          ("CFC_SRE_NOTICE","CFC_OFFICIAL_DOU_ERRATA_PDF"),
          "UNTRUSTED_SOURCE")
        affected=notice.get("notice_affected_codes",[])
        must(isinstance(affected,list) and affected and len(set(affected))==len(affected),
          "REVISION_MISSING_NORMS")
        hits.update(set(affected)&codes)
    must(hits==EXPECTED_CODES,"REVISION_CANDIDATE_CROSSWALK")
    rows=d.get("candidates")
    must(isinstance(rows,list) and {x.get("code") for x in rows}==EXPECTED_CODES
       and len(rows)==len(EXPECTED_CODES),"CANDIDATE_ALERT_MISSING")
    for row in rows:
        code=row["code"]
        must(row.get("revisions")==[n["id"] for n in notices if code in n["notice_affected_codes"]],
            "REVISION_LINEAGE_DRIFT")
        expected_areas=[x["area_id"] for x in parent["sufficiency"] if code in x["normative_candidates"]]
        must(row.get("area_ids")==expected_areas,"NORM_AREA_ORPHAN")
        must(row.get("notice_discovered")=="YES_PRIMARY_SOURCE_METADATA" and
            row.get("text_version_for_sufficiency_cutoff_2026_09_14")=="HOLD_EXACT_TEXT_AND_EFFECTIVE_DATE" and
            row.get("text_version_for_eqt_publication_2026_07_13")=="HOLD_EXACT_TEXT_AND_EFFECTIVE_DATE" and
            row.get("effect_of_eqt_2026_08_12_retification")=="HOLD" and
            row.get("full_norm_document_sha256") is None and
            row.get("official_normalized_text_verified") is False and
            row.get("reviewer_approved") is False and
            row.get("licensed_for_redistribution") is False,
            "PREMATURE_NORM_EFFECTIVE_VERSION_OR_LICENSE")
    m=d.get("metrics",{})
    must(m.get("candidate_codes_in_parent")==len(codes) and
      m.get("revision_notices")==3 and
      m.get("unique_candidate_codes_impacted")==6 and
      all(m.get(k)==0 for k in
        ("verified_effective_versions","licensed_normative_texts","approved_lessons")),
        "FALSE_NORM_VERIFICATION_METRICS")
    return {"revision_notices":3,"affected_candidate_norms":6,
            "verified_effective":0,"release":"NO_GO"}
if __name__=="__main__":
    try:print("PASS F4-04C PRIMARY NOTICES",json.dumps(check()))
    except (NormGateError,KeyError,ValueError,TypeError,FileNotFoundError) as exc:
        print("FAIL F4-04C",exc,file=sys.stderr);raise SystemExit(1)
