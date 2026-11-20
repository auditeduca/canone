#!/usr/bin/env bash
# PG17 only after alpha7 fixture: synthetic user/form/key in ephemeral service.
set -euo pipefail
: "${CANONE_CI_PG17_CONTAINER:?Cannot run without ephemeral PG17 service}"
: "${CANONE_CI_PG17_ONLY:?Explicit CI opt-in required}"
[[ "$CANONE_CI_PG17_ONLY" == yes ]] || { echo 'REFUSE_NON_CI_DB'; exit 2; }
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ ]] || { echo 'INVALID_CONTAINER_ID'; exit 2; }
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY; do
  [[ -z "${!key:-}" ]] || { echo "REFUSE_REMOTE_ENV_$key"; exit 2; }
done
DB=canone_alpha7_ci
A='11111111-1111-4111-8111-111111111111'
FORM='00000000-0000-4000-8000-000000000004'
run(){ docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qAt -c "$1"; }
apply(){ docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q < "$1"; }
run "CREATE ROLE service_role NOLOGIN; GRANT USAGE ON SCHEMA auth TO service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO service_role;" >/dev/null
apply staging/supabase/009_attempt_grade_srs.candidate.sql.txt
[[ "$(run 'SELECT count(*) FROM canone_learning.exam_review_receipt')" == 0 ]] || { echo 'PG17_RECEIPT_NOT_EMPTY'; exit 1; }
call(){ run "SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','$A',false); $1" | tail -n 1; }
ATT="$(call "SELECT canone_ops.exam_start('$FORM');")"
[[ "$ATT" =~ ^[0-9a-f-]{36}$ ]] || { echo "PG17_ATTEMPT_START_BAD_ID '$ATT'"; exit 1; }
call "SELECT canone_ops.exam_answer('$ATT',1,'B')" >/dev/null
call "SELECT canone_ops.exam_answer('$ATT',1,'A')" >/dev/null
[[ "$(run "SELECT answered_count||'|'||correct_count||'|'||wrong_count FROM canone_learning.exam_attempt WHERE id='$ATT'")" == '1|1|0' ]] || { echo 'PG17_REPEAT_ANSWER_COUNT_BAD'; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# A locks the attempt row, sleeps, and then closes it. B submits another
# answer while A holds the lock. B must wait, then see ATTEMPT_CLOSED.
(run "BEGIN;
 SELECT id FROM canone_learning.exam_attempt WHERE id='$ATT' FOR UPDATE;
 SELECT pg_sleep(1.1);
 SET LOCAL ROLE service_role;
 SELECT set_config('request.jwt.claim.sub','$A',true);
 SELECT * FROM canone_ops.exam_finish('$ATT');
 COMMIT;" >"$TMP/finish-A" 2>&1) &
PID_A=$!
sleep 0.2
(run "SET ROLE service_role; SELECT set_config('request.jwt.claim.sub','$A',false);
 SELECT canone_ops.exam_answer('$ATT',2,'B');" >"$TMP/answer-B" 2>&1) &
PID_B=$!
wait "$PID_A" || { echo 'PG17_FINISH_TXN_FAILED'; cat "$TMP/finish-A"; exit 1; }
if wait "$PID_B"; then echo 'PG17_LATE_ANSWER_WAS_ACCEPTED'; exit 1; fi
if ! grep -q 'ATTEMPT_CLOSED' "$TMP/answer-B"; then
  echo 'PG17_LATE_ANSWER_FAILED_FOR_WRONG_REASON'; cat "$TMP/answer-B"; exit 1;
fi
[[ "$(run "SELECT status||'|'||answered_count||'|'||correct_count FROM canone_learning.exam_attempt WHERE id='$ATT'")" == 'concluida|1|1' ]] || { echo 'PG17_FINISH_COUNTS_BAD'; exit 1; }
echo 'PASS_PG17_ALPHA8_FINISH_ANSWER_RACE late_answer_blocked=1 final_count=1'
# Two simultaneous requests to materialize the same answer into SRS.
pids=()
for n in 1 2; do
  (call "SELECT canone_ops.exam_to_srs('$ATT',1);" >"$TMP/srs-$n" 2>&1) &
  pids+=("$!")
done
for p in "${pids[@]}"; do
  wait "$p" || { echo 'PG17_SRS_REQUEST_FAILED'; cat "$TMP"/srs-*; exit 1; }
done
SRS_A="$(tail -n1 "$TMP/srs-1")"; SRS_B="$(tail -n1 "$TMP/srs-2")"
[[ "$SRS_A" == "$SRS_B" && "$SRS_A" =~ ^[0-9a-f-]{36}$ ]] || { echo 'PG17_SRS_DUPLICATE_EVENT_ID'; exit 1; }
[[ "$(run "SELECT count(*) FROM canone_learning.exam_review_receipt WHERE attempt_id='$ATT'")" == 1 ]] || { echo 'PG17_SRS_RECEIPT_NOT_UNIQUE'; exit 1; }
[[ "$(run "SELECT repetitions FROM canone_learning.user_item_state WHERE user_id='$A'")" == 1 ]] || { echo 'PG17_SRS_STATE_DOUBLE_APPLIED'; exit 1; }
[[ "$(run "SELECT count(*) FROM canone_learning.review_event WHERE algorithm_version='canone-srs-exam-v1'")" == 1 ]] || { echo 'PG17_SRS_EVENT_DOUBLE_APPLIED'; exit 1; }
echo 'PASS_PG17_ALPHA8_SRS_EXACTLY_ONCE concurrent_requests=2 receipt_count=1 state_repetitions=1'
# Browser cannot call the private privileged endpoint, even with a valid user.
if run "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$A',false);
  SELECT canone_ops.exam_start('$FORM');" >"$TMP/browser-denial" 2>&1; then
 echo 'PG17_BROWSER_PRIVILEGED_API_EXPOSED'; exit 1;
fi
if ! grep -q 'permission denied' "$TMP/browser-denial"; then
 echo 'PG17_BROWSER_DENIAL_UNEXPECTED_REASON'; cat "$TMP/browser-denial"; exit 1;
fi
echo 'PASS_PG17_ALPHA8_SERVICE_BOUNDARY browser_execute_denied=1'
