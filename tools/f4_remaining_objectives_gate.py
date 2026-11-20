#!/usr/bin/env python3
"""F4-04D: verify candidate objectives for 64 remaining CFC syllabus groups.

This is a completeness control over the *existing outline*, not proof that the
full official PDF was atomized or any normative/editorial/rights check passed.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "governance/f4_learning_objectives_remaining_64_v1.json"
STATES = ("BASICO", "INTERMEDIARIO", "AVANCADO")

class GateError(ValueError):
    pass

def sha_blob(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()

def check(data=None, *, root=ROOT):
    d = data if data is not None else json.loads(
        (root / "governance/f4_learning_objectives_remaining_64_v1.json").read_text(encoding="utf-8"))

    def must(condition, error):
        if not condition:
            raise GateError(error)

    must(d.get("schema_version") == "CANONE_F4_04D_REMAINING_OBJECTIVES_V1"
         and d.get("project") == "auditeduca/canone"
         and d.get("edition") == "CFC-SUF-2026.3"
         and d.get("release_gate") == "NO_GO"
         and d.get("rights_review") == "REFERENCE_ONLY"
         and d.get("granularity") == "ORIGINAL_CANDIDATE_OBJECTIVES_FROM_ANNEX_OUTLINE_NOT_VERBATIM_PARAGRAPHS",
         "EARLY_RELEASE_OR_FALSE_GRANULARITY")

    must(d.get("source_outline") == "governance/f4_annex02_outline_v1.json"
         and d.get("preserved_pilot") == "governance/f4_learning_objectives_pilot_v1.json",
         "PARENT_LINEAGE_PATH")
    outline_path, pilot_path = (root / d["source_outline"], root / d["preserved_pilot"])
    must(d.get("source_git_blob_sha") == sha_blob(outline_path), "SOURCE_OUTLINE_BLOB_DRIFT")
    must(d.get("pilot_git_blob_sha") == sha_blob(pilot_path), "PRESERVED_PILOT_BLOB_DRIFT")

    parent = json.loads(outline_path.read_text(encoding="utf-8"))
    pilot = json.loads(pilot_path.read_text(encoding="utf-8"))
    must(parent.get("release_gate") == "NO_GO" and pilot.get("release_gate") == "NO_GO"
         and d.get("source_url") == parent["sources"][0]["url"],
         "PARENT_GATE_OR_SOURCE_DRIFT")
    must(len(parent["sufficiency"]) == 13
         and sum(len(sec["groups"]) for sec in parent["sufficiency"]) == 82,
         "PARENT_OUTLINE_INCOMPLETE")
    pilot_ids = [g["parent_group_id"] for g in pilot["groups"]]
    must(len(pilot_ids) == 18 and len(set(pilot_ids)) == 18
         and set(pilot_ids) == {g["id"] for s in parent["sufficiency"][:2] for g in s["groups"]},
         "PILOT_GROUP_LINEAGE")
    old_objective_ids = [o["id"] for g in pilot["groups"] for o in g["objectives"]]
    must(len(old_objective_ids) == 63 and len(set(old_objective_ids)) == 63,
         "PILOT_ORIGINAL_OBJECTIVES_DRIFT")

    expected = [(s, g) for s in parent["sufficiency"][2:] for g in s["groups"]]
    groups = d.get("groups")
    must(len(expected) == 64 and isinstance(groups, list) and len(groups) == 64,
         "REMAINING_64_MISSING")
    seen_groups, seen_objectives, descriptions = set(), set(), set()
    count = 0
    areas = {s["area_id"] for s in parent["sufficiency"][:2]}
    for index, (row, (source, sg)) in enumerate(zip(groups, expected), 1):
        must(row.get("parent_group_id") == sg["id"]
             and row.get("parent_group_id") not in seen_groups
             and row.get("parent_group_id") not in pilot_ids
             and row.get("area_id") == source["area_id"]
             and row.get("source_locator") == sg["source_locator"]
             and row.get("source_pdf_pages") == sg["source_pages"]
             and row.get("section") == source["section"]
             and row.get("source_label") == sg["source_label"]
             and row.get("source_occurrence") == sg["source_occurrence"],
             "GROUP_ANCHOR_OR_DUPLICATE")
        seen_groups.add(row["parent_group_id"])
        areas.add(row["area_id"])
        must(row.get("state") == "CANDIDATE_OBJECTIVES_UNREVIEWED"
             and row.get("normative_candidates") == source["normative_candidates"]
             and row.get("approved_lessons") is None,
             "GROUP_FALSE_APPROVAL_OR_NORM_LINEAGE")
        objs = row.get("objectives")
        must(isinstance(objs, list) and len(objs) == 3,
             "THREE_OBJECTIVES_PER_GROUP_REQUIRED")
        for pos, objective in enumerate(objs, 1):
            oid = f'{sg["id"]}-OBJ{pos:02d}'
            text = objective.get("original_learning_objective")
            must(objective.get("id") == oid
                 and oid not in seen_objectives and oid not in old_objective_ids,
                 "OBJECTIVE_ID_OR_DUPLICATE")
            seen_objectives.add(oid)
            must(isinstance(text, str) and 40 <= len(text) <= 180
                 and text not in descriptions and "\n" not in text
                 and "http://" not in text and "https://" not in text,
                 "DUPLICATE_OR_INVALID_ORIGINAL_OBJECTIVE")
            descriptions.add(text)
            must(objective.get("level") == STATES[pos - 1],
                 "PROGRESSION_BASICO_INTERMEDIARIO_AVANCADO")
            must(objective.get("source_locator") == sg["source_locator"]
                 and objective.get("editorial_review") == "HOLD_EXPERT"
                 and objective.get("normative_review") == "HOLD_EFFECTIVE_VERSION"
                 and objective.get("rights_review") == "REFERENCE_ONLY"
                 and objective.get("approved_lesson") is False
                 and objective.get("approved_questions") == 0,
                 "OBJECTIVE_FALSE_HOMOLOGATION_OR_ANCHOR")
            count += 1
    must(len(seen_groups | set(pilot_ids)) == 82 and len(areas) == 13,
         "FULL_82_GROUPS_13_AREAS_COVERAGE")
    metrics = d.get("metrics", {})
    must(metrics.get("existing_pilot_groups") == 18
         and metrics.get("remaining_groups") == 64
         and metrics.get("total_parent_groups") == 82
         and metrics.get("all_areas_represented") == 13
         and metrics.get("new_candidate_objectives") == count == 192
         and metrics.get("existing_candidate_objectives") == 63
         and metrics.get("total_candidate_objectives") == count + 63 == 255
         and all(metrics.get(k) == 0 for k in (
             "independently_reviewed", "validated_norm_versions", "approved_lessons",
             "approved_questions", "licensed_external_items")),
         "METRICS_DRIFT_OR_PREMATURE_PUBLICATION")
    return {"candidate_group_coverage": "82/82", "candidate_objectives": 255,
            "new_objectives": count, "verified_norms": 0, "approved_lessons": 0,
            "release": "NO_GO"}

if __name__ == "__main__":
    try:
        print("PASS F4-04D 64 REMAINING OBJECTIVE GROUPS", json.dumps(check(), sort_keys=True))
    except (GateError, KeyError, TypeError, ValueError, FileNotFoundError) as error:
        print("FAIL F4-04D", error, file=sys.stderr)
        raise SystemExit(1)
