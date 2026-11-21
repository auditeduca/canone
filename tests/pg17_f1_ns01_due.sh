#!/usr/bin/env bash
set -euo pipefail
test "$GITHUB_ACTIONS" = true
test "$CANONE_CI_PG17_ONLY" = yes
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ ]] || { echo REFUSE_INVALID_PG_CONTAINER;exit 2; }
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY CANONE_PG_DSN CANONE_SUPABASE_URL; do
 [[ -z "$(printenv "$key" || :)" ]] || { echo REFUSE_REMOTE_DB_SECRET;exit 2; }
done
pg(){ docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -qAt -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1; }
db(){ docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -qAt -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 -c "$1"; }
pg < tests/sql/f1_ns01_due_private_ephemeral.sql
for role in authenticated anon;do
 if db "SET ROLE $role; SELECT * FROM canone_ops.srs_due_private_ci();" >/tmp/canone-f1-ns01-denial 2>&1;then
  echo "FAIL_BROWSER_SQL_EXECUTE_EXPOSED_$role";exit 1
 fi
 grep -q 'permission denied' /tmp/canone-f1-ns01-denial || { cat /tmp/canone-f1-ns01-denial;exit 1; }
done
rm -f /tmp/canone-f1-ns01-denial
pg < tests/sql/f1_ns01_due_owner_tests_ephemeral.sql
[[ "$(db "SELECT count(*) FROM auth.users WHERE id IN ('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777');")" == 0 ]] ||
 { echo FAIL_TEST_FIXTURE_PERSISTED;exit 1; }
echo PASS_F1_NS01_SRS_DUE_CANDIDATE two_users=isolated browser=denied entitlement=revoked limit=bounded
