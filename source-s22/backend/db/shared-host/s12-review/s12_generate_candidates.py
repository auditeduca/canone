#!/usr/bin/env python3
"""Cânone S12: proposições de revisão, NUNCA migrations de produção.

Falha em divergência de origem S11. Não utiliza rede, não chama banco,
não substitui arquivos originais; gera apenas .sql.txt em diretório temporário.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import difflib
import sys

OUT_NAMES = {6:'learning_items',7:'learning_srs',8:'commerce',9:'admin_governance',10:'ops_platform',
             11:'triggers_integridade',12:'srs_engine',13:'views',14:'rls',17:'privileges'}
PORT_OLD = ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops',
            'audit','public','subscriber','evidence','bridge','control')
DOMAINS = {a:'canone_'+a for a in PORT_OLD}
Q_RE = re.compile(r'\b('+'|'.join(PORT_OLD)+r')\s*(?=\.)')
DOLLAR_RE = re.compile(r'(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)(.*?)\1', re.S)
OLD_REF = re.compile(r'(?<![\w])('+'|'.join(PORT_OLD)+r')\s*\.\s*[a-zA-Z_][\w]*')

def sha(text): return hashlib.sha256(text.encode('utf8')).hexdigest()
def chk(cond,msg):
    if not cond: raise RuntimeError('S12_HOLD: '+msg)
def replace_once(src, needle, value, why):
    n=src.count(needle)
    chk(n==1, f'{why} expected unique anchor, got {n}')
    return src.replace(needle,value,1)

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--source',required=True,help='S11 extracted application root')
    p.add_argument('--output',required=True,help='S12 output folder (must be different from source)')
    args=p.parse_args(argv)
    root=Path(args.source).resolve(); dst=Path(args.output).resolve()
    chk(root.is_dir() and dst!=root and (root not in dst.parents or dst == root/'backend/db/shared-host/s12-review'), 'bad source/output isolation')
    mig=root/'backend/db/migrations'
    gen=root/'backend/db/shared-host/generated/s11-review-only'
    manifest=json.loads((root/'backend/db/shared-host/S5_NAMESPACE_MANIFEST.json').read_text())
    chk(len(manifest['original_migrations'])==30,'S11 30 source manifest missing')
    chk(set(DOMAINS)=={s['old'] for s in manifest['schemas']},'S11 namespace map changed')
    chk(all(DOMAINS[s['old']]==s['new'] for s in manifest['schemas']),'S11 namespace mapping unexpected')
    chk((root/'backend/db/shared-host/s11-review-all.mjs').exists(),'S11 authority missing')
    expected={item['file']:item['sha256'] for item in manifest['original_migrations']}
    for file,h in expected.items():
        chk(sha((mig/file).read_text())==h,'source changed '+file)
    dst.mkdir(parents=True,exist_ok=True)
    (dst/'reviews').mkdir(exist_ok=True)
    (dst/'diffs').mkdir(exist_ok=True)
    report={'version':'S12-REVIEW-ONLY-2026-11-14','baseline_commit':'716e01fd6c3619e336c1d7b2494f19355b951c29',
            'production_gate':'HOLD_HUMAN_NO_GO','live_executable_count':0,
            'generator':'s12_generate_candidates.py','items':[],'source_migrations_modified':0,
            'limitations':['Not validated in real PostgreSQL or PGlite','SQL text projection does not prove PL/pgSQL semantics',
                           '006 grade-answer enumeration/oracle still requires API-level hardening',
                           'RLS identity GUC must be bound to trustworthy server session',
                           '001 bootstrap, 015-030 dependencies and role ownership not homologated',
                           'Any material changes to granting support access require human product/legal review']}
    for number,stem in OUT_NAMES.items():
        filename=f'{number:03d}_{stem}.sql'
        original=(mig/filename).read_text()
        reviewfile=gen/f'REVIEW_ONLY_{filename}.txt'
        prior=reviewfile.read_text()
        # The source remains authoritative. S11 candidate is authoritative for the lexical projection.
        chk(f'Original sha256: {sha(original)}' in prior,'S11 provenance header mismatch '+filename)
        header,sep,sql=prior.partition('\n\n')
        chk(bool(sep) and 'GENERATED FOR AUDIT ONLY' in header,'review-only source absent '+filename)
        # The 2nd S11 header paragraph precedes the projected SQL.
        start=sql.find('-- Qualified schema name projection')
        if start<0: start=sql.find('-- Original bootstrap')
        chk(start>=0,'review marker missing '+filename)
        projected=sql[sql.find('\n\n',start)+2:]
        # SQL lexical transformation in S11 intentionally excludes dollar blocks.
        # Here we propose a second pass on exact unported schema-qualified tokens in dollar blocks.
        body_count=[0]
        def in_dollar(m):
            body_count[0]+=1
            return m.group(1)+Q_RE.sub(lambda x:DOMAINS[x.group(1)],m.group(2))+m.group(1)
        candidate=DOLLAR_RE.sub(in_dollar, projected)
        interventions=[]
        if number==6:
            candidate=replace_once(candidate,'SECURITY DEFINER\nSTABLE AS $$',
                'SECURITY DEFINER\nSET search_path = pg_catalog, canone_learning, pg_temp\nSTABLE AS $$',
                'grade definer search path')
            candidate=replace_once(candidate,
                "$$;\nCOMMENT ON FUNCTION canone_learning.grade_answer(uuid, text)",
                "$$;\nREVOKE ALL ON FUNCTION canone_learning.grade_answer(uuid, text) FROM PUBLIC;\nCOMMENT ON FUNCTION canone_learning.grade_answer(uuid, text)",
                'revoke grade public')
            interventions+=['Grade definer search_path','Grade EXECUTE PUBLIC revoked']
        elif number==9:
            candidate=replace_once(candidate,
                'BEGIN\n  SELECT row_hash INTO v_prev FROM canone_audit.audit_log ORDER BY seq DESC LIMIT 1;',
                'BEGIN\n  -- Serializa escritoras em READ COMMITTED; isolamento superior depende de ensaio concorrente.\n'
                "  PERFORM pg_catalog.pg_advisory_xact_lock(93112026);\n"
                '  SELECT row_hash INTO v_prev FROM canone_audit.audit_log ORDER BY seq DESC LIMIT 1;',
                'audit concurrent lock')
            interventions+=['Audit log single-writer advisory transaction lock candidate']
        elif number==11:
            # Exact source-derived list: a string is used as a schema-qualified identifier.
            for old in ('identity.account','identity.user_profile','editorial.content_item',
                        'editorial.verification','learning.item','learning.user_item_state',
                        'learning.mastery','learning.note','commerce.plan','commerce.subscription',
                        'ops.setting','ops.integration','ops.webhook'):
                chk(("'canone_"+old+"'") in candidate, '011 dynamic table list not ported '+old)
            chk('FUNCTION canone_ops.touch_updated_at()' in candidate,'011 dynamic function not portable')
            interventions+=['13 dynamic trigger table names projected','Dynamic trigger function namespace projected']
        elif number==13:
            candidate=replace_once(candidate,
                'CREATE OR REPLACE VIEW canone_subscriber.v_my_progress AS',
                'CREATE OR REPLACE VIEW canone_subscriber.v_my_progress WITH (security_invoker = true) AS',
                'my_progress invoker view')
            candidate=replace_once(candidate,
                '  JOIN canone_taxonomy.subject sub ON sub.id = s.subject_id;\n\nCOMMENT ON VIEW canone_subscriber.v_my_progress',
                '  JOIN canone_taxonomy.subject sub ON sub.id = s.subject_id\n'
                ' WHERE s.user_id = canone_ops.current_user_id();\n\nCOMMENT ON VIEW canone_subscriber.v_my_progress',
                'my_progress tenant predicate')
            interventions+=['Subscriber progress invoker view','Explicit row-owner predicate']
        elif number==14:
            source_list="'identity','editorial','taxonomy','norms','learning','commerce','admin','ops'"
            new_list=','.join("'canone_"+x+"'" for x in ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit'))
            candidate=replace_once(candidate,source_list,new_list,'014 enable-force RLS allowlist')
            candidate=replace_once(candidate,
                'CREATE POLICY staff_read_grant ON canone_admin.support_access_grant FOR ALL TO canone_staff\n  USING (true) WITH CHECK (true);\nCREATE POLICY staff_insert_grant ON canone_admin.support_access_grant FOR INSERT TO canone_staff\n  WITH CHECK (staff_user_id = canone_ops.current_user_id());',
                'CREATE POLICY staff_read_grant ON canone_admin.support_access_grant FOR SELECT TO canone_staff\n'
                '  USING (staff_user_id = canone_ops.current_user_id());\n'
                '-- Staff nao emite nem altera grants: dependencia de fluxo de aprovacao humana.',
                '014 staff self grant')
            candidate=replace_once(candidate,
                "USING (NOT is_secret OR scope IN ('staff','global'));",
                "USING (NOT is_secret AND scope IN ('staff','global'));",
                '014 staff secret exposure')
            candidate=replace_once(candidate,
                'CREATE POLICY staff_insert_audit ON canone_audit.audit_log FOR INSERT TO canone_staff\n  WITH CHECK (actor_id = canone_ops.current_user_id() OR actor_id IS NULL);',
                'CREATE POLICY staff_insert_audit ON canone_audit.audit_log FOR INSERT TO canone_staff\n'
                '  WITH CHECK (actor_id = canone_ops.current_user_id() OR actor_id IS NULL);\n'
                'CREATE POLICY admin_insert_audit ON canone_audit.audit_log FOR INSERT TO canone_admin\n'
                '  WITH CHECK (actor_id = canone_ops.current_user_id() OR actor_id IS NULL);',
                '014 audit admin insert')
            candidate=replace_once(candidate,
                'LANGUAGE plpgsql SECURITY DEFINER AS $$',
                'LANGUAGE plpgsql SECURITY DEFINER\n'
                'SET search_path = pg_catalog, canone_admin, canone_learning, canone_taxonomy, pg_temp AS $$',
                '014 support definer search_path')
            candidate=replace_once(candidate,
                "  IF v_grant.staff_user_id <> p_staff_user_id THEN",
                "  IF p_staff_user_id IS DISTINCT FROM canone_ops.current_user_id()\n"
                "     OR canone_ops.current_area() NOT IN ('staff','admin') THEN\n"
                "    RAISE EXCEPTION 'Identidade de suporte nao vinculada a sessao' USING ERRCODE = '42501';\n"
                "  END IF;\n\n  IF v_grant.staff_user_id <> p_staff_user_id THEN",
                '014 support session match')
            candidate=replace_once(candidate,
                "END $$;\n\nCOMMENT ON FUNCTION canone_admin.read_user_progress_as IS",
                "END $$;\nREVOKE ALL ON FUNCTION canone_admin.read_user_progress_as(uuid, uuid, uuid) FROM PUBLIC;\n\n"
                "COMMENT ON FUNCTION canone_admin.read_user_progress_as IS",
                '014 support function revoke')
            interventions+=['Allowlisted 9 canonical RLS schemas including audit','Staff self-grant policy removed',
                            'Staff secret policy narrowed','Admin audit insert policy added',
                            'Support definer search_path and EXECUTE revoked from PUBLIC',
                            'Support identity matched with server session GUC (requires trust-boundary tests)']
        elif number==17:
            candidate=replace_once(candidate,
                'GRANT USAGE ON SCHEMA public, subscriber, taxonomy, editorial, norms, learning, commerce, admin, ops, audit',
                'GRANT USAGE ON SCHEMA canone_public, canone_subscriber, canone_taxonomy, canone_editorial, canone_norms, canone_learning, canone_commerce, canone_admin, canone_ops, canone_audit',
                '017 canonical schema USAGE')
            candidate=replace_once(candidate,'REVOKE ALL ON SCHEMA public FROM PUBLIC;',
                '-- Forbidden: no mutation to shared PostgreSQL public schema.',
                '017 global public REVOKE')
            candidate=replace_once(candidate,
                '  canone_editorial.content_revision,\n  canone_admin.support_access_grant, canone_admin.moderation_queue, canone_admin.user_note, canone_admin.feature_flag,',
                '  canone_editorial.content_revision,\n  canone_admin.moderation_queue, canone_admin.user_note, canone_admin.feature_flag,',
                '017 staff support grant write')
            candidate=replace_once(candidate,
                'GRANT SELECT ON canone_subscriber.v_my_progress, canone_subscriber.v_my_due, canone_subscriber.v_my_history, canone_subscriber.v_my_state',
                'GRANT SELECT ON canone_taxonomy.subject TO canone_subscriber;\n'
                'GRANT SELECT ON canone_subscriber.v_my_progress, canone_subscriber.v_my_due, canone_subscriber.v_my_history, canone_subscriber.v_my_state',
                '017 invoker dependency')
            target_view='canone_admin.v_content_health, canone_admin.v_user_overview, canone_admin.v_user_mastery,'
            chk(candidate.count(target_view)==2,'017 expected 2 view grants')
            candidate=candidate.replace(target_view,
                      'canone_admin.v_content_health, canone_admin.v_user_overview,')
            candidate += ('\n-- Conservative lockdown: no unmediated read of per-user mastery view.\n'
                          'REVOKE ALL ON canone_admin.v_user_mastery FROM PUBLIC, canone_staff, canone_admin;\n'
                          'REVOKE INSERT, UPDATE, DELETE ON canone_admin.support_access_grant FROM canone_staff;\n')
            interventions+=['Global public REVOKE removed','Staff support grant writes removed',
                            'Subscriber taxonomy dependency granted','Direct staff/admin mastery view grants removed']
        # Detect only canonical schema-qualified references in blocks (but avoid false positive comments). 
        # Original text in explanatory comments may contain old schema references; SQL code and string literal verification is tracked separately.
        for block in DOLLAR_RE.finditer(candidate):
            body=block.group(2)
            residue=[m.group(0) for m in OLD_REF.finditer(body)]
            # comments and RAISE strings can contain documentation; these are accepted only if reported.
            if residue:
                report.setdefault('residual_examples',[]).append({'file':filename,'examples':residue[:5]})
        marker=(f'-- S12 CANDIDATE FOR HUMAN REVIEW ONLY - NEVER EXECUTE AGAINST SHARED DATABASE.\n'
                f'-- Source: {filename} SHA256 {sha(original)}\n'
                f'-- S11 lexical preview SHA256 {sha(prior)}\n'
                '-- Incomplete until ownership, role, view, RLS and PostgreSQL integration gates PASS.\n'
                '-- NON-EXECUTABLE DELIVERABLE: .sql.txt review artifact.\n\n')
        output=marker+candidate
        output_name=f'S12_REVIEW_ONLY_{filename}.txt'
        (dst/'reviews'/output_name).write_text(output)
        diff=''.join(difflib.unified_diff(projected.splitlines(True),candidate.splitlines(True),
                                fromfile=f'S11/{filename}',tofile=f'S12/{filename}',n=3))
        (dst/'diffs'/f'{filename}.diff').write_text(diff)
        report['items'].append({'migration':number,'file':filename,'source_sha256':sha(original),
                                's11_preview_sha256':sha(prior),'s12_candidate_sha256':sha(output),
                                'dollar_blocks_scanned':body_count[0],'interventions':interventions,
                                'status':'PROPOSED_HOLD_NOT_EXECUTABLE'})
    (dst/'S12_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('S12_GENERATED_REVIEW_ONLY',len(report['items']),'items',sum(len(i['interventions']) for i in report['items']),'interventions')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('S12_GEN_FAIL:',str(exc),file=sys.stderr)
        sys.exit(5)
