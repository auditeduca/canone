-- S20 REPLAY FIXTURE — SYNTHETIC ONLY. Requires a new, disposable database.
-- Never include this file in production migrations. psql ON_ERROR_STOP required.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'canone_s20_disposable'
    OR to_regclass('s20_sentinel.disposable_marker') IS NULL
    OR (SELECT count(*) FROM s20_sentinel.disposable_marker WHERE marker='S20-ISOLATED-PG18')<>1
 THEN RAISE EXCEPTION 'S20_DISPOSABLE_ONLY'; END IF;
END $guard$;
BEGIN;
CREATE ROLE canone_subscriber NOLOGIN NOINHERIT;
CREATE ROLE s20_owner NOLOGIN NOINHERIT;
CREATE SCHEMA canone_ops;
CREATE SCHEMA canone_identity;
GRANT USAGE ON SCHEMA canone_ops,canone_identity TO canone_subscriber;
GRANT USAGE ON SCHEMA canone_identity TO s20_owner;
CREATE FUNCTION canone_ops.current_user_id() RETURNS uuid
 LANGUAGE sql STABLE AS $f$ SELECT NULLIF(current_setting('app.current_user_id',true),'')::uuid $f$;
CREATE TABLE canone_identity.user_profile(user_id uuid PRIMARY KEY,display_name text);
ALTER TABLE canone_identity.user_profile OWNER TO s20_owner;
GRANT SELECT,UPDATE ON canone_identity.user_profile TO canone_subscriber;
INSERT INTO canone_identity.user_profile VALUES
 ('11111111-1111-4111-8111-111111111111','A'),
 ('22222222-2222-4222-8222-222222222222','B');
ALTER TABLE canone_identity.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_identity.user_profile FORCE ROW LEVEL SECURITY;
CREATE POLICY sub_own_profile ON canone_identity.user_profile FOR SELECT TO canone_subscriber
 USING (user_id=canone_ops.current_user_id());
CREATE POLICY sub_own_profile_write ON canone_identity.user_profile FOR UPDATE TO canone_subscriber
 USING (user_id=canone_ops.current_user_id()) WITH CHECK (user_id=canone_ops.current_user_id());
COMMIT;
BEGIN;
SET LOCAL ROLE canone_subscriber;
SELECT set_config('app.current_user_id','11111111-1111-4111-8111-111111111111',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM canone_identity.user_profile)<>1 OR
 NOT EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE display_name='A')
 THEN RAISE EXCEPTION 'RLS_A_FAILED'; END IF;
 RAISE NOTICE 'PASS: A sees only A';
END $t$;
UPDATE canone_identity.user_profile SET display_name='UNAUTHORIZED' WHERE display_name='B';
COMMIT;
BEGIN;
SET LOCAL ROLE canone_subscriber;
SELECT set_config('app.current_user_id','22222222-2222-4222-8222-222222222222',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM canone_identity.user_profile)<>1 OR
 NOT EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE display_name='B')
 THEN RAISE EXCEPTION 'RLS_B_FAILED'; END IF;
 RAISE NOTICE 'PASS: B sees only B and prior A UPDATE was blocked';
END $t$;
COMMIT;
BEGIN;
SET LOCAL ROLE canone_subscriber;
SELECT set_config('app.current_user_id','11111111-1111-4111-8111-111111111111',true);
-- A SQL-capable caller can change this custom setting; do not expose free SQL to this role.
SELECT set_config('app.current_user_id','22222222-2222-4222-8222-222222222222',true);
DO $t$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE display_name='B')
 THEN RAISE EXCEPTION 'EXPECTED_GUC_MUTABILITY_NOT_OBSERVED'; END IF;
 RAISE NOTICE 'SECURITY_FINDING: Mutable GUC changes user scope';
END $t$;
COMMIT;
BEGIN;
SET LOCAL ROLE s20_owner;
DO $t$ BEGIN
 IF (SELECT count(*) FROM canone_identity.user_profile)<>0
 THEN RAISE EXCEPTION 'FORCE_RLS_OWNER_FAILED'; END IF;
 RAISE NOTICE 'PASS: FORCE RLS applies to nonsuperuser table owner';
END $t$;
COMMIT;
DO $t$ BEGIN
 IF (SELECT count(*) FROM foreign_sentinel.untouched WHERE marker='untouched')<>1
 THEN RAISE EXCEPTION 'FOREIGN_SENTINEL_MODIFIED'; END IF;
 RAISE NOTICE 'PASS: foreign sentinel preserved';
END $t$;
