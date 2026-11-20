-- S13 DISPOSABLE TEST ASSERTIONS ONLY; must never run on operational DB.
DO $s13_assert$
DECLARE n integer; bad integer;
BEGIN
  IF current_database() <> 'canone_s13_disposable' OR to_regclass('s13_sentinel.disposable_marker') IS NULL THEN
    RAISE EXCEPTION 'S13_HOLD: external database';
  END IF;
  SELECT count(*) INTO n FROM foreign_sentinel.untouched WHERE marker='untouched';
  IF n <> 1 THEN RAISE EXCEPTION 'S13_FAIL: external schema sentinel changed'; END IF;
  SELECT count(*) INTO bad FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
   WHERE s.nspname IN ('canone_identity','canone_editorial','canone_taxonomy','canone_norms',
                      'canone_learning','canone_commerce','canone_admin','canone_ops','canone_audit')
     AND c.relkind IN ('r','p') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
  IF bad <> 0 THEN RAISE EXCEPTION 'S13_FAIL: % operational tables without ENABLE+FORCE RLS',bad; END IF;
  SELECT count(*) INTO bad FROM pg_namespace s WHERE s.nspname LIKE 'canone_%'
     AND (has_schema_privilege('anon',s.oid,'USAGE') OR
          has_schema_privilege('authenticated',s.oid,'USAGE') OR
          has_schema_privilege('service_role',s.oid,'USAGE'));
  IF bad <> 0 THEN RAISE EXCEPTION 'S13_FAIL: % canonical schemas exposed to Supabase roles',bad; END IF;
  IF has_table_privilege('canone_staff','canone_admin.support_access_grant','INSERT') OR
     has_table_privilege('canone_staff','canone_admin.support_access_grant','UPDATE') OR
     has_table_privilege('canone_staff','canone_admin.support_access_grant','DELETE') THEN
    RAISE EXCEPTION 'S13_FAIL: support role may modify access grants';
  END IF;
  SELECT count(*) INTO bad
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) x
   WHERE p.oid IN ('canone_learning.grade_answer(uuid,text)'::regprocedure,
                   'canone_admin.read_user_progress_as(uuid,uuid,uuid)'::regprocedure)
     AND x.grantee=0 AND x.privilege_type='EXECUTE';
  IF bad <> 0 THEN RAISE EXCEPTION 'S13_FAIL: privileged functions exposed to PUBLIC'; END IF;
  SELECT count(*) INTO bad FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
     JOIN pg_namespace s ON s.oid=p.pronamespace
   WHERE s.nspname LIKE 'canone_%' AND p.prosecdef
     AND (r.rolsuper OR r.rolbypassrls);
  IF bad <> 0 THEN RAISE EXCEPTION 'S13_FAIL: % security definer functions owned by privileged role',bad; END IF;
  SELECT count(*) INTO bad FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
   WHERE s.nspname LIKE 'canone_%' AND p.prosecdef
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) x WHERE x LIKE 'search_path=%');
  IF bad <> 0 THEN RAISE EXCEPTION 'S13_FAIL: % definer functions lack pinned search_path',bad; END IF;
END $s13_assert$;
-- Fail closed even if all structural assertions pass: per-user RLS E2E, backend session
-- binding, concurrency, restore and legal sign-off are independent, mandatory gates.
