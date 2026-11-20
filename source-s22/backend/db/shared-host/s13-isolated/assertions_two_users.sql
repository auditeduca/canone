-- S13 isolated A/B fixture and RLS test. Requires 002..017 applied in disposable container.
DO $g$ BEGIN
  IF current_database()<>'canone_s13_disposable' OR to_regclass('s13_sentinel.disposable_marker') IS NULL
  THEN RAISE EXCEPTION 'S13 REFUSED: non-disposable database'; END IF;
END $g$;
INSERT INTO canone_identity.account (id, email, status) VALUES
 ('11111111-1111-4111-8111-111111111111','s13-a@example.invalid','ativo'),
 ('22222222-2222-4222-8222-222222222222','s13-b@example.invalid','ativo');
INSERT INTO canone_identity.user_profile(user_id,display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','Synthetic A'),
 ('22222222-2222-4222-8222-222222222222','Synthetic B');
BEGIN;
SET LOCAL ROLE canone_subscriber;
SELECT set_config('app.current_user_id','11111111-1111-4111-8111-111111111111',true);
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM canone_identity.user_profile;
 IF n<>1 THEN RAISE EXCEPTION 'S13 FAIL subscriber A sees % profiles, expected 1', n; END IF;
 IF EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE user_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'S13 FAIL subscriber A can read subscriber B'; END IF;
END $t$;
UPDATE canone_identity.user_profile SET display_name='UNAUTHORIZED' WHERE user_id='22222222-2222-4222-8222-222222222222';
COMMIT;
BEGIN;
SET LOCAL ROLE canone_subscriber;
SELECT set_config('app.current_user_id','22222222-2222-4222-8222-222222222222',true);
DO $t$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM canone_identity.user_profile;
 IF n<>1 THEN RAISE EXCEPTION 'S13 FAIL subscriber B sees % profiles, expected 1', n; END IF;
 IF EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE user_id='11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'S13 FAIL subscriber B can read subscriber A'; END IF;
END $t$;
COMMIT;
DO $t$ BEGIN
 IF EXISTS(SELECT 1 FROM canone_identity.user_profile WHERE display_name='UNAUTHORIZED')
 THEN RAISE EXCEPTION 'S13 FAIL subscriber A modified subscriber B'; END IF;
END $t$;
