#!/usr/bin/env python3
"""Auditable S22 behavioural SQL projection: invoker views and narrowly scoped owner policies.

Builds review-only SQL.  No network, DB or source writes; never copies legacy
SECURITY DEFINER functions, triggers, broad role grants or client GUC authority.
Source migration SHA-256 is verified before any output is generated.

Usage: python3 tools/convert_canone_behaviour.py --root . --write|--check
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, re, sys
from pathlib import Path

HERE=Path(__file__).resolve()
SPEC=importlib.util.spec_from_file_location('canone_source_converter',HERE.with_name('convert_canone_schema.py'))
base=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(base)
OUT_VIEWS=Path('staging/supabase/004_invoker_views.candidate.sql.txt')
OUT_POLICIES=Path('staging/supabase/005_owner_policies.candidate.sql.txt')
OUT_MANIFEST=Path('staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json')
OUT_AUTH=Path('staging/supabase/006_auth_user_id_compat.candidate.sql.txt')
VERSION='0.23.0-alpha.5'
CATEGORIES={
 'functions':re.compile(r'(?is)^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\('),
 'triggers':re.compile(r'(?is)^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([\w]+)\b'),
 'views':re.compile(r'(?is)^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w.]+)\s+AS\b'),
 'policies':re.compile(r'(?is)^CREATE\s+POLICY\s+([\w]+)\s+ON\s+([\w.]+)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b'),
}
# The two excluded views cannot be ported as simple invoker views:
#  - due_items is a yet-unported privileged scheduling function;
#  - identity.account was replaced by Supabase Auth and user_profile.
EXCLUDED_VIEWS={
 'subscriber.v_my_due':'FUNCTION_DEPENDENCY_UNPORTED_due_items',
 'admin.v_user_overview':'MANAGED_AUTH_IDENTITY_ACCOUNT_REMOVED',
}
# Historically owner-bound policies; review-only whitelist. Each source
# expression MUST be literal user_id = ops.current_user_id() (no broad grants).
SAFE_OWNERS={
 'sub_own_request':'identity.data_request',
 'sub_own_session':'learning.session',
 'sub_own_event':'learning.review_event',
 'sub_own_state':'learning.user_item_state',
 'sub_own_mastery':'learning.mastery',
 'sub_own_favorite':'learning.favorite',
 'sub_own_note':'learning.note',
 'sub_own_offline':'learning.offline_pack',
 'sub_own_plan':'learning.study_plan',
 'sub_own_subscription':'commerce.subscription',
 'sub_own_payment':'commerce.payment',
 'sub_own_entitlement':'commerce.entitlement',
 'sub_insert_request':'identity.data_request',
}
# Deliberately keep each grant explicit: never assume that an old FOR ALL
# means safe UPDATE/DELETE on grading, billing, SRS, or audit rows.
WRITE_CAPS={
 'canone_learning.note':('INSERT','UPDATE','DELETE'),
 'canone_learning.favorite':('INSERT','DELETE'),
 'canone_identity.data_request':('INSERT',),
}
VIEW_RX=re.compile(r'(?is)^(CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+)([\w.]+)(\s+)AS\b')
LEGACY_AREA=re.compile(r'(?i)\b(?:ops|canone_ops)\.current_user_id\s*\(\s*\)')
RISKY_SQL=re.compile(r'(?i)\b(?:identity\.account|canone_identity\.account|app\.current_user_id|app\.current_area)\b')


def _norm(v):return ' '.join(v.strip().split())


def build(root:Path):
    source=json.loads((root/base.ORIGINAL_MANIFEST).read_text())
    cross=json.loads((root/base.CROSSWALK).read_text())
    domain=json.loads((root/base.OUT_MANIFEST).read_text())
    ix=json.loads((root/'staging/supabase/CANONE_INDEXES_CONSTRAINTS_MANIFEST.json').read_text())
    names={x['old']:x['new'] for x in cross['schemas']}
    if len(names)!=14 or len(source['original_migrations'])!=30 or domain['generated_table_count']!=82 or ix['index_generated']!=67:
        raise ValueError('physical DDL inputs not verified')
    if domain['generated_sql_sha256']!=base.sha((root/base.OUT_SQL).read_bytes()):raise ValueError('002 DDL drift')
    if ix['sql_sha256']!=base.sha((root/'staging/supabase/003_indexes_constraints.candidate.sql.txt').read_bytes()):raise ValueError('003 DDL drift')
    items={x:[] for x in CATEGORIES}
    for idx,src in enumerate(source['original_migrations'],1):
        path=root/base.SOURCE/src['file'];content=path.read_bytes()
        if base.sha(content)!=src['sha256'] or not src['file'].startswith(f'{idx:03d}_'):
            raise ValueError('migrations source drift: '+src['file'])
        for stmt,line in base.split_statements(content.decode('utf-8')):
            clean=base.clean_leading(stmt).strip()
            for category,rx in CATEGORIES.items():
                m=rx.match(clean)
                if not m:continue
                item={'source':src['file'],'line':line,'name':m.group(1),
                      'sha256':base.sha(clean.encode('utf-8'))}
                if category=='policies':item.update({'table':m.group(2),'operation':m.group(3).upper()})
                if category=='functions':item.update({'security_definer':bool(re.search(r'(?i)\bSECURITY\s+DEFINER\b',clean)),
                   'uses_legacy_auth_context':bool(re.search(r'(?i)\b(?:app\.current_user_id|app\.current_area|ops\.current_user_id\s*\()',clean)),
                   'uses_dynamic_sql':bool(re.search(r'(?i)\bEXECUTE\b',clean))})
                if category=='triggers':item.update({'requires_function_review':True})
                if category=='views':item.update({'status':'EXCLUDE_DEPENDENCY' if item['name'] in EXCLUDED_VIEWS else 'CANDIDATE_INVOKER',
                   'reason':EXCLUDED_VIEWS.get(item['name'])})
                if category=='policies':item.update({'status':'CANDIDATE_OWNER' if item['name'] in SAFE_OWNERS else 'REVIEW_PRIVILEGES'})
                # SQL retained only locally; output catalog contains metadata/hashes, not bodies.
                item['_raw']=clean
                items[category].append(item)
                break
    actual={k:len(v) for k,v in items.items()}
    if actual!={'functions':58,'triggers':26,'views':18,'policies':80}:
        raise ValueError('behavioural object inventory drift '+str(actual))
    if set(x['name'] for x in items['views'])!=set(EXCLUDED_VIEWS).union(
       x['name'] for x in items['views'] if x['status']=='CANDIDATE_INVOKER'):
        raise ValueError('view catalog not bijective')
    view_blocks=[];view_out=[]
    for it in items['views']:
        name=it['name'];legacy=it['_raw']
        if name in EXCLUDED_VIEWS:continue
        sql=base.rewrite_identifiers(legacy,names)
        sql=LEGACY_AREA.sub('(select auth.uid())',sql)
        if RISKY_SQL.search(sql) or 'ops.current_user_id' in sql:
            raise ValueError('legacy Auth dependency in converted view: '+name)
        m=VIEW_RX.match(sql)
        if not m:raise ValueError('invalid view syntax '+name)
        # No owner-bypass of RLS: Postgres 15+ security_invoker views.
        sql=sql[:m.end() - 2]+'WITH (security_invoker = true) AS'+sql[m.end():]
        if not re.search(r'(?i)\bWITH\s*\(\s*security_invoker\s*=\s*true\s*\)',sql):raise ValueError('view invoker missing')
        if not sql.rstrip().endswith(';'):raise ValueError('bad view terminator')
        view_blocks.append('-- Source '+it['source']+':'+str(it['line'])+' '+name+' (SHA256 '+it['sha256']+')\n'+sql.strip())
        view_out.append({'name':name,'target':names[name.split('.')[0]]+'.'+name.split('.')[1],
           'source':it['source'],'line':it['line'],'sha256':it['sha256'],
           'client_grant':'NONE', 'compatibility':'SQL_COMPILED_ONLY_CLIENT_ACCESS_REQUIRES_FURTHER_RLS_REVIEW'})
    if len(view_blocks)!=16:raise ValueError('expect 16 invoker views')
    select_source={}
    for it in items['policies']:
        if it['name'] not in SAFE_OWNERS:continue
        name=it['name'];expect=SAFE_OWNERS[name]
        if it['table']!=expect:raise ValueError('policy target drift '+name)
        if it['operation'] not in ('ALL','SELECT','INSERT'):raise ValueError('unexpected source owner op '+name)
        normal=_norm(it['_raw']).lower()
        if 'user_id = ops.current_user_id()' not in normal:
            raise ValueError('policy not strictly owner bound: '+name)
        select_source[name]=it
    if set(select_source)!=set(SAFE_OWNERS):raise ValueError('owner whitelist drift '+str(set(SAFE_OWNERS)-set(select_source)))
    selected={}
    for name,it in select_source.items():
        target=names[it['table'].split('.')[0]]+'.'+it['table'].split('.')[1]
        selected.setdefault(target,[]).append(it)
    if len(selected)!=12:raise ValueError('expected 12 owned tables')
    # No policy automatically exposes any table to anonymous users. All grantee
    # schemas are explicit; no SELECT to answers, staff, gabaritos or raw items.
    pol_blocks=[];policy_out=[]
    for table,origins in sorted(selected.items()):
        schema=table.split('.')[0]
        origin=next(x for x in origins if x['operation'] in ('SELECT','ALL'))
        polname='canone_owner_'+table.split('.')[-1]
        pred='(user_id = (select auth.uid()))'
        pol_blocks.append('-- Source '+origin['source']+':'+str(origin['line'])+' '+origin['name']+ '\n'
                          +f'CREATE POLICY {polname}_select ON {table} FOR SELECT TO authenticated USING {pred};')
        pol_blocks.append(f'GRANT USAGE ON SCHEMA {schema} TO authenticated;')
        pol_blocks.append(f'GRANT SELECT ON TABLE {table} TO authenticated;')
        policy_out.append({'table':table,'operation':'SELECT','source':origin['name'],'source_sha256':origin['sha256']})
        for op in WRITE_CAPS.get(table,()):
            lower=op.lower()
            if op=='INSERT':
                code=f'CREATE POLICY {polname}_insert ON {table} FOR INSERT TO authenticated WITH CHECK {pred};'
                privilege='INSERT'
            elif op=='UPDATE':
                code=f'CREATE POLICY {polname}_update ON {table} FOR UPDATE TO authenticated USING {pred} WITH CHECK {pred};'
                privilege='UPDATE'
            elif op=='DELETE':
                code=f'CREATE POLICY {polname}_delete ON {table} FOR DELETE TO authenticated USING {pred};'
                privilege='DELETE'
            pol_blocks.append(code)
            pol_blocks.append(f'GRANT {privilege} ON TABLE {table} TO authenticated;')
            policy_out.append({'table':table,'operation':op,'source':origin['name'],'source_sha256':origin['sha256'],
                               'security_narrowing':'explicit_write_operations_replacing_legacy_FOR_ALL'})
    # `FOR ALL` can look fine under RLS but grants arbitrary updates/deletions on
    # grade/financial/admin data; we intentionally do not export it.
    if len(policy_out)!=18:raise ValueError('expect 18 least-privilege operations, got '+str(len(policy_out)))
    guards=["DO $canone_behavior_guard$ BEGIN IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN RAISE EXCEPTION 'REFUSE_SHARED_CANONE_SOURCE'; END IF; IF to_regclass('canone_learning.note') IS NULL OR to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'REQUIRE_CANONE_PHYSICAL_PILOT'; END IF; END $canone_behavior_guard$;"]
    views='\n'.join(['-- CÂNONE 004, v0.23.0-alpha.5: invoker views; candidate only, requires 001-003.',
      '-- NO public/client grants. No legacy canone_system owner bypass. Not a deployment migration.',
      'BEGIN;', 'SET LOCAL search_path = pg_catalog;',*guards, *view_blocks, 'COMMIT;', ''])
    policies='\n'.join(['-- CÂNONE 005, v0.23.0-alpha.5: strict own-row policies, not a migration.',
      '-- Only authenticated; no staff/admin bypass; no answer key permissions.',
      '-- Requires separate dedicated Supabase with Auth and 001-003.',
      'BEGIN;', 'SET LOCAL search_path = pg_catalog;',*guards,*pol_blocks,'COMMIT;',''])
    original_identity=next((x for x in items['functions'] if x['name']=='ops.current_user_id'),None)
    if original_identity is None:raise ValueError('Legacy identity function missing')
    auth_function='\n'.join([
      '-- CÂNONE 006, v0.23.0-alpha.5: one nonprivileged replacement for old ops.current_user_id.',
      '-- Source '+original_identity['source']+':'+str(original_identity['line'])+' SHA256 '+original_identity['sha256'],
      '-- SQL candidate only; no legacy app.current_user_id GUC or current_area trust.',
      'BEGIN;', 'SET LOCAL search_path = pg_catalog;',*guards,
      'CREATE OR REPLACE FUNCTION canone_ops.current_user_id() RETURNS uuid',
      'LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog',
      'AS $$ SELECT auth.uid() $$;',
      'REVOKE ALL ON FUNCTION canone_ops.current_user_id() FROM PUBLIC, anon;',
      'GRANT USAGE ON SCHEMA canone_ops TO authenticated;',
      'GRANT EXECUTE ON FUNCTION canone_ops.current_user_id() TO authenticated;',
      'COMMIT;', ''])
    for category in items:
        for it in items[category]:it.pop('_raw')
    manifest={'version':VERSION,'status':'REVIEW_ONLY_NO_REMOTE_DEPLOY','source_migrations':30,
       'objects_by_category':actual,'objects':items,'views_generated':view_out,
       'views_excluded':EXCLUDED_VIEWS,'owner_policies_generated':policy_out,
       'owner_policy_operations':len(policy_out),'read_policy_tables':len(selected),
       'source_historical_policies':80,'converted_historical_owner_sources':len(select_source),
       'unported_functions':57,'unported_triggers':26,
       'ported_functions':[{'source':'ops.current_user_id','target':'canone_ops.current_user_id','strategy':'auth.uid security invoker','source_sha256':original_identity['sha256']}],
       'out_auth_sha256':base.sha(auth_function.encode('utf8')),
       'out_views_sha256':base.sha(views.encode('utf8')),
       'out_policies_sha256':base.sha(policies.encode('utf8')),
       'release_gate':'NO_GO','remote_db_writes':False,
       'constraints':['No migration runners may execute candidate .sql.txt',
           'Views security_invoker=true and no viewer grants: not proof of callable APIs',
           'Owner grants are explicit; broad staff/admin legacy policies quarantined',
           'Functions and triggers require individually audited port and PG17 E2E']}
    return views,policies,auth_function,manifest


def main():
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path('.'))
    m=p.add_mutually_exclusive_group(required=True);m.add_argument('--write',action='store_true');m.add_argument('--check',action='store_true')
    a=p.parse_args()
    try:
        root=a.root.resolve();v,p,f,manifest=build(root)
        for output,s in [(OUT_VIEWS,v),(OUT_POLICIES,p),(OUT_AUTH,f),(OUT_MANIFEST,json.dumps(manifest,indent=2,ensure_ascii=False,sort_keys=True)+'\n')]:
            f=root/output
            if a.write:f.parent.mkdir(parents=True,exist_ok=True);f.write_text(s,encoding='utf8')
            elif not f.exists() or f.read_text(encoding='utf8')!=s:raise ValueError('Generated file drift: '+str(output))
        print(json.dumps({'status':'PASS_BEHAVIOUR_CONVERSION','source_objects':{c:len(l) for c,l in manifest['objects'].items()},
            'views':len(manifest['views_generated']),'policy_operations':len(manifest['owner_policies_generated']),
            'unported_functions':manifest['unported_functions'],'unported_triggers':manifest['unported_triggers'],
            'release':'NO_GO'}));return 0
    except Exception as ex:
        print('CANONE_BEHAVIOUR_CONVERSION_FAIL:',str(ex),file=sys.stderr);return 6
if __name__=='__main__':sys.exit(main())
