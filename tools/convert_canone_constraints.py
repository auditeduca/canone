#!/usr/bin/env python3
"""Automated S22 out-of-line constraints/index conversion (non-deployable)."""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, re, sys
from pathlib import Path

HERE=Path(__file__).resolve()
SPEC=importlib.util.spec_from_file_location('canone_domain_convert',HERE.with_name('convert_canone_schema.py'))
base=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(base)
OUT=Path('staging/supabase/003_indexes_constraints.candidate.sql.txt')
MANIFEST=Path('staging/supabase/CANONE_INDEXES_CONSTRAINTS_MANIFEST.json')
# Substituted by managed Auth, already present in the 001 identity pilot, or
# requires Supabase-supported pg_trgm extension before its native execution.
SKIP_INDEX={
 'ix_session_user':('MANAGED_AUTH','Authentication sessions belong to Supabase Auth'),
 'ix_user_role_active':('PILOT_EQUIVALENT','001 pilot already creates ix_canone_user_role_active'),
 'ix_consent_user':('PILOT_EQUIVALENT','001 pilot already creates ix_canone_consent_user'),
 'ix_content_item_search_trgm':('EXTENSION_PREREQUISITE','pg_trgm gin_trgm_ops requires separately attested extension installation'),
}
INDEX=re.compile(r'^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+([a-z_][\w]*)\s+ON\s+([a-z_][\w]*)\.([a-z_][\w]*)',re.I | re.S)
ALTER=re.compile(r'^\s*ALTER\s+TABLE\s+([a-z_][\w]*)\.([a-z_][\w]*)\s+(.*)$',re.I | re.S)


def build(root:Path)->tuple[str,dict]:
    src=json.loads((root/base.ORIGINAL_MANIFEST).read_text())
    mapdata=json.loads((root/base.CROSSWALK).read_text())
    tabledata=json.loads((root/base.OUT_MANIFEST).read_text())
    namespaces={x['old']:x['new'] for x in mapdata['schemas']}
    if len(src['original_migrations'])!=30 or tabledata['generated_table_count']!=82:raise ValueError('Crosswalk incomplete')
    if tabledata['generated_sql_sha256']!=base.sha((root/base.OUT_SQL).read_bytes()):raise ValueError('82-table payload drift')
    index_sql=[];alter_sql=[];skipped=[];kept=[];rls_redundant=[]
    for num,item in enumerate(src['original_migrations'],1):
        raw=(root/base.SOURCE/item['file']).read_bytes()
        if base.sha(raw)!=item['sha256'] or not item['file'].startswith(f'{num:03d}_'):raise ValueError('Source mismatch '+item['file'])
        for statement,line in base.split_statements(raw.decode('utf8')):
            s=base.clean_leading(statement).strip()
            if m:=INDEX.match(s):
                index_name,legacy_schema,table=m.groups()
                if legacy_schema not in namespaces:raise ValueError('index schema outside known domains')
                if index_name in SKIP_INDEX:
                    k,why=SKIP_INDEX[index_name];skipped.append({'source':item['file'],'line':line,'index':index_name,'reason':k,'details':why});continue
                translated=base.rewrite_identifiers(s,namespaces)
                if not translated.endswith(';'):raise ValueError('incomplete CREATE INDEX '+index_name)
                index_sql.append((item['file'],line,translated));kept.append({'source':item['file'],'line':line,'object':index_name,'type':'INDEX','target':namespaces[legacy_schema]+'.'+table})
            elif m:=ALTER.match(s):
                legacy_schema,table,tail=m.groups()
                if legacy_schema not in namespaces:raise ValueError('alter schema outside known domains')
                if re.match(r'(ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY',tail,re.I):
                    rls_redundant.append({'source':item['file'],'line':line,'table':f'{legacy_schema}.{table}'});continue
                if legacy_schema=='identity' and table in ('account','session','magic_link'):
                    raise ValueError('cannot alter managed auth table: '+table)
                translated=base.rewrite_identifiers(s,namespaces)
                if not translated.endswith(';'):raise ValueError('incomplete ALTER TABLE '+table)
                alter_sql.append((item['file'],line,translated));kept.append({'source':item['file'],'line':line,'object':namespaces[legacy_schema]+'.'+table,'type':'ALTER_TABLE'})
    if (len(index_sql),len(alter_sql),len(skipped),len(rls_redundant))!=(67,12,4,16):
        raise ValueError(f'index/ALTER inventory drift: {len(index_sql)}/{len(alter_sql)}/{len(skipped)}/{len(rls_redundant)}')
    header=[
      '-- CÂNONE S22 to Supabase: 67 indexes and 12 structural ALTER statements',
      '-- GENERATED REVIEW CANDIDATE ONLY; no public grants, no migrations or deployment.',
      '-- Requires 001 pilot and 002 converted domain table definitions first.',
      '-- One pg_trgm dependent index deliberately deferred; three redundant/auth indexes skipped.',
      'BEGIN;', 'SET LOCAL search_path = pg_catalog;',
      "DO $canone_index_guard$ BEGIN IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN RAISE EXCEPTION 'REFUSE_SHARED_CANONE_SOURCE'; END IF; IF to_regclass('canone_learning.exam_attempt') IS NULL OR to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'REQUIRE_S22_CANONICAL_TABLES'; END IF; END $canone_index_guard$;",
    ]
    blocks=[]
    for filename,line,sql in alter_sql:
        blocks.append('-- Source structural ALTER: '+filename+':'+str(line)+'\n'+sql+'\n')
    for filename,line,sql in index_sql:
        blocks.append('-- Source index: '+filename+':'+str(line)+'\n'+sql+'\n')
    code='\n'.join(header)+'\n\n'+'\n'.join(blocks)+'\nCOMMIT;\n'
    report={
        'version':'0.23.0-alpha.4', 'status':'CANDIDATE_INDEXES_AND_CONSTRAINTS_NOT_FULL_MIGRATION',
        'source_migrations':30,'source_indexes':71,'index_generated':67,'index_skipped':skipped,
        'structural_alter_generated':12,'already_enforced_rls_alter_skipped':16,
        'generated_entries':kept, 'sql_sha256':base.sha(code.encode('utf8')),
        'source_migration_hashes_verified':True,'app_release':'NO_GO','source_db_writes':False,
        'notes':['Structurally converted indexes/ALTER TABLE are candidate only; triggers, functions, views and policies remain separate',
          'GIN trigram index requires supported pg_trgm extension in isolated PG17; never silently replace operator class',
          'Domain and Auth data remain inaccessible to browsers without explicit reviewed policies'],
    }
    return code,report


def main(argv=None):
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default='.')
    group=p.add_mutually_exclusive_group(required=True);group.add_argument('--write',action='store_true');group.add_argument('--check',action='store_true')
    args=p.parse_args(argv)
    try:
        root=args.root.resolve();sql,data=build(root)
        for name,content in [(OUT,sql),(MANIFEST,json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+'\n')]:
            path=root/name
            if args.write:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf8')
            elif not path.exists() or path.read_text(encoding='utf8')!=content:raise ValueError('Output drift '+str(name))
        print(json.dumps({'status':'PASS_67_INDEXES_12_ALTER','generated_indexes':67,'alter':12,'skipped_indexes':4,'rls_already_forced':16,'release':'NO_GO'}));return 0
    except Exception as e:
        print('CANONE_INDEX_CONVERSION_FAIL:',str(e),file=sys.stderr);return 7
if __name__=='__main__':sys.exit(main())
