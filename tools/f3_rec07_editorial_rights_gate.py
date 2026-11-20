#!/usr/bin/env python3
"""Cânone F3-REC-07 rights registry validator. Mechanical gate, not legal advice.
No external content or URLs are downloaded; any third-party reproduction remains HOLD.
"""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/"governance/editorial_rights_registry_v1.json"
REQUIRED={"asset_id","content_version","state","origin","source_ref","permitted_scope",
          "evidence_ref","reviewers","expires_on"}
TOP={"schema_version","project","production_gate","legal_release_stage","source_references","assets"}
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
ASSET=re.compile(r"^[a-z0-9._:/-]{6,200}$")
AUDITOR=re.compile(r"^[a-z][a-z0-9_-]{3,79}$")
SRC_OK={"https://conhecimento.fgv.br/","https://www.gov.br/","https://www2.camara.leg.br/","source-s22/"}

class RightsGateError(ValueError):
    pass

def check(value, *, today=None, require_baseline=False):
    now=today or date.today()
    def fail(message):
        raise RightsGateError(message)
    if not isinstance(value,dict) or set(value)!=TOP:fail("REGISTRY_SHAPE")
    if value["schema_version"]!="CANONE_EDITORIAL_RIGHTS_V1" or value["project"]!="auditeduca/canone":
        fail("REGISTRY_VERSION")
    if value["production_gate"]!="NO_GO" or value["legal_release_stage"]!="F4_HUMAN_SIGNOFF_NOT_YET_PERFORMED":
        fail("EARLY_PRODUCTION_OR_LEGAL_RELEASE")
    if not isinstance(value["assets"],list) or not value["assets"] or len(value["assets"])>5000:
        fail("ASSET_INVENTORY_MISSING")
    if not isinstance(value["source_references"],list) or len(value["source_references"])<2:
        fail("SOURCES_MISSING")
    for source in value["source_references"]:
        if not isinstance(source,dict) or set(source)!={"kind","title","url"}:fail("SOURCE_SHAPE")
        url=source["url"]
        if not isinstance(url,str) or not url.startswith("https://") or urlparse(url).username:
            fail("SOURCE_SCHEME")
    seen=set()
    counts={"TEST_ONLY":0,"HOLD_RIGHTS":0,"REJECTED":0}
    for entry in value["assets"]:
        if not isinstance(entry,dict) or set(entry)!=REQUIRED:fail("ENTRY_SHAPE")
        aid=entry["asset_id"]
        if not isinstance(aid,str) or not ASSET.fullmatch(aid) or aid in seen:fail("DUPLICATE_OR_INVALID_ASSET")
        seen.add(aid)
        state=entry["state"]
        if state not in counts:
            # No direct "APPROVED_FOR_PUBLICATION" in v1: human F4 assessment is still missing.
            fail("RELEASE_REQUIRES_F4_LEGAL_AND_EDITORIAL_SIGNOFF")
        counts[state]+=1
        origin=entry["origin"]
        if origin not in {"SYNTHETIC_ORIGINAL","THIRD_PARTY","UNKNOWN"}:fail("UNKNOWN_ORIGIN")
        scope=entry["permitted_scope"]
        reviewers=entry["reviewers"]
        if not isinstance(scope,list) or not isinstance(reviewers,list):fail("INVALID_SCOPE_OR_REVIEWERS")
        if state=="TEST_ONLY":
            if origin!="SYNTHETIC_ORIGINAL" or scope!=["EPHEMERAL_CI"]:
                fail("TEST_SCOPE_OR_ORIGIN_INCONSISTENT")
            if entry["source_ref"]!="alpha7-test":fail("TEST_SOURCE_MISMATCH")
            if not isinstance(entry["content_version"],str) or not UUID.fullmatch(entry["content_version"]):
                fail("TEST_VERSION_MISSING")
            if not isinstance(entry["evidence_ref"],str) or not entry["evidence_ref"].startswith("tests/sql/"):
                fail("TEST_EVIDENCE_MISSING")
            if len(reviewers)!=2 or reviewers[0]==reviewers[1] or any(
                not isinstance(x,str) or not AUDITOR.fullmatch(x) for x in reviewers):
                fail("INDEPENDENT_TEST_REVIEWERS_REQUIRED")
            try: exp=date.fromisoformat(entry["expires_on"])
            except (TypeError,ValueError):fail("TEST_EXPIRY_REQUIRED")
            if exp<=now:fail("TEST_RIGHTS_EXPIRED")
        else:
            if scope or entry["evidence_ref"] is not None or reviewers or entry["expires_on"] is not None or entry["content_version"] is not None:
                fail("HOLD_OR_REJECTED_CANNOT_HAVE_RELEASE_GRANT")
            src=entry["source_ref"]
            if not isinstance(src,str) or not any(src.startswith(prefix) for prefix in SRC_OK):
                fail("SOURCE_PROVENANCE_MISSING")
    if require_baseline:
        if counts["TEST_ONLY"]!=2 or counts["HOLD_RIGHTS"]<3:fail("BASELINE_NOT_COMPLETE")
        expected={"00000000-0000-4000-8000-000000000008",
                  "00000000-0000-4000-8000-000000000009",
                  "fgv:cfc:2026.2:question-book","fgv:cfc:2026.3:question-book",
                  "historical:quarantined-editorial-bank"}
        if not expected.issubset(seen):fail("MISSING_DECLARED_ASSETS")
    return counts

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--check",action="store_true",help="validate sealed baseline in repo")
    args=ap.parse_args()
    try: counts=check(json.loads(POLICY.read_text(encoding="utf8")),require_baseline=args.check)
    except (RightsGateError,json.JSONDecodeError) as exc:
        print("FAIL RIGHTS_GATE",str(exc),file=sys.stderr);return 2
    print("PASS F3_REC07_RIGHTS_REGISTRY",counts,"production=NO_GO; public=0")
    return 0

if __name__=="__main__":raise SystemExit(main())
