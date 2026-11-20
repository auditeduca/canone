#!/usr/bin/env python3
"""F4-04 structural syllabus normalization, no editorial/legal release.
Checks manual Annex II letter-group transcription and versioned candidate norms;
never infers rights or copies questions from official PDFs.
"""
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"governance/f4_annex02_outline_v1.json"
EXPECTED_COUNTS=[12,6,20,3,5,4,5,2,3,3,11,5,3]
EXPECTED_AREAS=["CFC-A07","CFC-A08","CFC-A10","CFC-A09","CFC-A11","CFC-A03","CFC-A02",
                "CFC-A05","CFC-A04","CFC-A06","CFC-A12","CFC-A13","CFC-A01"]
EQT_IDS=["CFC-EQT-QTG","CFC-EQT-CVM","CFC-EQT-BCB","CFC-EQT-SUSEP","CFC-EQT-PREVIC","CFC-EQT-PER"]
DUP="ABCDEFGHIJKLMNMNOPQR"  # use explicit list below, not ambiguous character count
PUBLIC_LABELS=list("ABCDEFGHIJKLMN")+["M","N","O","P","Q","R"]
class GateError(ValueError):pass

def check(data=None,*,root=ROOT):
    d=data if data is not None else json.loads((root/"governance/f4_annex02_outline_v1.json").read_text(encoding="utf8"))
    def must(cond,code):
        if not cond:raise GateError(code)
    must(isinstance(d,dict) and d.get("schema_version")=="CANONE_F4_04_ANNEX_OUTLINE_V1"
         and d.get("project")=="auditeduca/canone" and d.get("release_gate")=="NO_GO",
         "F4_OUTLINE_EARLY_RELEASE")
    must(d.get("parent_sufficiency")=="governance/f4_official_source_curriculum_v1.json"
        and d.get("parent_eqt")=="governance/f4_eqt_modalities_2026_2_v1.json"
        and d.get("rights_registry")=="governance/editorial_rights_registry_v1.json",
        "F4_PARENT_LINEAGE")
    must(d.get("granularity")=="LETTER_GROUPS_SUFFICIENCY_AND_CANDIDATE_TOPIC_CLUSTERS_EQT_NOT_FULL_PARAGRAPH_ATOMIZATION",
        "FALSE_DEEP_ATOMIZATION_CLAIM")
    sources=d.get("sources",[])
    must(isinstance(sources,list) and len(sources)==2,"ANNEX_SOURCES")
    must(sources[0].get("edition")=="CFC-SUF-2026.3"
        and sources[0].get("pdf_pages")==[22,30]
        and sources[0].get("cutoff_basis")=="EXAM_MINUS_90_DAYS"
        and sources[0].get("norm_cutoff")=="2026-09-14"
        and sources[0].get("url","").startswith("https://conhecimento.fgv.br/sites/default/files/concursos/"),
        "SUFFICIENCY_SOURCE_CUTOFF")
    must(sources[1].get("edition")=="EQT-2026.2"
        and sources[1].get("pdf_pages")==[24,33]
        and sources[1].get("cutoff_basis")=="NOTICE_PUBLICATION_WITH_RETIFICATION_REVIEW_HOLD"
        and sources[1].get("publication_original")=="2026-07-13"
        and sources[1].get("corrected_notice")=="2026-08-12"
        and sources[1].get("url","").startswith("https://conhecimento.fgv.br/sites/default/files/concursos/"),
        "EQT_SOURCE_RETIFICATION")
    parent=json.loads((root/d["parent_sufficiency"]).read_text(encoding="utf8"))
    eqt_parent=json.loads((root/d["parent_eqt"]).read_text(encoding="utf8"))
    rights=json.loads((root/d["rights_registry"]).read_text(encoding="utf8"))
    must(parent.get("publication_gate")=="NO_GO" and eqt_parent.get("publication_gate")=="NO_GO"
        and rights.get("production_gate")=="NO_GO","PARENT_RELEASE_DRIFT")
    area_ids={a["id"] for a in parent["curriculum_areas"]}
    must(set(EXPECTED_AREAS)==area_ids,"PARENT_AREA_DRIFT")
    expected_eqt={x["id"] for x in eqt_parent["modalities"]}
    must(set(EQT_IDS)==expected_eqt,"PARENT_EQT_DRIFT")
    rows=d.get("sufficiency")
    must(isinstance(rows,list) and len(rows)==13,"MISSING_SUFFICIENCY_SECTION")
    groups=[]
    for ix,s in enumerate(rows):
        must(s.get("section")==ix+1 and s.get("area_id")==EXPECTED_AREAS[ix]
            and s.get("source_locator")==f"ANEXO_II/{ix+1}"
            and s.get("extraction_level")=="LETTER_GROUPS_NOT_PARAGRAPHS",
            "SUFFICIENCY_SECTION_ORDER")
        first,last=s.get("pdf_page_range",[None,None])
        must(isinstance(first,int) and isinstance(last,int) and 22<=first<=last<=30,
            "SUFFICIENCY_PAGE_RANGE")
        nodes=s.get("groups",[])
        must(isinstance(nodes,list) and len(nodes)==EXPECTED_COUNTS[ix],
            "MISSING_OR_EXTRA_LETTER_GROUP")
        letters=PUBLIC_LABELS if ix==2 else list("ABCDEFGHIJKLMNOPQRSTUVWXYZ"[:len(nodes)])
        seen={}
        for j,node in enumerate(nodes):
            letter=letters[j]
            seen[letter]=seen.get(letter,0)+1
            expected_id=f"F4-SUF26-3-{ix+1:02}-{j+1:02}"
            must(node.get("id")==expected_id and node.get("source_label")==letter
                and node.get("source_occurrence")==seen[letter]
                and node.get("source_locator")==f"ANEXO_II/{ix+1}/{letter}#{seen[letter]}",
                "SUBGROUP_LABEL_OR_ID_DRIFT")
            title=node.get("label_paraphrase")
            must(isinstance(title,str) and 3<=len(title)<=85 and "\n" not in title,
                "PARAPHRASE_TOO_LONG_OR_MISSING")
            must(node.get("source_pages")==s["pdf_page_range"]
                and node.get("editorial_status")=="HOLD_SUBTOPIC_REVIEW"
                and node.get("normative_status")=="HOLD_VERSION_AND_EFFECTIVENESS"
                and node.get("rights_status")=="REFERENCE_ONLY"
                and node.get("approved_lessons")==0 and node.get("approved_questions")==0,
                "UNVERIFIED_SUBTOPIC_RELEASE")
            groups.append(node["id"])
        if ix==2:must(s.get("source_label_anomaly")=="DUPLICATE_M_N_PRESERVED",
             "M_N_SOURCE_DUPLICATE_LOST")
        else:must(s.get("source_label_anomaly") is None,"SPURIOUS_DUPLICATE_NOTE")
    must(len(groups)==82 and len(set(groups))==82,"GROUP_COUNT_OR_DUPLICATE")
    eqt=d.get("eqt_outline",[])
    must(isinstance(eqt,list) and len(eqt)==6,"EQT_SIX_SECTIONS_REQUIRED")
    cluster_ids=[]
    for ix,row in enumerate(eqt):
        roman=["I","II","III","IV","V","VI"][ix]
        must(row.get("track_id")==EQT_IDS[ix] and row.get("annex_section")==roman
            and row.get("extraction_level")=="CANDIDATE_CLUSTERS_NOT_ALL_NORM_CLAUSES",
            "EQT_MODALITY_ORDER_OR_FALSE_COVERAGE")
        start,end=row.get("source_pages",[None,None])
        must(isinstance(start,int) and isinstance(end,int) and 24<=start<=end<=33,"EQT_PAGE_RANGE")
        clusters=row.get("clusters",[])
        must(isinstance(clusters,list) and len(clusters)==5,"EQT_CLUSTER_COUNT")
        for j,c in enumerate(clusters):
            must(c.get("id")==f"F4-EQT26-2-{roman}-{j+1:02}"
                and c.get("source_locator")==f"ANEXO_II/{roman}"
                and c.get("source_pages")==row["source_pages"]
                and c.get("editorial_status")=="HOLD_SUBTOPIC_REVIEW"
                and c.get("normative_status")=="HOLD_VERSION_AND_EFFECTIVENESS"
                and c.get("rights_status")=="HOLD_RIGHTS"
                and c.get("approved_questions")==0,
                "EQT_CLUSTER_INTEGRITY_OR_RELEASE")
            must(isinstance(c.get("topic_paraphrase"),str)
                and 3<=len(c["topic_paraphrase"])<=85,"EQT_TOPIC_INVALID")
            cluster_ids.append(c["id"])
    must(len(cluster_ids)==30 and len(set(cluster_ids))==30,"EQT_CLUSTER_DUPLICATE")
    cand=d.get("normative_candidates",[])
    codes=[x.get("code") for x in cand] if isinstance(cand,list) else []
    expected=set(code for s in rows for code in s["normative_candidates"])
    expected.update(code for x in eqt for code in x["candidate_norms"])
    must(len(codes)==len(set(codes)) and set(codes)==expected
        and len(codes)>0,"NORMATIVE_CANDIDATE_LINEAGE")
    for x in cand:
        must(x.get("version_at_sufficiency_2026_3_cutoff")=="HOLD"
            and x.get("version_at_eqt_2026_2_publication")=="HOLD"
            and x.get("primary_full_text_url") is None
            and x.get("document_sha256") is None and x.get("effective_date") is None
            and x.get("publication_permission")=="NOT_ESTABLISHED"
            and x.get("tracking_status")=="CANDIDATE_REFERENCE_ONLY",
            "UNVERIFIED_NORM_PROMOTION")
    m=d.get("declared_metrics",{})
    must(m.get("sufficiency_sections")==13
        and m.get("sufficiency_lettered_groups")==82
        and m.get("eqt_modality_sections")==6
        and m.get("eqt_candidate_topic_clusters")==30
        and m.get("candidate_norm_ids")==len(cand)
        and m.get("duplicate_source_letters_in_public")==["M","N"]
        and all(m.get(k)==0 for k in
        ("verified_norm_versions","approved_deep_paragraph_subtopics","approved_lessons","approved_questions")),
        "METRICS_DRIFT_OR_FALSE_HOMOLOGATION")
    return {"sections":len(rows),"source_letter_groups":len(groups),
       "eqt_modalities":len(eqt),"eqt_candidate_clusters":len(cluster_ids),
       "normative_candidate_codes":len(cand),"approved_lessons":0,
       "verified_effective_norm_versions":0,"publications":0}

if __name__=="__main__":
    try:
        print("PASS F4_04_OUTLINE_ONLY",json.dumps(check(),sort_keys=True))
    except (GateError,KeyError,ValueError,TypeError,FileNotFoundError) as exc:
        print("FAIL F4_04",exc,file=sys.stderr);raise SystemExit(1)
