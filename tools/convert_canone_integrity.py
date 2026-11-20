#!/usr/bin/env python3
"""Versioned, manually reviewed whitelist for S22 integrity functions/triggers.

No DB/network writes. Deliberately does not blind-transpile SECURITY DEFINER or
high-privilege procedure bodies; all SQL is non-deployable staging candidate.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path

VERSION = '0.23.0-alpha.6'
SQL_PATH = Path('staging/supabase/007_integrity_triggers.candidate.sql.txt')
MANIFEST_PATH = Path('staging/supabase/CANONE_INTEGRITY_ALPHA6_MANIFEST.json')
BEHAVIOUR_PATH = Path('staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json')
FILES = ['001_identity_and_source_bridge.candidate.sql.txt','002_domain_tables_82.candidate.sql.txt',
         '003_indexes_constraints.candidate.sql.txt','004_invoker_views.candidate.sql.txt',
         '005_owner_policies.candidate.sql.txt','006_auth_user_id_compat.candidate.sql.txt']
HASH = lambda b: hashlib.sha256(b).hexdigest()
WHITELIST = {
    'learning.review_event_is_immutable':'review_event_append_only',
    'audit.forbid_mutation':'audit_log_append_only',
    'learning.answer_key_definitivo_imutavel':'definitive_key_entries_lock',
    'learning.answer_key_status_imutavel':'definitive_key_header_lock',
    'learning.prova_selada_nao_muda':'sealed_form_rows_lock',
    'learning.exam_count_imutavel_apos_selo':'sealed_exam_question_count',
    'ops.touch_updated_at':'update_timestamp_only',
}
TOUCH = (
 'canone_identity.user_profile','canone_editorial.content_item',
 'canone_editorial.verification','canone_learning.item',
 'canone_learning.user_item_state','canone_learning.mastery',
 'canone_learning.note','canone_commerce.plan',
 'canone_commerce.subscription','canone_ops.setting',
 'canone_ops.integration','canone_ops.webhook',
)

def wrapped(name, body):
    return (f'CREATE OR REPLACE FUNCTION {name}() RETURNS trigger\n'
            'LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog AS $fn$\n'
            + body.strip() + '\n$fn$;\n'
            + f'REVOKE ALL ON FUNCTION {name}() FROM PUBLIC, anon, authenticated;')

def build(root:Path):
    b=json.loads((root/BEHAVIOUR_PATH).read_text())
    if b.get('objects_by_category')!={'functions':58,'triggers':26,'views':18,'policies':80}:
        raise ValueError('original historical behaviour inventory drift')
    source_manifest=json.loads((root/'source-s22/backend/db/shared-host/S5_NAMESPACE_MANIFEST.json').read_text())
    for x in source_manifest['original_migrations']:
        raw=(root/'source-s22/backend/db/migrations'/x['file']).read_bytes()
        if HASH(raw)!=x['sha256']:raise ValueError('tampered source '+x['file'])
    source={}; duplicates={}
    for x in b['objects']['functions']:
        if x['name'] in WHITELIST:
            duplicates.setdefault(x['name'],[]).append(x)
    if set(duplicates)!=set(WHITELIST):raise ValueError('whitelist source not completely represented')
    # For duplicated names, choose most recent relevant source revision.
    for name,choices in duplicates.items():
        source[name]=choices[-1]
    # Must not accidentally copy source SECURITY DEFINER bodies.
    notes=['CÂNONE 007 integrity guards, candidate only; non-deployable; DO NOT RUN on shared DB',
      '7 reviewed trigger functions + 8 structural integrity triggers + 12 explicit timestamp triggers.',
      'SECURITY INVOKER, revoke execute from browser roles; no service-role bypass.',
      'Legal/editorial gates and full concurrency review are separate from SQL structural tests.']
    out=['-- '+x for x in notes]
    out += ['BEGIN;','SET LOCAL search_path = pg_catalog;',
      "DO $guard$ BEGIN IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN RAISE EXCEPTION 'REFUSE_SHARED_CANONE_SOURCE'; END IF; IF to_regclass('canone_learning.answer_key_entry') IS NULL OR to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'REQUIRE_ISOLATED_CANONE_PILOT'; END IF; END $guard$;"]
    fns=[]; trigs=[]
    def addfn(old,new,body):
        x=source[old]
        out.append(f"-- source {x['source']}:{x['line']} {old} SHA256 {x['sha256']} (reviewed replacement)")
        out.append(wrapped(new,body));fns.append({'legacy':old,'canonical':new,'source_file':x['source'],'source_line':x['line'],'source_sha256':x['sha256'],'security':'SECURITY_INVOKER_REVOKED_PUBLIC'})
    def addtrig(name,event,table,func,source):
        out.append(f'CREATE TRIGGER {name} {event} ON {table} FOR EACH ROW EXECUTE FUNCTION {func}();')
        trigs.append({'name':name,'table':table,'event':event,'handler':func,'source':source})
    addfn('learning.review_event_is_immutable','canone_learning.review_event_is_immutable', '''
BEGIN
  RAISE EXCEPTION 'review_event append-only: % not permitted', TG_OP USING ERRCODE='23514';
END;''')
    addfn('audit.forbid_mutation','canone_audit.forbid_mutation', '''
BEGIN
  RAISE EXCEPTION 'audit_log append-only: % not permitted', TG_OP USING ERRCODE='23514';
END;''')
    addfn('learning.answer_key_definitivo_imutavel','canone_learning.answer_key_definitivo_imutavel', '''
DECLARE v_status text;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO v_status FROM canone_learning.answer_key WHERE id=OLD.answer_key_id FOR SHARE;
    IF v_status='definitivo' AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN
      RAISE EXCEPTION 'definitive answer key entry cannot be modified or removed' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT status INTO v_status FROM canone_learning.answer_key WHERE id=NEW.answer_key_id FOR SHARE;
    IF v_status='definitivo' AND (TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD) THEN
      RAISE EXCEPTION 'definitive answer key entry cannot be inserted or reassigned' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;''')
    addfn('learning.answer_key_status_imutavel','canone_learning.answer_key_status_imutavel', '''
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='definitivo' THEN
      RAISE EXCEPTION 'definitive answer key cannot be deleted' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='definitivo' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'definitive answer key cannot be downgraded or edited' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;''')
    addfn('learning.prova_selada_nao_muda','canone_learning.prova_selada_nao_muda', '''
DECLARE v_sealed boolean;
BEGIN
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT EXISTS(SELECT 1 FROM canone_learning.answer_key
       WHERE exam_form_id=OLD.exam_form_id AND status='definitivo') INTO v_sealed;
    IF v_sealed THEN
      RAISE EXCEPTION 'sealed exam form entries cannot be changed' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT EXISTS(SELECT 1 FROM canone_learning.answer_key
       WHERE exam_form_id=NEW.exam_form_id AND status='definitivo') INTO v_sealed;
    IF v_sealed THEN
      RAISE EXCEPTION 'sealed exam form entries cannot be inserted or reassigned' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;''')
    addfn('learning.exam_count_imutavel_apos_selo','canone_learning.exam_count_imutavel_apos_selo', '''
DECLARE v_sealed boolean;
BEGIN
  IF NEW.question_count IS NOT DISTINCT FROM OLD.question_count THEN RETURN NEW; END IF;
  IF TG_TABLE_SCHEMA='canone_taxonomy' AND TG_TABLE_NAME='exam_track' THEN
    SELECT EXISTS(SELECT 1 FROM canone_learning.exam_form f
      JOIN canone_learning.answer_key k ON k.exam_form_id=f.id AND k.status='definitivo'
      WHERE f.exam_track_id=OLD.id) INTO v_sealed;
  ELSIF TG_TABLE_SCHEMA='canone_taxonomy' AND TG_TABLE_NAME='exam_edition' THEN
    SELECT EXISTS(SELECT 1 FROM canone_taxonomy.exam_track t
      JOIN canone_learning.exam_form f ON f.exam_track_id=t.id
      JOIN canone_learning.answer_key k ON k.exam_form_id=f.id AND k.status='definitivo'
      WHERE t.exam_edition_id=OLD.id AND t.track_code='suficiencia') INTO v_sealed;
  ELSE
    RAISE EXCEPTION 'unexpected table for sealed exam count guard' USING ERRCODE='23514';
  END IF;
  IF v_sealed THEN RAISE EXCEPTION 'cannot change question count after definitive seal' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;''')
    addfn('ops.touch_updated_at','canone_ops.touch_updated_at', '''
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;''')
    addtrig('trg_review_event_immutable','BEFORE UPDATE OR DELETE','canone_learning.review_event','canone_learning.review_event_is_immutable','007')
    addtrig('trg_audit_no_update','BEFORE UPDATE OR DELETE','canone_audit.audit_log','canone_audit.forbid_mutation','009')
    addtrig('trg_answer_key_entry_definitivo_imutavel','BEFORE INSERT OR UPDATE OR DELETE','canone_learning.answer_key_entry','canone_learning.answer_key_definitivo_imutavel','024')
    addtrig('trg_answer_key_status_imutavel','BEFORE UPDATE','canone_learning.answer_key','canone_learning.answer_key_status_imutavel','024')
    addtrig('trg_answer_key_definitivo_imutavel','BEFORE DELETE','canone_learning.answer_key','canone_learning.answer_key_status_imutavel','024')
    addtrig('trg_prova_selada_nao_muda','BEFORE INSERT OR UPDATE OR DELETE','canone_learning.exam_form_item','canone_learning.prova_selada_nao_muda','022')
    addtrig('trg_exam_track_count_imutavel','BEFORE UPDATE OF question_count','canone_taxonomy.exam_track','canone_learning.exam_count_imutavel_apos_selo','024')
    addtrig('trg_exam_edition_count_imutavel','BEFORE UPDATE OF question_count','canone_taxonomy.exam_edition','canone_learning.exam_count_imutavel_apos_selo','024')
    physical=((root/'staging/supabase/001_identity_and_source_bridge.candidate.sql.txt').read_text()+'\n'+(root/'staging/supabase/002_domain_tables_82.candidate.sql.txt').read_text())
    for table in TOUCH:
        pos=physical.find('CREATE TABLE '+table+' (')
        if pos<0:raise ValueError('unexpected missing table '+table)
        # use DDL segment only, not a cross-table match
        frag=physical[pos:].split('\n);',1)[0]
        if not re.search(r'(?m)^\s*updated_at\s+timestamptz\b',frag):
            raise ValueError('table lacks updated_at '+table)
        addtrig('trg_touch_'+table.replace('.','_'),'BEFORE UPDATE',table,'canone_ops.touch_updated_at','011_DYNAMIC_DO_REPLACEMENT')
    out.append('COMMIT;'); out.append('')
    sql='\n'.join(out)
    if len(fns)!=7 or len(trigs)!=20:raise ValueError('unexpected port count')
    for word in ('SECURITY DEFINER','SET ROLE','app.current_user_id','GRANT ALL','CREATE EXTENSION'):
        if word in sql.upper() if word in ('SECURITY DEFINER','SET ROLE','GRANT ALL','CREATE EXTENSION') else word in sql:
            # explanatory SQL comments can mention these only in generated header
            raise ValueError('unsafe generated SQL token '+word)
    input_hashes={p:HASH((root/'staging/supabase'/p).read_bytes()) for p in FILES}
    m={'version':VERSION,'status':'REVIEW_ONLY_NON_DEPLOYABLE','source_migrations_sha256_verified':30,
       'input_candidate_sha256':input_hashes,'functions':fns,'triggers':trigs,
       'functions_ported_this_batch':len(fns),'trigger_definitions_this_batch':len(trigs),
       'timestamp_trigger_definitions':len(TOUCH),'historical_create_trigger_statements':26,
       'historical_functions':58,'prior_auth_compat_function':1,
       'historical_functions_not_yet_ported':58-1-len(fns),
       'sql_sha256':HASH(sql.encode()),'release_gate':'NO_GO',
       'limitations':['No PG17 / managed Supabase Auth equivalence','No direct grants or production deployment',
         'No automatic migration of privileged functions','Sealed exam concurrency and grading completeness require further E2E review',
         'Audit insert hash-chaining function still unported; audit_log ingestion not operational']}
    return sql,m

def main():
    a=argparse.ArgumentParser();a.add_argument('--root',type=Path,default=Path('.'))
    group=a.add_mutually_exclusive_group(required=True);group.add_argument('--write',action='store_true');group.add_argument('--check',action='store_true')
    args=a.parse_args();root=args.root.resolve()
    try:
        s,m=build(root);targets=[(SQL_PATH,s),(MANIFEST_PATH,json.dumps(m,indent=2,ensure_ascii=False,sort_keys=True)+'\n')]
        for p,v in targets:
            target=root/p
            if args.write:target.parent.mkdir(parents=True,exist_ok=True);target.write_text(v,encoding='utf8')
            elif not target.exists() or target.read_text(encoding='utf8')!=v:raise ValueError('generated artifact drift: '+str(p))
        print(json.dumps({'status':'PASS_INTEGRITY_ALPHA6','functions':len(m['functions']),
             'triggers':len(m['triggers']),'remaining_function_statements':m['historical_functions_not_yet_ported'],
             'mode':'WRITE' if args.write else 'CHECK','remote_writes':0}))
        return 0
    except (OSError,ValueError,KeyError) as exc:print('FAIL_INTEGRITY_ALPHA6',str(exc),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
