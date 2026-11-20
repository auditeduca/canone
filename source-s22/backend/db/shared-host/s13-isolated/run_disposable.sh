#!/usr/bin/env bash
# Fail closed. Never accepts database URLs. Only docker exec to a private isolated DB.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
HERE="$ROOT/backend/db/shared-host/s13-isolated"
IMAGE="postgres:17"
DB="canone_s13_disposable"
for var in DATABASE_URL SUPABASE_DB_URL PGHOST PGSERVICE PGPORT; do
  if [[ -n "${!var:-}" ]]; then echo "S13_HOLD_EXTERNAL_DB_VARIABLE: $var" >&2; exit 23; fi
done
if ! command -v docker >/dev/null 2>&1; then
  echo "S13_HOLD_RUNTIME: docker unavailable; no PostgreSQL test performed" >&2; exit 24
fi
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "S13_HOLD_IMAGE: local image $IMAGE unavailable; load the reviewed image separately" >&2; exit 25
fi
TMP="$(mktemp -d)"
NAME="canone-s13-$RANDOM-$$"
cleanup(){ docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
python3 "$HERE/prepare.py" --stage-disposable "$TMP"
# Explicit --network none and no -p: no host ports, no external network, no Supabase.
docker run --rm -d --network none --name "$NAME" -e POSTGRES_PASSWORD="$(date +%s)$$$RANDOM" -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null
for i in {1..30}; do
  if docker exec "$NAME" pg_isready -U postgres -d "$DB" -q; then break; fi
  sleep 1
done
docker exec "$NAME" pg_isready -U postgres -d "$DB" -q
query(){ docker exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$DB" "$@"; }
query <<'SQL'
CREATE SCHEMA s13_sentinel;
CREATE TABLE s13_sentinel.disposable_marker (marker text PRIMARY KEY);
INSERT INTO s13_sentinel.disposable_marker VALUES ('s13-verified');
CREATE SCHEMA foreign_sentinel;
CREATE TABLE foreign_sentinel.untouched (marker text NOT NULL);
INSERT INTO foreign_sentinel.untouched VALUES ('untouched');
SQL
for file in "$TMP"/*.sql; do
  echo "S13_DDL_TRY: $(basename "$file")"
  # Each SQL file is independent and validated by server-side DB marker.
  query < "$file" || { echo "S13_HOLD_DDL: failed $(basename "$file")" >&2; exit 26; }
done
query < "$HERE/assertions.sql" || { echo "S13_HOLD_FUNCTIONAL: assertion failed" >&2; exit 27; }
query < "$HERE/assertions_two_users.sql" || { echo "S13_HOLD_TENANT_ISOLATION: assertion failed" >&2; exit 28; }
# Restore is tested into a SECOND disposable database in the same isolated container.
docker exec "$NAME" pg_dump -Fc -U postgres -d "$DB" -f /tmp/s13.dump
docker exec "$NAME" createdb -U postgres canone_s13_restore_disposable
docker exec "$NAME" pg_restore -U postgres -d canone_s13_restore_disposable /tmp/s13.dump
restored="$(docker exec "$NAME" psql -X -A -t -U postgres -d canone_s13_restore_disposable -c "SELECT count(*) FROM s13_sentinel.disposable_marker WHERE marker='s13-verified'")"
[[ "$restored" == "1" ]] || { echo 'S13_HOLD_RESTORE: missing restored marker' >&2; exit 29; }
echo "S13_ISOLATED_TESTS_PASS_ONLY: no authorization for shared Supabase or commercial release"
