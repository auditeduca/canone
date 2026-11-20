"""Prevent F3 regression: 26 S22 UI routes, S23 scope, and source hash provenance."""
import csv,hashlib,io,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json"
def blob(content):
    return hashlib.sha1(b"blob "+str(len(content)).encode()+b"\0"+content).hexdigest()
def read_s23_rows(path):
    value=path.read_text(encoding="utf-8-sig")
    if value.startswith("<PARSED TEXT FOR SHEET:"):
        offset=value.find(">index,")
        if offset<0:raise ValueError("UNKNOWN_S23_FORMAT")
        value=value[offset+1:]
    return list(csv.DictReader(io.StringIO(value)))
def quoted_ids(path,label):
    text=path.read_text(encoding="utf-8")
    match=re.search(r"export const "+re.escape(label)+r"[^=]*=\s*\[([^]]+)\]",text,re.S)
    if not match:raise ValueError("MISSING_SOURCE_GROUP:"+label)
    return set(re.findall(r"'([^']+)'",match.group(1)))
def actual_routes(root=ROOT):
    root_app=(root/"source-s22/app/src/main.tsx").read_text(encoding="utf-8")
    required=("LOCAL_IDS.some","KNOWLEDGE_IDS.some","WORKBENCH_IDS.some","LAB_IDS.some",
      "<LocalModules ","<KnowledgeModules ","<StudyWorkbenches ","<PreviewLabs ",
      "<PersonalPractice ","<FerramentasFinanceiras ")
    if any(x not in root_app for x in required):
        raise ValueError("MISSING_ROOT_ROUTING_LINK")
    wb=(root/"source-s22/app/src/tools/study-workbench.ts").read_text(encoding="utf-8")
    chunk=wb.split("export const WORKBENCH_CONFIG = {",1)[1].split("} as const",1)[0]
    configs=set(re.findall(r"^\s*'([^']+)':\s*\{",chunk,re.M))
    groups={
      "LOCAL_IDS":quoted_ids(root/"source-s22/app/src/screens/LocalModules.tsx","LOCAL_IDS"),
      "KNOWLEDGE_IDS":quoted_ids(root/"source-s22/app/src/screens/KnowledgeModules.tsx","KNOWLEDGE_IDS"),
      "LAB_IDS":quoted_ids(root/"source-s22/app/src/tools/preview-labs.ts","LAB_IDS"),
      "WORKBENCH_IDS":configs,
      "PERSONAL_PRACTICE":{"reposicao","simulados"},
      "FINANCIAL_TOOLS":{"calculadoras","matematica"}}
    if not all(s in root_app for s in ("localId === 'reposicao'","localId === 'simulados'",
      "'#/modulo/calculadoras'","'#/modulo/matematica'")):
        raise ValueError("DIRECT_ROUTE_MISSING")
    routes={}
    for key,values in groups.items():
        for item in values:
            if item in routes:raise ValueError("DUPLICATE_ROUTE:"+item)
            routes[item]=key
    return routes
def check(data=None,root=ROOT):
    if data is None:data=json.loads((root/"inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json").read_text())
    errors=[]
    if data.get("production_gate")!="NO_GO":errors.append("GATE_NOT_NO_GO")
    items=data.get("modules",[])
    ids=[m.get("id") for m in items]
    if len(ids)!=26 or len(set(ids))!=26:errors.append("COUNT_OR_DUPLICATES")
    catalog=(root/"source-s22/app/src/content/modulos.ts").read_text(encoding="utf-8")
    slugs=set(re.findall(r'\{\s*n:\s*\d+,\s*id:\s*"([^"]+)",\s*nome:',catalog))
    planned={r["ID canônico"]:r for r in read_s23_rows(root/"planning/s23/S23_MODULOS_26.csv")}
    phased={r["Slug legado"]:r for r in read_s23_rows(root/"planning/s23/S23_FASEAMENTO_26.csv")}
    if set(ids)!=slugs or set(ids)!=set(planned) or set(ids)!=set(phased):errors.append("CATALOG_MISMATCH")
    try:routes=actual_routes(root)
    except ValueError as exc:errors.append(str(exc));routes={}
    if set(ids)!=set(routes):errors.append("ROUTES_MISMATCH")
    for item in items:
        uid=item["id"]
        if item.get("legacy_route")!="#/modulo/"+uid:errors.append("ROUTE_DRIFT:"+uid)
        if item.get("route_handler")!=routes.get(uid) or item.get("route_code_present") is not True:
            errors.append("HANDLER_DRIFT:"+uid)
        if item.get("p0_production_homologated") is not False:errors.append("UNPROVEN_HOMOLOGATION:"+uid)
        if uid in planned and item["priority"]!=planned[uid]["P"]:errors.append("PRIORITY_DRIFT:"+uid)
        if uid in phased and item["release"]!=phased[uid]["Release proposto"]:errors.append("RELEASE_DRIFT:"+uid)
        if not (root/item["component_path"]).is_file():errors.append("COMPONENT_MISSING:"+uid)
    for item in data.get("source_blobs",[]):
        p=root/item["path"]
        if not p.is_file() or blob(p.read_bytes())!=item["sha1"]:errors.append("SOURCE_BLOB_DRIFT:"+item["path"])
    counts={"module_ids":len(slugs),"routed_to_specialized_s22":len(routes),
      "production_homologated":0,"web_react_to_gateway_pg17_e2e":0}
    if counts!=data.get("metrics"):errors.append("METRIC_DRIFT")
    return errors
if __name__=="__main__":
    issues=check()
    for item in issues:print("FAIL",item)
    if issues:raise SystemExit(1)
    print("PASS 26/26 S22 specialized route code, source hashes, S23 alignment, NO_GO")
