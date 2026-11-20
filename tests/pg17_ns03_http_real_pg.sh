#!/usr/bin/env bash
# NS-03: exact gateway HTTP path against PostgreSQL 17 in ephemeral GH Actions.
set -euo pipefail
: "${CANONE_CI_PG17_CONTAINER:?Required ephemeral GitHub Actions service id}"
: "${CANONE_CI_PG17_PORT:?Required dynamically mapped localhost port}"
[[ "${GITHUB_ACTIONS:-}" == true && "${CANONE_CI_PG17_ONLY:-}" == yes && "${CANONE_SYNTHETIC_TEST_ONLY:-}" == 1 ]] || {
  echo REFUSE_NS03_NON_CI;exit 2;
}
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ && "$CANONE_CI_PG17_PORT" =~ ^[0-9]{4,5}$ ]] || {
  echo REFUSE_NS03_INVALID_EPHEMERAL_TARGET;exit 2;
}
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY CANONE_PG_DSN CANONE_SUPABASE_URL; do
  [[ -z "${!key:-}" ]] || { echo "REFUSE_NS03_REAL_DB_ENV_$key"; exit 2; }
done
run() { docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -qAt -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 -c "$1"; }
# Role does not own objects, does not bypass RLS, and can only SET ROLE service_role.
run "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='canone_gateway_ci') THEN CREATE ROLE canone_gateway_ci LOGIN PASSWORD 'canone_ci_ephemeral_only' NOINHERIT; END IF; END \$\$; GRANT service_role TO canone_gateway_ci;" >/dev/null
run "INSERT INTO auth.users(id) VALUES('22222222-2222-4222-8222-222222222222') ON CONFLICT DO NOTHING;" >/dev/null
run "INSERT INTO canone_commerce.entitlement(user_id,feature_key,source,expires_at)
 VALUES ('22222222-2222-4222-8222-222222222222','cfc.exam','admin',now()+interval '2 day');" >/dev/null
# alpha9 entitlement tests deliberately ended with cancelled subscription for A.
run "UPDATE canone_commerce.subscription SET status='ativa',trial_ends_at=NULL,
 current_period_start=now()-interval '1 day',current_period_end=now()+interval '15 days'
 WHERE user_id='11111111-1111-4111-8111-111111111111';" >/dev/null
# The pinned historical backend lockfile is used; never npm install an unpinned pg version.
npm ci --prefix source-s22/backend --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null
node --check tests/ns03_http_pg17.test.mjs
node --test tests/ns03_http_pg17.test.mjs
echo PASS_NS03_HTTP_AUTH_MOCK_TO_REAL_PG17
