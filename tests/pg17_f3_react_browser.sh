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
# 011 is a candidate applied ONLY to the ephemeral container after alpha9.
docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -q -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 < tests/sql/f3_rec05_private_reads_ephemeral.sql
# Exercise editorial/rights gate exclusively on the disposable PG17 service.
docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -q -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 < tests/sql/f3_rec06_question_delivery_ephemeral.sql
# REC07 -- only disposable PG17. No managed Supabase.
docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -q -U postgres -d canone_alpha7_ci -v ON_ERROR_STOP=1 < tests/sql/f3_rec07_rights_guard_ephemeral.sql
if db "SET ROLE authenticated; SELECT canone_ops.exam_questions_rec06_ci('00000000-0000-4000-8000-000000000004');" >/tmp/canone-rec07-old 2>&1; then
 echo UNGUARDED_FUNCTION_PUBLIC; exit 1
fi
grep -q 'permission denied' /tmp/canone-rec07-old || { cat /tmp/canone-rec07-old; exit 1; }
rm -f /tmp/canone-rec07-old
# Browser roles cannot call the question delivery SECURITY DEFINER function directly.
if db "SET ROLE authenticated; SELECT canone_ops.exam_questions('00000000-0000-4000-8000-000000000004');" >/tmp/canone-f3-question-denial 2>&1; then
  echo EXPOSED_QUESTION_FN_TO_BROWSER; exit 1
fi
grep -q 'permission denied' /tmp/canone-f3-question-denial || { cat /tmp/canone-f3-question-denial;exit 1; }
rm -f /tmp/canone-f3-question-denial
# Browser roles must never execute owner-scoped read functions.
if db "SET ROLE authenticated; SELECT * FROM canone_ops.exam_history();" >/tmp/canone-f3-reader-denial 2>&1; then
  echo EXPOSED_HISTORY_TO_BROWSER;exit 1
fi
grep -q 'permission denied' /tmp/canone-f3-reader-denial || { cat /tmp/canone-f3-reader-denial;exit 1; }
rm -f /tmp/canone-f3-reader-denial
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
# Kill and recreate the gateway process (in-memory HMAC keys rotate), retaining PG17.
old_token_hash="$(sha256sum "$CANONE_CI_P0_TOKEN_FILE" | cut -d' ' -f1)"
kill "$pid"
wait "$pid" 2>/dev/null || :
rm -f "$CANONE_CI_P0_TOKEN_FILE"
node tests/f3_pg17_real_server.mjs > /tmp/canone-f3-pg17-node.log 2>&1 &
pid=$!
for i in $(seq 1 60); do
  [[ -s "$CANONE_CI_P0_TOKEN_FILE" ]] && break
  kill -0 "$pid" 2>/dev/null || { cat /tmp/canone-f3-pg17-node.log;exit 1; }
  sleep .2
done
[[ -s "$CANONE_CI_P0_TOKEN_FILE" ]] || { echo FAIL_RESTART_SERVER;exit 1; }
new_token_hash="$(sha256sum "$CANONE_CI_P0_TOKEN_FILE" | cut -d' ' -f1)"
[[ "$old_token_hash" != "$new_token_hash" ]] || { echo UNROTATED_TEST_TOKEN;exit 1; }
/tmp/canone-f3-py/bin/python tests/f3_rec06_browser_restart.py normal
# Validate owner-only rights at both version- and decision-level.
rights_attempt() {
 db "BEGIN; SET LOCAL ROLE service_role;
 SELECT pg_catalog.set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 SELECT jsonb_array_length(canone_ops.exam_questions('00000000-0000-4000-8000-000000000004')->'questions'); COMMIT;"
}
rights_attempt | grep -qx '2' || { echo FAIL_BASELINE_RIGHTS; exit 1; }
expect_hold() {
 if rights_attempt >/tmp/canone-rec07-hold 2>&1; then echo RIGHTS_LEAK;exit 1;fi
 grep -q 'CONTENT_RIGHTS_RELEASE_HOLD' /tmp/canone-rec07-hold || { cat /tmp/canone-rec07-hold;exit 1; }
 rm -f /tmp/canone-rec07-hold
}
db "UPDATE canone_editorial.rights_release_ci SET decision='HOLD_RIGHTS',permitted_scope='NONE'
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
expect_hold
db "UPDATE canone_editorial.rights_release_ci SET decision='TEST_ONLY',permitted_scope='EPHEMERAL_CI'
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
saved_digest="$(db "SELECT content_sha256 FROM canone_editorial.rights_release_ci
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" | head -1)"
[[ "$saved_digest" =~ ^[a-f0-9]{64}$ ]] || { echo INVALID_DIGEST;exit 1; }
db "UPDATE canone_editorial.rights_release_ci SET content_sha256=repeat('0',64)
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
expect_hold
db "UPDATE canone_editorial.rights_release_ci SET content_sha256='$saved_digest'
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
db "UPDATE canone_editorial.rights_release_ci SET valid_until=now()-interval '1 minute'
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
expect_hold
db "UPDATE canone_editorial.rights_release_ci SET valid_until=now()+interval '1 hour'
 WHERE content_item_id='00000000-0000-4000-8000-000000000009';" >/dev/null
rights_attempt | grep -qx '2' || { echo FAIL_RIGHTS_RESTORE;exit 1; }
echo PASS_F3_REC07_RIGHTS_HOLD_TAMPER_EXPIRY

# Expire both authorizations, proving the entire form is blocked without rights.
db "UPDATE canone_editorial.verification SET valid_until=now()-interval '1 minute'
 WHERE notes='CI_LICENSE_SYNTHETIC_ONLY';" >/dev/null
/tmp/canone-f3-py/bin/python tests/f3_rec06_browser_restart.py revoked
[[ "$(db "SELECT count(*) FROM canone_learning.exam_attempt WHERE user_id='33333333-3333-4333-8333-333333333333' AND finished_at IS NOT NULL;")" -ge 1 ]]
[[ "$(db "SELECT count(*) FROM canone_learning.exam_review_receipt r JOIN canone_learning.exam_attempt a ON a.id=r.attempt_id WHERE a.user_id='33333333-3333-4333-8333-333333333333';")" -ge 1 ]]
echo PASS_F3_REAL_BROWSER_PG17
