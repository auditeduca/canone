#!/usr/bin/env bash
set -euo pipefail
test "$GITHUB_ACTIONS" = true
test "$CANONE_CI_PG17_ONLY" = yes
test "$CANONE_SYNTHETIC_TEST_ONLY" = 1
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ ]]
[[ "$CANONE_CI_PG17_PORT" =~ ^[0-9]{4,5}$ ]]
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY CANONE_PG_DSN CANONE_SUPABASE_URL; do
  [[ -z "$(printenv "$key" || :)" ]] || { echo REFUSE_MANAGED_DB;exit 2; }
done
db() { docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -qAt -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 -c "$1"; }
db "INSERT INTO auth.users(id) VALUES
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444'),
 ('55555555-5555-4555-8555-555555555555') ON CONFLICT DO NOTHING;" >/dev/null
db "INSERT INTO canone_commerce.entitlement(user_id,feature_key,source,expires_at)
 VALUES ('33333333-3333-4333-8333-333333333333','cfc.exam','admin',now()+interval '2 day'),
 ('44444444-4444-4444-8444-444444444444','cfc.exam','admin',now()+interval '2 day');" >/dev/null
export CANONE_CI_P0_TOKEN_FILE
CANONE_CI_P0_TOKEN_FILE="$(mktemp /tmp/canone-p0-token-XXXXXXXX)"
node tests/f3_pg17_real_server.mjs > /tmp/canone-f3-pg17-node.log 2>&1 &
pid=$!
cleanup(){
  kill "$pid" 2>/dev/null || :
  wait "$pid" 2>/dev/null || :
  rm -f "$CANONE_CI_P0_TOKEN_FILE" /tmp/canone-f3-pg17-node.log
}
trap cleanup EXIT
for i in $(seq 1 60); do
  [[ -s "$CANONE_CI_P0_TOKEN_FILE" ]] && break
  kill -0 "$pid" 2>/dev/null || { cat /tmp/canone-f3-pg17-node.log;exit 1; }
  sleep .2
done
[[ -s "$CANONE_CI_P0_TOKEN_FILE" ]] || { echo FAIL_SERVER_NOT_READY;exit 1; }
/tmp/canone-f3-py/bin/python tests/f3_pg17_real_browser.py
[[ "$(db "SELECT count(*) FROM canone_learning.exam_attempt WHERE user_id='33333333-3333-4333-8333-333333333333' AND finished_at IS NOT NULL;")" -ge 1 ]]
[[ "$(db "SELECT count(*) FROM canone_learning.exam_review_receipt r JOIN canone_learning.exam_attempt a ON a.id=r.attempt_id WHERE a.user_id='33333333-3333-4333-8333-333333333333';")" -ge 1 ]]
echo PASS_F3_REAL_BROWSER_PG17
