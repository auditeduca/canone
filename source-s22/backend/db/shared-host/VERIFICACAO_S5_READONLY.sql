-- Apenas leitura: use no projeto pgsybzggewhinaniybiy.
-- Não inclui informações pessoais nem altera tables das demais aplicações.
SELECT nspname, has_schema_privilege('anon',oid,'USAGE') AS anon_usage,
       has_schema_privilege('authenticated',oid,'USAGE') AS authenticated_usage,
       has_schema_privilege('service_role',oid,'USAGE') AS service_role_usage
FROM pg_namespace WHERE left(nspname,7)='canone_' ORDER BY nspname;

SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced,
       has_table_privilege('anon',oid,'SELECT') AS anon_select,
       has_table_privilege('authenticated',oid,'SELECT') AS authenticated_select,
       has_table_privilege('service_role',oid,'SELECT') AS service_role_select
FROM pg_class WHERE relnamespace='canone_control'::regnamespace AND relkind='r' ORDER BY relname;

SELECT (SELECT count(*) FROM canone_control.schema_map) AS canone_schemas,
       (SELECT count(*) FROM canone_control.migration_catalog) AS migrations_registered,
       (SELECT count(*) FROM canone_control.migration_catalog WHERE status='NOT_APPLIED') AS migrations_not_applied,
       (SELECT count(*) FROM canone_control.release_gate WHERE status IN ('NO_GO','HOLD_HUMAN','HOLD_SOURCE','HOLD_DEPENDENCY')) AS blocking_gates,
       (SELECT count(*) FROM canone_control.external_source_binding WHERE access_mode='READ_ONLY_NOT_CONNECTED') AS source_bindings_not_connected;

SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='contabilidade_cfc') AS cfc_tables,
       (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS global_public_tables,
       (SELECT md5(string_agg(n.nspname||'.'||c.relname||':'||c.relkind::text,'|' ORDER BY n.nspname,c.relname,c.relkind))
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
          AND left(n.nspname,7)<>'canone_' AND c.relkind IN ('r','p','v','m','f')) AS external_structure_md5;
