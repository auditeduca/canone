"""S22 React / S23 product crosswalk: no silent drift or unproven functional claims."""
import csv,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json"
def blob(content):
    return hashlib.sha1(b"blob "+str(len(content)).encode()+b"\0"+content).hexdigest()
def check(data=None,root=ROOT):
    if data is None: data=json.loads((root/"inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json").read_text())
    errors=[]
    if data.get("production_gate")!="NO_GO": errors.append("GATE_NOT_NO_GO")
    items=data.get("modules",[])
    ids=[m.get("id") for m in items]
    if len(ids)!=26 or len(set(ids))!=26: errors.append("COUNT_OR_DUPLICATES")
    catalog=(root/"source-s22/app/src/content/modulos.ts").read_text()
    legacy_ids=set(re.findall(r'\{\s*n:\s*\d+,\s*id:\s*"([^"]+)",\s*nome:',catalog))
    with (root/"planning/s23/S23_MODULOS_26.csv").open(encoding="utf-8-sig",newline="") as f:
        planned={r["ID canônico"]:r for r in csv.DictReader(f)}
    with (root/"planning/s23/S23_FASEAMENTO_26.csv").open(encoding="utf-8-sig",newline="") as f:
        phased={r["Slug legado"]:r for r in csv.DictReader(f)}
    if set(ids)!=legacy_ids or set(ids)!=set(planned) or set(ids)!=set(phased): errors.append("CROSSWALK_MISMATCH")
    for item in items:
        uid=item["id"]
        if item["legacy_route"]!="#/modulo/"+uid: errors.append("ROUTE_DRIFT:"+uid)
        if uid in planned and item["priority"]!=planned[uid]["P"]:errors.append("PRIORITY_DRIFT:"+uid)
        if uid in phased and item["release"]!=phased[uid]["Release proposto"]:errors.append("RELEASE_DRIFT:"+uid)
        if item["legacy_specialized_mounted"] is not False:errors.append("UNPROVEN_INTEGRATION:"+uid)
        for path in item["unmounted_candidates"]:
            if not (root/path).is_file() or (("'"+uid+"'") not in (root/path).read_text() and ('"'+uid+'"') not in (root/path).read_text()):
                errors.append("CANDIDATE_DRIFT:"+uid)
    for item in data.get("source_blobs",[]):
        p=root/item["path"]
        if not p.is_file() or blob(p.read_bytes())!=item["sha1"]:errors.append("SOURCE_BLOB_DRIFT:"+item["path"])
    expected={"module_ids":len(legacy_ids),"candidates":sum(bool(m["unmounted_candidates"]) for m in items),
      "catalog_only":sum(not m["unmounted_candidates"] for m in items),"confirmed_specialized_routes":0}
    if expected!=data.get("metrics"):errors.append("METRICS_DRIFT")
    return errors
if __name__=="__main__":
    faults=check()
    for f in faults:print("FAIL",f)
    if faults:raise SystemExit(1)
    print("PASS: F3 26/26 source-checked; NO_GO; integration not overclaimed")
