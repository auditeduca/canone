#!/usr/bin/env python3
"""Generate deterministic, NON-DEPLOYABLE Cânone S22 table DDL for separate Supabase.

Python 3 standard library. Does not connect to DB, execute SQL, migrate user data
or touch original S22 migrations. Only CREATE TABLE statements are projected;
all functions, triggers, grants, indexes, seeds and out-of-line ALTER statements
are explicitly *not* converted in this phase and stay queued by file/line.

Usage:
    python tools/convert_canone_schema.py --root . --write
    python tools/convert_canone_schema.py --root . --check

Output .candidate.sql.txt intentionally cannot be consumed by a migration runner.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path

SOURCE = Path('source-s22/backend/db/migrations')
ORIGINAL_MANIFEST = Path('source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json')
CROSSWALK = Path('crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json')
PILOT = Path('staging/supabase/001_identity_and_source_bridge.candidate.sql.txt')
OUT_SQL = Path('staging/supabase/002_domain_tables_82.candidate.sql.txt')
OUT_MANIFEST = Path('staging/supabase/CANONE_DOMAIN_TABLES_CONVERSION_MANIFEST.json')
VERSION = '0.23.0-alpha.4'
MANAGED_AUTH = {'identity.account','identity.session','identity.magic_link'}
PILOT_OWNED = {
    'identity.user_profile', 'identity.role', 'identity.user_role',
    'identity.consent_purpose', 'identity.consent',
}
TABLE_START = re.compile(r'^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][\w]*)\.([a-z_][\w]*)\s*\(', re.I | re.S)
SCHEMA_REF = re.compile(r'(?<![\w"])(identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit|public|subscriber|evidence|bridge|control)(\s*)\.', re.I)
LEGACY_AUTH_FK = re.compile(r'(?i)\bREFERENCES\s+identity\s*\.\s*account\s*\(\s*id\s*\)')


def sha(data:bytes)->str:
    return hashlib.sha256(data).hexdigest()


def split_statements(text:str)->list[tuple[str,int]]:
    """Split SQL on semicolons outside quoted strings/comments/dollar bodies.

    Unbalanced quoting fails closed; original SQL is never normalized or edited.
    """
    out=[]; i=0; beg=0; line=1; beg_line=1; n=len(text)
    mode='code'; dollar=''; nested=0
    while i<n:
        c=text[i]; q=text[i:i+2]
        if mode=='code':
            if q=='--': mode='comment'; i+=2; continue
            if q=='/*': mode='block';nested=1;i+=2;continue
            if c=="'":mode='string';i+=1;continue
            if c=='"':mode='identifier';i+=1;continue
            if c=='$':
                m=re.match(r'\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$',text[i:]);
                if m: dollar=m.group();mode='dollar';i+=len(dollar);continue
            if c==';':
                out.append((text[beg:i+1],beg_line));beg=i+1;beg_line=line
        elif mode=='comment':
            if c=='\n':mode='code'
        elif mode=='block':
            if q=='/*':nested+=1;i+=2;continue
            if q=='*/':nested-=1;i+=2;mode='code' if nested==0 else 'block';continue
        elif mode=='string':
            if q=="''":i+=2;continue
            if c=="'":mode='code'
        elif mode=='identifier':
            if q=='""':i+=2;continue
            if c=='"':mode='code'
        elif mode=='dollar':
            if text.startswith(dollar,i):i+=len(dollar);mode='code';continue
        if c=='\n':line+=1
        i+=1
    if mode in ('block','string','identifier','dollar'):raise ValueError('Unclosed SQL lexical segment: '+mode)
    if text[beg:].strip(): out.append((text[beg:],beg_line))
    return out


def clean_leading(sql:str)->str:
    """Remove only leading comments and whitespace to classify a statement."""
    i=0;n=len(sql)
    while i<n:
        m=re.match(r'\s+',sql[i:])
        if m:i+=len(m.group());continue
        if sql.startswith('--',i):
            pos=sql.find('\n',i);i=(pos+1 if pos>=0 else n);continue
        if sql.startswith('/*',i):
            pos=sql.find('*/',i+2)
            if pos<0:raise ValueError('unclosed prefix block comment')
            i=pos+2;continue
        break
    return sql[i:]


def rewrite_identifiers(sql:str, schema_map:dict[str,str])->str:
    """Rewrites schema-qualified references only in SQL code (not comments/literals)."""
    out=[]; n=len(sql); i=0; start=0; mode='code'
    while i<n:
        c=sql[i]; q=sql[i:i+2]
        if q=='--' or q=='/*' or c in "'\"$":
            if c=='$':
                m=re.match(r'\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$',sql[i:])
                if not m:i+=1;continue
                delim=m.group();close=sql.find(delim,i+len(delim))
                if close<0:raise ValueError('unterminated dollar quote')
                out.append(SCHEMA_REF.sub(lambda x:schema_map[x.group(1).lower()]+x.group(2)+'.',sql[start:i]));out.append(sql[i:close+len(delim)]);i=close+len(delim);start=i;continue
            if q=='--':end=sql.find('\n',i);end=n if end<0 else end+1
            elif q=='/*':
                # Comments of original table definitions are not nested in practice.
                end=sql.find('*/',i+2)
                if end<0:raise ValueError('unterminated block comment')
                end+=2
            elif c=="'":
                end=i+1
                while end<n:
                    if sql.startswith("''",end):end+=2;continue
                    if sql[end]=="'":end+=1;break
                    end+=1
                else:raise ValueError('unterminated SQL string')
            else:
                end=i+1
                while end<n:
                    if sql.startswith('""',end):end+=2;continue
                    if sql[end]=='"':end+=1;break
                    end+=1
                else:raise ValueError('unterminated quoted identifier')
            out.append(SCHEMA_REF.sub(lambda x:schema_map[x.group(1).lower()]+x.group(2)+'.',sql[start:i]));out.append(sql[i:end]);i=end;start=i;continue
        i+=1
    out.append(SCHEMA_REF.sub(lambda x:schema_map[x.group(1).lower()]+x.group(2)+'.',sql[start:]));return ''.join(out)


def build(root:Path)->tuple[str,dict]:
    src_manifest=json.loads((root/ORIGINAL_MANIFEST).read_text(encoding='utf-8'))
    crosswalk=json.loads((root/CROSSWALK).read_text(encoding='utf-8'))
    names={a['old']:a['new'] for a in crosswalk['schemas']}
    assert len(names)==14 and len(crosswalk['table_crosswalk'])==90
    assert len(src_manifest['original_migrations'])==30
    assert all(names[k]=='canone_'+k for k in names)
    pilot=(root/PILOT).read_bytes()
    if 'CREATE TABLE canone_identity.user_profile' not in pilot.decode('utf8'):
        raise ValueError('pilot identity not present')
    candidates=[]; originals=[]; ordered=[]; ignored=[]; source_references=0
    for i,file in enumerate(src_manifest['original_migrations'],1):
        filename=file['file'];raw=(root/SOURCE/filename).read_bytes()
        if sha(raw)!=file['sha256'] or not filename.startswith(f'{i:03d}_'):
            raise ValueError('Source mismatch (refuse conversion): '+filename)
        originals.append({'file':filename,'sha256':file['sha256']})
        statements=split_statements(raw.decode('utf8'))
        other_types={}
        for stmt,line in statements:
            sql=clean_leading(stmt)
            m=TABLE_START.match(sql)
            if m:
                schema,table=m.group(1),m.group(2)
                legacy=f'{schema}.{table}'
                if schema not in names:raise ValueError('Unknown schema for '+legacy)
                dest=names[schema]+'.'+table
                if legacy in MANAGED_AUTH:
                    ordered.append({'source':legacy,'target':'Supabase Auth (managed)','strategy':'managed_auth','migration':filename,'line':line});continue
                if legacy in PILOT_OWNED:
                    ordered.append({'source':legacy,'target':dest,'strategy':'existing_identity_pilot','migration':filename,'line':line});continue
                if not sql.rstrip().endswith(';'):raise ValueError('Incomplete table CREATE statement '+legacy)
                remapped=rewrite_identifiers(sql,names)
                remapped=LEGACY_AUTH_FK.sub('REFERENCES auth.users(id)',remapped) # already projected? applied before or after
                # rewrite_identifiers maps legacy references to canone_identity.account;
                # auth FK replacement occurs *after* namespace substitution.
                remapped=re.sub(r'(?i)\bREFERENCES\s+canone_identity\s*\.\s*account\s*\(\s*id\s*\)',
                                'REFERENCES auth.users(id)',remapped)
                if re.search(r'(?i)\bREFERENCES\s+canone_identity\s*\.\s*(?:session|magic_link)\b',remapped):
                    raise ValueError('Reference to managed auth session/link: '+legacy)
                if re.search(r'(?i)\bREFERENCES\s+identity\s*\.',remapped):
                    raise ValueError('Unconverted identity FK in '+legacy)
                # original source may use citext extension; identity's email is now Auth-managed.
                candidates.append((legacy,dest,filename,line,remapped))
                source_references+=len(re.findall(r'(?i)REFERENCES\s+auth\.users\s*\(',remapped))
                ordered.append({'source':legacy,'target':dest,'strategy':'generated_candidate','migration':filename,'line':line,'ddl_sha256':sha(remapped.encode())})
            else:
                # Preserve a review inventory per non-table SQL command: none silently disappear.
                if re.match(r'(?is)^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|COMMENT|DO|SET)\b',sql):
                    typ=' '.join(re.findall(r'[A-Za-z_]+',sql[:60])[:3]).upper()
                    other_types[typ]=other_types.get(typ,0)+1
        ignored.append({'migration':filename,'other_statements_by_prefix':other_types,
                        'other_statement_count':sum(other_types.values()),
                        'conversion_scope':'table_definitions_only; see sequel phases'})
    if len(ordered)!=90 or len(candidates)!=82:
        raise ValueError(f'Table accounting drift: counted {len(ordered)}, generated {len(candidates)} (expected 90/82)')
    if len(set(x[0] for x in candidates))!=82:raise ValueError('Duplicate generated table')
    expected={x['source_table']:x for x in crosswalk['table_crosswalk']}
    if set(expected)!=set(x['source'] for x in ordered):raise ValueError('Crosswalk/catalog parity failure')
    # All tables are created with no client grants. Their policies will be added by
    # subsequent domain-specific migrations, NOT auto-generated from legacy FOR ALL.
    header=[
        '-- CÂNONE S22 to Supabase: 82 domain table CREATE statements, v0.23.0-alpha.4',
        '-- GENERATED CANDIDATE ONLY. NOT A DEPLOYABLE MIGRATION. NO SEEDS, NO GRANTS.',
        '-- Requires separate dedicated Supabase database, existing managed auth.users,',
        '-- and 001_identity_and_source_bridge pilot. Original S22 files unchanged.',
        '-- Only inline CREATE TABLE constraints preserved; out-of-line ALTER,',
        '-- indexes, triggers, functions, policies and seed SQL REQUIRE separate conversion.',
        'BEGIN;', 'SET LOCAL search_path = pg_catalog;',
        "DO $canone_conversion_guard$ BEGIN IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN RAISE EXCEPTION 'REFUSE_SHARED_CANONE_SOURCE'; END IF; IF to_regclass('auth.users') IS NULL OR to_regclass('canone_identity.user_profile') IS NULL THEN RAISE EXCEPTION 'REQUIRE_CANONE_AUTH_PILOT'; END IF; END $canone_conversion_guard$;",
    ]
    for schema in names.values():
        header.extend([f'CREATE SCHEMA IF NOT EXISTS {schema};',f'REVOKE ALL ON SCHEMA {schema} FROM PUBLIC;'])
    blocks=[]
    for old,dest,filename,line,sql in candidates:
        blocks.append(f'-- Source: {filename}:{line} {old} => {dest}\n'+sql.strip()+'\n')
    footer=['-- Deny-by-default. Future policies require authorization tests.']
    for old,dest,_,_,_ in candidates:
        footer.extend([f'REVOKE ALL ON TABLE {dest} FROM PUBLIC, anon, authenticated;',
                      f'ALTER TABLE {dest} ENABLE ROW LEVEL SECURITY;',
                      f'ALTER TABLE {dest} FORCE ROW LEVEL SECURITY;'])
    footer+=['COMMIT;','']
    code='\n'.join(header)+'\n\n'+'\n'.join(blocks)+'\n'+'\n'.join(footer)
    manifest={'version':VERSION,'status':'CANDIDATE_TABLE_DDL_NOT_FULL_MIGRATION','source_migrations':originals,
        'crosswalk_version':crosswalk['version'],'table_total':90,'managed_auth_tables':3,
        'pilot_owned_existing_tables':5,'generated_table_count':len(candidates),
        'canonical_domain_tables_accounted':87,'pilot_additional_tables':2,
        'auth_fk_in_generated_statements':source_references,
        'generated_sql_sha256':sha(code.encode()),
        'generated':ordered,'not_converted':ignored,
        'assumptions':['auth.users managed by separate Supabase project','001 pilot must run first',
            'This is DDL only: out-of-line FKs and indexes are NOT yet converted',
            'No unrestricted access, no copied content or foreign DB data',
            'Function and trigger migrations, RLS policies and grants require dedicated conversion and testing'],
        'changes_to_remote_supabase':False,'release_gate':'NO_GO'}
    return code,manifest


def main(argv=None):
    p=argparse.ArgumentParser();p.add_argument('--root',default='.',type=Path)
    mode=p.add_mutually_exclusive_group(required=True);mode.add_argument('--write',action='store_true');mode.add_argument('--check',action='store_true')
    args=p.parse_args(argv);root=args.root.resolve()
    try:
        sql,manifest=build(root);targets=[(OUT_SQL,sql),(OUT_MANIFEST,json.dumps(manifest,ensure_ascii=False,sort_keys=True,indent=2)+'\n')]
        for relative,content in targets:
            path=root/relative
            if args.write:
                path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf-8')
            elif not path.exists() or path.read_text(encoding='utf-8')!=content:raise ValueError('Generated drift '+str(relative))
        print(json.dumps({'status':'PASS_CANONE_CONVERSION_DDL','source_tables':90,'generated_tables':82,'pilot_owned':5,'auth_managed':3,'auth_fk_in_generated':manifest['auth_fk_in_generated_statements'],'mode':'WRITE' if args.write else 'CHECK','remote_db_unchanged':True},ensure_ascii=False))
        return 0
    except Exception as e:
        print('CANONE_CONVERSION_FAIL:',str(e),file=sys.stderr);return 6
if __name__=='__main__':sys.exit(main())
