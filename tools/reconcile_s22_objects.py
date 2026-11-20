#!/usr/bin/env python3
"""NS-01: deterministic declaration-level S22 -> staged SQL object register.

This is a static *inventory*, not executable SQL, automatic semantic equivalence
or an authorization to deploy any candidate. Every original statement is kept
with its SHA and source line. Replaced contracts are explicitly distinguishable
from same-name SQL definitions, and all remaining work stays visible.

Usage:
    python3 tools/reconcile_s22_objects.py --root . --write
    python3 tools/reconcile_s22_objects.py --root . --check
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sys

SOURCE = Path('source-s22/backend/db/migrations')
SOURCE_MANIFEST = Path('source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json')
HISTORICAL = Path('staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json')
CROSSWALK = Path('crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json')
CANDIDATES = Path('staging/supabase')
OUTPUT_JSON = Path('inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json')
OUTPUT_MD = Path('docs/NS01_INVENTARIO_FUNCOES_TRIGGERS_VIEWS_POLICIES.md')
VERSION = '0.23.0-alpha.9-ns01'
COUNTS = {'functions': 58, 'triggers': 26, 'views': 18, 'policies': 80}

# These are *contract successor* candidates, never assertions of semantic parity.
# Old function signatures, grade/rights checks and side effects must still be
# reviewed independently before treating them as functionally equivalent.
FUNCTION_CONTRACTS = {
    'learning.start_exam_attempt': 'canone_ops.exam_start',
    'learning.answer_exam_attempt': 'canone_ops.exam_answer',
    'learning.finish_exam_attempt': 'canone_ops.exam_finish',
    'learning.reveal_exam_key': 'canone_ops.exam_reveal',
    'learning.grade_answer': 'canone_ops.exam_answer',
    'learning.apply_review_event': 'canone_ops.exam_to_srs',
}
TRIGGER_CONTRACTS = {
    'trg_audit_hash': 'trg_audit_chain_insert',
}

# Anchored-at-line-start DDL declarations only. We do NOT copy code from
# commented-out source blocks or infer that a same-name redefinition is safe.
DDL = {
 'functions': re.compile(r'(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z][\w]*\.[a-z][\w]*)\s*\('),
 'triggers': re.compile(r'(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+([a-z][\w]*)\b'),
 'views': re.compile(r'(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-z][\w]*\.[a-z][\w]*)\s+(?:WITH\s*\([^;]*?\)\s+)?AS\b'),
 'policies': re.compile(r'(?im)^\s*CREATE\s+POLICY\s+([a-z][\w]*)\s+ON\s+([a-z][\w]*\.[a-z][\w]*)\b'),
}

def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load_json(root: Path, path: Path):
    return json.loads((root/path).read_text(encoding='utf-8'))


def verify_migrations(root: Path) -> tuple[dict, list[dict]]:
    manifest = load_json(root, SOURCE_MANIFEST)
    origins = manifest['original_migrations']
    if len(origins) != 30:
        raise ValueError('Expected 30 canonical source migrations')
    for index, row in enumerate(origins, 1):
        file = row['file']
        if not re.fullmatch(r'\d{3}_[\w-]+\.sql', file) or not file.startswith(f'{index:03d}_'):
            raise ValueError(f'Invalid source migration order/name: {file}')
        b = (root/SOURCE/file).read_bytes()
        if sha(b) != row['sha256']:
            raise ValueError(f'Historical source SQL hash mismatch: {file}')
    return manifest, origins


def candidate_files(root: Path):
    all_files = sorted((root/CANDIDATES).glob('[0-9][0-9][0-9]_*.candidate.sql.txt'))
    if len(all_files) != 10:
        raise ValueError('Require EXACTLY 10 staged SQL candidates 001..010 (none applied remotely)')
    prefix = [int(p.name[:3]) for p in all_files]
    if prefix != list(range(1, 11)):
        raise ValueError(f'Candidate SQL sequence/gaps: {prefix}')
    return all_files


def sql_defs(root: Path, files: list[Path]) -> tuple[dict, dict]:
    by_type = {category: defaultdict(list) for category in DDL}
    hashes = {}
    for p in files:
        rel = p.relative_to(root).as_posix()
        raw = p.read_bytes()
        hashes[rel] = {'sha256': sha(raw), 'bytes': len(raw)}
        sql = raw.decode('utf-8')
        for category, pattern in DDL.items():
            for match in pattern.finditer(sql):
                name = match.group(1).lower()
                key = (name, match.group(2).lower()) if category == 'policies' else name
                row = {'target': name, 'candidate': rel, 'line': sql.count('\n', 0, match.start()) + 1,
                       'candidate_sha256': hashes[rel]['sha256']}
                if category == 'policies': row['table'] = match.group(2).lower()
                if category == 'triggers':
                    tail = sql[match.end():match.end()+400]
                    on = re.search(r'(?i)\bON\s+([\w.]+)\b', tail)
                    if on: row['table'] = on.group(1).lower()
                by_type[category][key].append(row)
    return by_type, hashes


def canonical_name(old: str, mapping: dict[str, str]):
    if '.' not in old: return old.lower()
    schema, name = old.lower().split('.', 1)
    return mapping.get(schema, schema) + '.' + name


def risk_tags(cat: str, row: dict):
    tags=[]
    if cat == 'functions':
        if row.get('security_definer'): tags.append('SECURITY_DEFINER_SOURCE')
        if row.get('uses_legacy_auth_context'): tags.append('LEGACY_AUTH_GUC_OR_ROLE')
        if row.get('uses_dynamic_sql'): tags.append('DYNAMIC_SQL_SOURCE')
        if any(t in row['name'] for t in ['grade', 'correct', 'key', 'gabarito', 'import', 'staff']):tags.append('ANSWER_OR_PRIVILEGED_FLOW')
    elif cat == 'policies':
        if row['name'].startswith(('staff_', 'admin_')): tags.append('ADMIN_OR_STAFF_POLICY')
        if row.get('operation') == 'ALL': tags.append('BROAD_ALL_OPERATION')
        if 'answer_key' in row.get('table',''):tags.append('ANSWER_KEY_ACCESS')
    elif cat == 'views':
        if row['name'].startswith('admin.'):tags.append('ADMIN_VIEW')
        if row['name'].startswith('public.'):tags.append('PUBLIC_VIEW_NEEDS_LICENSE_REVIEW')
    return tags


def reconstruct(root: Path) -> tuple[dict, str]:
    _, origins = verify_migrations(root)
    historic = load_json(root, HISTORICAL)
    if historic.get('objects_by_category') != COUNTS:
        raise ValueError('Historical declaration counts changed, review required')
    cross = load_json(root, CROSSWALK)
    mapping = {x['old'].lower():x['new'].lower() for x in cross['schemas']}
    if len(mapping) != 14: raise ValueError('Expected 14 schema rewrites')
    candidates = candidate_files(root)
    definitions, hashes = sql_defs(root, candidates)
    # Independently cross-check each candidate against its PRE-EXISTING prior
    # milestone attestation, not against a hash we just generated here.
    alpha6 = load_json(root, Path('staging/supabase/CANONE_INTEGRITY_ALPHA6_MANIFEST.json'))
    alpha7 = load_json(root, Path('staging/supabase/CANONE_AUDIT_SEAL_ALPHA7_MANIFEST.json'))
    alpha8 = load_json(root, Path('staging/supabase/CANONE_ATTEMPT_SRS_ALPHA8_MANIFEST.json'))
    alpha9 = load_json(root, Path('staging/supabase/CANONE_ALPHA9_GATEWAY_MANIFEST.json'))
    for p in candidates:
        rel = p.relative_to(root).as_posix()
        n = int(p.name[:3])
        if n <= 6:
            expected = alpha6['input_candidate_sha256'][p.name]
        elif n == 7: expected = alpha6['sql_sha256']
        elif n == 8: expected = alpha7['sql_sha256']
        elif n == 9: expected = alpha8['sql_sha256']
        else: expected = alpha9['artifacts'][rel]['sha256']
        if hashes[rel]['sha256'] != expected:
            raise ValueError('Previously attested candidate SQL hash mismatch: '+rel)
    # Check historical manifests cannot silently describe modified source files.
    m_names = {x['file'] for x in origins}
    inventory = {}
    for category, historic_rows in historic['objects'].items():
        if category not in COUNTS or len(historic_rows) != COUNTS[category]:raise ValueError('Historical category missing/drift')
        for row in historic_rows:
            if row['source'] not in m_names or not re.fullmatch('[0-9a-f]{64}',row['sha256']):
                raise ValueError('Unverified object origin or SHA: '+row['name'])
        inventory[category] = []
    if set(inventory) != set(COUNTS):raise ValueError('Missing source object category')

    # The source manifest and behaviour manifest are both checked against the SQL
    # by re-extracting the exact statement's normalized hash and recorded line.
    # These historic algorithms are part of the alpha5 source of truth.
    import importlib.util
    script = root/'tools/convert_canone_schema.py'
    spec = importlib.util.spec_from_file_location('canone_alpha5_sql_parser_ns01', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    statements = defaultdict(set)
    old_rx = {
        'functions':re.compile(r'(?is)^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\('),
        'triggers':re.compile(r'(?is)^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([\w]+)\b'),
        'views':re.compile(r'(?is)^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w.]+)\s+AS\b'),
        'policies':re.compile(r'(?is)^CREATE\s+POLICY\s+([\w]+)\s+ON\s+([\w.]+)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b'),
    }
    for m in origins:
        for stmt, line in module.split_statements((root/SOURCE/m['file']).read_text(encoding='utf-8')):
            statement=module.clean_leading(stmt).strip()
            for cat, rx in old_rx.items():
                match=rx.match(statement)
                if match:
                    statements[cat].add((m['file'],line,match.group(1),sha(statement.encode('utf-8'))))
                    break
    for category, rows in historic['objects'].items():
        for record in rows:
            if (record['source'],record['line'],record['name'],record['sha256']) not in statements[category]:
                raise ValueError('Historical statement SHA/line mismatch: '+record['source']+':'+str(record['line']))

    original_policy_mapping = defaultdict(list)
    for pol in historic['owner_policies_generated']:
        original_policy_mapping[pol['source']].append(pol)
    # Historical sub_insert_request was used as provenance, but the generated
    # INSERT policy is anchored to sub_own_request; account for BOTH sources.
    generated_insert = next(x for x in historic['owner_policies_generated']
                            if x['table']=='canone_identity.data_request' and x['operation']=='INSERT')
    original_policy_mapping['sub_insert_request'].append(generated_insert)
    original_view_exclusions = historic['views_excluded']
    for cat in COUNTS:
        for row in historic['objects'][cat]:
            old=row['name'].lower()
            target=canonical_name(old,mapping) if cat!='triggers' else old
            record={'source': row['source'], 'line': row['line'], 'name': row['name'],
                    'source_sha256': row['sha256'], 'target_name_if_retained':target,
                    'risk_tags':risk_tags(cat,row), 'production_ready':False}
            matches=[]
            if cat == 'policies':
                # Source policy can intentionally expand to several narrower
                # per-operation policies; never mark source FOR ALL as ported.
                replacements=original_policy_mapping.get(old, [])
                if replacements:
                    for p in replacements:
                        table=p['table'].lower()
                        destination='canone_owner_'+table.split('.')[-1]+'_'+p['operation'].lower()
                        matches+=definitions['policies'].get((destination,table),[])
                    if len(matches) != len(replacements):
                        raise ValueError('Narrowed owner policy missing candidate: '+old)
                    record['status']='NARROWER_OWNER_POLICY_CANDIDATE'
                    record['reason']='Source policy narrowed by operation; business grants still need individual review'
                else:
                    record['status']='SECURITY_REVIEW_REQUIRED'
                    record['reason']='Legacy policy intentionally not copied; RLS/grant/entitlement review required'
            elif cat == 'views':
                matches=definitions['views'].get(target, [])
                if matches:
                    record['status']='VIEW_CANDIDATE_PRESENT'
                    record['reason']='Invoker view present; client access, content licensing and RLS not fully attested'
                elif old in original_view_exclusions:
                    record['status']='DEFERRED_DEPENDENCY'
                    record['reason']=original_view_exclusions[old]
                else:raise ValueError('View not present or explicitly deferred: '+old)
            else:
                matches=definitions[cat].get(target, [])
                if matches:
                    record['status']='SAME_NAME_CANDIDATE_PRESENT'
                    record['reason']='DDL present; source semantics and privileges not asserted equivalent'
                else:
                    successor=(FUNCTION_CONTRACTS if cat=='functions' else TRIGGER_CONTRACTS).get(old)
                    if successor:
                        matches=definitions[cat].get(successor, [])
                        if not matches:raise ValueError('Contract successor absent: '+old+' -> '+successor)
                        record['status']='CONTRACT_SUCCESSOR_REVIEW'
                        record['reason']='Intentional changed contract, not an automatic equivalence or source port'
                    else:
                        record['status']='UNPORTED'
                        record['reason']='No approved target declaration in SQL candidates 001–010'
            record['candidates']=matches
            inventory[cat].append(record)
    result_stats={cat:dict(sorted(Counter(row['status'] for row in items).items())) for cat,items in inventory.items()}
    unique={cat:len(set(x['name'] for x in items)) for cat,items in inventory.items()}
    found={cat:len(definitions[cat]) for cat in COUNTS}
    # An ambiguous object may be overridden in later candidate stages; latest
    # wins in a *test schema* only. Declare the full lineage in the catalog.
    overrides=[]
    for cat in COUNTS:
        for obj, chain in sorted(definitions[cat].items(),key=lambda x:str(x[0])):
            if len(chain)>1:overrides.append({'category':cat,'object':str(obj),'definitions':chain})
    out={
      'status':'RECONCILED_DECLARATIONS_ONLY_NO_DEPLOY',
      'version':VERSION,'source_migrations_verified':len(origins),
      'source_statements':COUNTS,'source_unique_names':unique,
      'candidate_file_count':len(candidates),'candidate_sha256':hashes,
      'candidate_unique_declaration_names':found,
      'status_counts':result_stats,
      'objects':inventory,'staged_name_overrides':overrides,
      'limitations':['Source declarations are not the same as distinct runtime functions (overloads and redefinitions)',
       'Status SAME_NAME_CANDIDATE_PRESENT is not a semantic parity or production readiness claim',
       'Changed service contract mappings must be signed off independently',
       'No SQL migration, Supabase project creation or remote execution authorized',
       'Source RLS policies are deliberately NOT automatically copied, even when a similar rule exists'],
      'next':['Review unported privileged functions and triggers by source line and risk',
              'Review all 67 non-whitelisted legacy RLS policies, including privilege grants',
              'Resolve two deferred views without owner-bypass or cross-project data access',
              'Complete integration API/PG17 locally, leaving Supabase as final F8'],
      'remote_writes':0,'release_gate':'NO_GO'
    }
    total=sum(len(x) for x in inventory.values())
    if total!=182:raise ValueError('Lost declarations: '+str(total))
    if len([x for x in inventory['views'] if x['status']=='DEFERRED_DEPENDENCY'])!=2:raise ValueError('Expected 2 deferred views')
    if len([x for x in inventory['policies'] if x['status']=='NARROWER_OWNER_POLICY_CANDIDATE'])!=13:raise ValueError('Expected 13 narrowed owner source statements')
    md = render_md(out)
    return out,md


def render_md(out):
    lines=['# NS-01 — reconciliação das declarações SQL S22 (sem Supabase)',
      '', '**Marco:** 20/11/2026 | **Escopo:** S22→staging 001–010 | **Estado:** INVENTÁRIO CONFERIDO / NO-GO produção',
      '', 'A reconciliação classifica **cada declaração histórica**; não representa 100% do comportamento executável, conclusão de funcionalidades ou permissão para implantar SQL.',
      '', '| Categoria | Declarações S22 | Nomes históricos únicos | Nomes candidatos únicos | Situação por declaração |',
      '|---|---:|---:|---:|---|']
    for cat in ('functions','triggers','views','policies'):
        statuses=', '.join(f'{k}: **{v}**' for k,v in out['status_counts'][cat].items())
        lines.append(f'| {cat} | {out["source_statements"][cat]} | {out["source_unique_names"][cat]} | {out["candidate_unique_declaration_names"][cat]} | {statuses} |')
    lines += ['','**Base auditada:** 30 migrations com SHA-256 verificado; 10 candidatos SQL com SHA-256 registrado; 182 declarações originais rastreadas por arquivo, linha e hash.',
        '', '## Pendências priorizadas (não omitidas)', '']
    for cat in ('functions','triggers','views','policies'):
        lines.append('### '+cat)
        todo=[x for x in out['objects'][cat] if x['status'] in ('UNPORTED','SECURITY_REVIEW_REQUIRED','CONTRACT_SUCCESSOR_REVIEW','DEFERRED_DEPENDENCY')]
        for row in todo:
            detail=f' → `{row["candidates"][-1]["target"]}`' if row['candidates'] else ''
            lines.append(f'- `{row["name"]}` — **{row["status"]}**{detail}; fonte `{row["source"]}:{row["line"]}`; SHA `{row["source_sha256"][:12]}`; risco: {", ".join(row["risk_tags"]) or "sem indicação estática"}')
        if not todo:lines.append('- Sem pendência nesse recorte de declaração; confirmar testes e equivalência operacional.')
        lines.append('')
    lines += ['## Verificações e escopo','',
      '- O gerador valida os 30 hashes, reconstrói cada declaração SQL com mesmo SHA e linha do inventário histórico, verifica a presença de candidatos e a classificação completa.',
      '- Redefinições posteriores são listadas em `staged_name_overrides`. **A última DDL prevalecer em PG não significa equivalência com S22.**',
      '- 13 políticas owner-only geraram 18 políticas mais restritas; as demais exigem revisão de ACL/RLS e nenhuma foi implicitamente promovida.',
      '- Nenhum banco remoto, projeto Supabase, branch ou deploy é criado por este procedimento.',
      '- F1 permanece **em andamento**: objetos não portados, segurança/admin, 2 views e funções de negócio requerem implementação e aceites posteriores.',
      '', '### Reprodução', '', '```bash',
      'python3 tools/reconcile_s22_objects.py --root . --check',
      'python3 -m unittest discover -s tests -p "test_ns01_object_reconciliation.py" -v',
      '```', '',
      'Registro completo: `inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json`.',
      'Diretriz: [Plano Supabase por último](PLANO_CONCLUSAO_SUPABASE_ULTIMO.md).', '']
    return '\n'.join(lines)


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',type=Path,default=Path('.'))
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--write',action='store_true')
    group.add_argument('--check',action='store_true')
    a=p.parse_args()
    try:
        root=a.root.resolve()
        out,md=reconstruct(root)
        outputs={OUTPUT_JSON:json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',OUTPUT_MD:md}
        for path,content in outputs.items():
            dest=root/path
            if a.write:
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_text(content,encoding='utf-8')
            elif not dest.is_file() or dest.read_text(encoding='utf-8')!=content:
                raise ValueError('Generated file mismatch: '+str(path))
        print(json.dumps({'status':'NS01_RECONCILIATION_PASS','sources':out['source_migrations_verified'],
                          'source_statements':sum(COUNTS.values()),'candidate_sql':out['candidate_file_count'],
                          'status_counts':out['status_counts'],'gate':out['release_gate']},ensure_ascii=False))
        return 0
    except Exception as e:
        print('NS01_RECONCILIATION_FAIL:',str(e),file=sys.stderr)
        return 6

if __name__=='__main__':sys.exit(main())
