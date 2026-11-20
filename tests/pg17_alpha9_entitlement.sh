#!/usr/bin/env bash
# Execute ONLY after alpha7+alpha8 synthetic PG17 fixtures in isolated GitHub service container.
set -euo pipefail
: "${CANONE_CI_PG17_CONTAINER:?Refuse non-ephemeral DB}"
[[ "${CANONE_CI_PG17_ONLY:-}" == yes ]] || { echo REFUSE_NON_CI_DATABASE; exit 2; }
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ ]] || { echo REFUSE_INVALID_CONTAINER; exit 2; }
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY; do
  [[ -z "${!key:-}" ]] || { echo "REFUSE_REAL_DB_ENV_$key";exit 2; }
done
run(){ docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d canone_alpha7_ci -c "$1"; }
A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
apply(){ docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d canone_alpha7_ci < "$1"; }
apply staging/supabase/010_private_feature_gate.candidate.sql.txt
user_call(){ run "SET ROLE service_role; SELECT pg_catalog.set_config('request.jwt.claim.sub','$1',false); SELECT canone_ops.can_use_feature('$2','cfc.exam');" | tail -1; }
[[ "$(user_call "$A" "$A")" == f ]] || { echo ALLOW_WITHOUT_ENTITLEMENT;exit 1; }
[[ "$(user_call "$A" "$B")" == f ]] || { echo USER_IMPERSONATION_GATE;exit 1; }
[[ "$(user_call "$A" "$A")" == f ]] || { echo ALLOW_WITHOUT_SUBSCRIPTION;exit 1; }
echo 'PASS_PG17_ALPHA9_DEFAULT_DENY no_membership=1 impersonation=1'
PLAN=$(run "INSERT INTO canone_commerce.plan(key,name,billing_period,is_active) VALUES ('alpha9-synthetic','Synthetic plan','mensal',true) RETURNING id;" | tail -1)
run "INSERT INTO canone_commerce.plan_feature(plan_id,feature_key,enabled) VALUES ('$PLAN','cfc.exam',true);" >/dev/null
SUB=$(run "INSERT INTO canone_commerce.subscription(user_id,plan_id,status,current_period_start,current_period_end) VALUES ('$A','$PLAN','pendente',now()-interval '1 day',now()+interval '28 days') RETURNING id;" | tail -1)
[[ "$(user_call "$A" "$A")" == f ]] || { echo PENDING_SUBSCRIPTION_GAVE_ACCESS;exit 1; }
run "UPDATE canone_commerce.subscription SET status='ativa',trial_ends_at=now()+interval '1 day' WHERE id='$SUB';" >/dev/null
[[ "$(user_call "$A" "$A")" == f ]] || { echo TRIAL_ACCESS_NOT_BLOCKED;exit 1; }
run "UPDATE canone_commerce.subscription SET trial_ends_at=NULL WHERE id='$SUB';" >/dev/null
[[ "$(user_call "$A" "$A")" == t ]] || { echo PAID_SUBSCRIPTION_NOT_AUTHORIZED;exit 1; }
run "UPDATE canone_commerce.subscription SET current_period_end=now()-interval '1 minute' WHERE id='$SUB';" >/dev/null
[[ "$(user_call "$A" "$A")" == f ]] || { echo EXPIRED_SUBSCRIPTION_GAVE_ACCESS;exit 1; }
run "UPDATE canone_commerce.subscription SET current_period_end=now()+interval '15 days',status='cancelada' WHERE id='$SUB';" >/dev/null
[[ "$(user_call "$A" "$A")" == f ]] || { echo CANCELLED_SUBSCRIPTION_GAVE_ACCESS;exit 1; }
# An old entitlement of source assinatura must NOT override cancelled subscription.
run "INSERT INTO canone_commerce.entitlement(user_id,feature_key,source) VALUES ('$A','cfc.exam','assinatura');" >/dev/null
[[ "$(user_call "$A" "$A")" == f ]] || { echo STALE_SUBSCRIPTION_ENTITLEMENT_GAVE_ACCESS;exit 1; }
GRANT_ID=$(run "INSERT INTO canone_commerce.entitlement(user_id,feature_key,source,expires_at) VALUES ('$A','cfc.exam','admin',now()+interval '1 day') RETURNING id;" | tail -1)
[[ "$(user_call "$A" "$A")" == t ]] || { echo VALID_ADMIN_GRANT_DENIED;exit 1; }
run "UPDATE canone_commerce.entitlement SET revoked_at=now() WHERE id='$GRANT_ID';" >/dev/null
[[ "$(user_call "$A" "$A")" == f ]] || { echo REVOKED_ADMIN_GRANT_GAVE_ACCESS;exit 1; }
echo 'PASS_PG17_ALPHA9_ENTITLEMENT pending=denied trial=denied paid=allowed expired=denied cancelled=denied stale=denied admin=allowed revoked=denied'
# Browser/anon has no EXECUTE, even with an apparent user subject.
if run "SET ROLE authenticated; SELECT pg_catalog.set_config('request.jwt.claim.sub','$A',false); SELECT canone_ops.can_use_feature('$A','cfc.exam');" >/tmp/alpha9-browser-error 2>&1; then
  echo 'BROWSER_ENTITLEMENT_GATE_EXPOSED';exit 1
fi
if ! grep -q 'permission denied' /tmp/alpha9-browser-error; then
  echo 'EXPECTED_DENIAL_NOT_FOUND'; cat /tmp/alpha9-browser-error;exit 1
fi
rm -f /tmp/alpha9-browser-error
echo 'PASS_PG17_ALPHA9_BROWSER_GATE_DENIED'
