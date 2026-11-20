#!/usr/bin/env bash
# Disposable GitHub Actions PostgreSQL 17 service only. Never accepts a connection URL.
set -euo pipefail
: "${CANONE_CI_PG17_CONTAINER:?Refuse to run without ephemeral Docker service container}"
: "${CANONE_CI_PG17_ONLY:?Explicit CI opt-in required}"
[[ "$CANONE_CI_PG17_ONLY" == yes ]] || { echo 'REFUSE_UNSAFE_DB'; exit 2; }
[[ "$CANONE_CI_PG17_CONTAINER" =~ ^[0-9a-f]{12,64}$ ]] || { echo 'INVALID_DOCKER_CONTAINER'; exit 2; }
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_PASSWORD; do
  [[ -z "${!key:-}" ]] || { echo "REFUSE_REMOTE_ENV_$key"; exit 2; }
done
DB=canone_alpha7_ci
run(){ docker exec "$CANONE_CI_PG17_CONTAINER" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qAt -c "$1"; }
apply(){ docker exec -i "$CANONE_CI_PG17_CONTAINER" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q < "$1"; }
cat <<'SQL' | apply /dev/stdin
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111');
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
SQL
for file in \
  001_identity_and_source_bridge \
  002_domain_tables_82 \
  003_indexes_constraints \
  004_invoker_views \
  005_owner_policies \
  006_auth_user_id_compat \
  007_integrity_triggers \
  008_audit_chain_and_seal; do
  echo "PG17 candidate $file"
  apply "staging/supabase/$file.candidate.sql.txt"
done
[[ "$(run "SELECT count(*) FROM information_schema.tables WHERE table_schema LIKE 'canone_%' AND table_type='BASE TABLE'" | tail -1)" == 89 ]] || { echo 'PG17_TABLE_COUNT_FAIL'; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pids=()
# 12 concurrent, independent PostgreSQL sessions. Each writer must commit
# before the next acquires the fixed pg_advisory_xact_lock.
for i in $(seq 1 12); do
  (run "BEGIN; INSERT INTO canone_audit.audit_log(action,entity_type,metadata)
    VALUES ('PG17-$i','concurrency','{\"worker\":$i}'); SELECT pg_sleep(0.04); COMMIT;" >"$TMP/audit-$i" 2>&1) &
  pids+=("$!")
done
for p in "${pids[@]}"; do
  wait "$p" || { echo 'PG17_CONCURRENT_AUDIT_INSERT_FAILED'; cat "$TMP"/audit-*; exit 1; }
done
out="$(run "SELECT count(*)::text||'|'||min(seq)::text||'|'||max(seq)::text||'|'||count(DISTINCT seq)::text FROM canone_audit.audit_log")"
[[ "$out" == '12|1|12|12' ]] || { echo "PG17_AUDIT_BAD_SEQ $out"; exit 1; }
[[ "$(run 'SELECT count(*) FROM canone_audit.verify_chain()')" == 0 ]] || { echo 'PG17_CHAIN_INVALID'; exit 1; }
[[ "$(run 'SELECT count(*) FROM canone_audit.verify_chain(8)')" == 0 ]] || { echo 'PG17_PARTIAL_CHAIN_INVALID'; exit 1; }
echo 'PASS_PG17_AUDIT_CONCURRENCY writers=12 seq=1..12 bad_hashes=0'
# Minimal synthetic fixture (no editorial or official CFC content).
cat <<'SQL' | apply /dev/stdin
INSERT INTO canone_editorial.source(id,key,kind,title)
 VALUES ('00000000-0000-4000-8000-000000000001','alpha7-test','edital','SYNTHETIC - not publishable');
INSERT INTO canone_taxonomy.exam_edition(id,code,label,edition_number,year,application_date,question_count,status)
 VALUES ('00000000-0000-4000-8000-000000000002','ALPHA7-CI','Synthetic edition',1,2026,'2026-10-01',2,'realizada');
INSERT INTO canone_taxonomy.exam_track(id,exam_edition_id,track_code,label,question_count)
 VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','suficiencia','Test track',2);
INSERT INTO canone_learning.exam_form(id,exam_track_id,form_code,form_label)
 VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','T01','Synthetic form');
INSERT INTO canone_editorial.content_type(id,key,label,family)
 VALUES ('00000000-0000-4000-8000-000000000006','alpha7-ci','Synthetic type','avaliacao');
INSERT INTO canone_editorial.content_type_version(id,content_type_id,version)
 VALUES ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000006',1);
INSERT INTO canone_editorial.content_item(id,content_type_id,content_type_version_id,key,state,title)
 VALUES ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007','ci-1','rascunho','Synthetic Q1'),
        ('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007','ci-2','rascunho','Synthetic Q2'),
        ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007','ci-3','rascunho','Synthetic Q3');
INSERT INTO canone_learning.item(id,content_item_id,content_type_key,kind)
 VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000008','alpha7-ci','questao'),
        ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000009','alpha7-ci','questao'),
        ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000010','alpha7-ci','questao');
INSERT INTO canone_learning.exam_form_item(exam_form_id,ordinal,item_id)
 VALUES ('00000000-0000-4000-8000-000000000004',1,'00000000-0000-4000-8000-000000000011'),
        ('00000000-0000-4000-8000-000000000004',2,'00000000-0000-4000-8000-000000000012');
INSERT INTO canone_learning.answer_key(id,exam_form_id,status,source_id)
 VALUES ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004','preliminar','00000000-0000-4000-8000-000000000001');
INSERT INTO canone_learning.answer_key_entry(answer_key_id,ordinal,correct_option)
 VALUES ('00000000-0000-4000-8000-000000000005',1,'A'),
        ('00000000-0000-4000-8000-000000000005',2,'B');
SQL
# Session A holds the parent form lock, then finalizes. B tries to add an
# extra form position while A is in flight; B must await A and get 23514.
(run "BEGIN; SELECT id FROM canone_learning.exam_form
  WHERE id='00000000-0000-4000-8000-000000000004' FOR UPDATE;
  SELECT pg_sleep(1.2);
  UPDATE canone_learning.answer_key SET status='definitivo'
  WHERE id='00000000-0000-4000-8000-000000000005'; COMMIT;" >"$TMP/seal-A" 2>&1) &
A_PID=$!
sleep 0.2
(run "INSERT INTO canone_learning.exam_form_item(exam_form_id,ordinal,item_id)
 VALUES ('00000000-0000-4000-8000-000000000004',3,'00000000-0000-4000-8000-000000000013')" >"$TMP/seal-B" 2>&1) &
B_PID=$!
wait "$A_PID" || { echo 'PG17_SEAL_TXN_FAILED'; cat "$TMP/seal-A"; exit 1; }
if wait "$B_PID"; then echo 'PG17_SEAL_RACE_ALLOWED_INSERT'; exit 1; fi
if ! grep -qE '(sealed form|23514)' "$TMP/seal-B"; then
  echo 'PG17_SEAL_RACE_UNEXPECTED_ERROR'; cat "$TMP/seal-B"; exit 1;
fi
[[ "$(run "SELECT status FROM canone_learning.answer_key WHERE id='00000000-0000-4000-8000-000000000005'")" == definitivo ]] || { echo 'PG17_SEAL_NOT_COMMITTED'; exit 1; }
[[ "$(run "SELECT count(*) FROM canone_learning.exam_form_item WHERE exam_form_id='00000000-0000-4000-8000-000000000004'")" == 2 ]] || { echo 'PG17_FORM_ITEM_CORRUPTION'; exit 1; }
echo 'PASS_PG17_SEAL_CONCURRENT_INSERT blocked=1 definitive=1 form_count=2'
