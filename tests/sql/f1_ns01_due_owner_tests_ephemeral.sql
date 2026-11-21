-- F1 NS01-02: independent users and entitlement negatives, ALL DATA ROLLED BACK.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $guard$ BEGIN
 IF current_database()<>'canone_alpha7_ci'
    OR to_regclass('canone_control.migration_catalog') IS NOT NULL
    OR to_regprocedure('canone_ops.srs_due_private_ci(uuid,integer)') IS NULL THEN
  RAISE EXCEPTION 'REFUSE_NON_EPHEMERAL_TEST_ENV' USING ERRCODE='23514';
 END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES
 ('66666666-6666-4666-8666-666666666666'),
 ('77777777-7777-4777-8777-777777777777');
INSERT INTO canone_taxonomy.knowledge_area(key,label)
 VALUES ('f1ns01-ci-area','Synthetic F1 area');
INSERT INTO canone_taxonomy.subject(id,key,label,area_key) VALUES
 ('66666666-0000-4000-8000-000000000001','f1ns01-ci-sub-1','Synthetic topic 1','f1ns01-ci-area'),
 ('66666666-0000-4000-8000-000000000002','f1ns01-ci-sub-2','Synthetic topic 2','f1ns01-ci-area');
INSERT INTO canone_learning.item_subject(item_id,subject_id) VALUES
 ('00000000-0000-4000-8000-000000000011','66666666-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000012','66666666-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000013','66666666-0000-4000-8000-000000000001');
INSERT INTO canone_learning.user_item_state(user_id,item_id,state,due_at,fragile_streak) VALUES
 ('66666666-6666-4666-8666-666666666666','00000000-0000-4000-8000-000000000011','revisao',now()-interval '2 days',3),
 ('66666666-6666-4666-8666-666666666666','00000000-0000-4000-8000-000000000012','reaprendendo',now()-interval '1 day',0),
 ('66666666-6666-4666-8666-666666666666','00000000-0000-4000-8000-000000000013','nova',now()-interval '1 day',0),
 ('77777777-7777-4777-8777-777777777777','00000000-0000-4000-8000-000000000011','revisao',now()-interval '3 days',0),
 ('77777777-7777-4777-8777-777777777777','00000000-0000-4000-8000-000000000013','aprendendo',now()+interval '3 days',0);
INSERT INTO canone_commerce.entitlement(user_id,feature_key,source,expires_at) VALUES
 ('66666666-6666-4666-8666-666666666666','cfc.exam','admin',now()+interval '2 hours'),
 ('77777777-7777-4777-8777-777777777777','cfc.exam','admin',now()+interval '2 hours');

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
DO $tests$ DECLARE n integer; r record; BEGIN
 SELECT count(*) INTO n FROM canone_ops.srs_due_private_ci();
 IF n<>2 THEN RAISE EXCEPTION 'FAIL_OWNER_A_DUE_COUNT %',n; END IF;
 SELECT count(*) INTO n FROM canone_ops.srs_due_private_ci('66666666-0000-4000-8000-000000000001',50);
 IF n<>1 THEN RAISE EXCEPTION 'FAIL_SUBJECT_FILTER %',n; END IF;
 SELECT count(*) INTO n FROM canone_ops.srs_due_private_ci(NULL,1);
 IF n<>1 THEN RAISE EXCEPTION 'FAIL_LIMIT %',n; END IF;
 FOR r IN SELECT * FROM canone_ops.srs_due_private_ci() LOOP
  IF r.state='nova' OR r.due_at>now() OR
    r.subject_id NOT IN ('66666666-0000-4000-8000-000000000001',
                          '66666666-0000-4000-8000-000000000002') THEN
     RAISE EXCEPTION 'FAIL_SRS_LEAK'; END IF;
 END LOOP;
 BEGIN PERFORM * FROM canone_ops.srs_due_private_ci(NULL,0);
  RAISE EXCEPTION 'FAIL_ZERO_LIMIT_ALLOWED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN PERFORM * FROM canone_ops.srs_due_private_ci(NULL,101);
  RAISE EXCEPTION 'FAIL_EXCESSIVE_LIMIT_ALLOWED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $tests$;

SELECT pg_catalog.set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
DO $tests$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM canone_ops.srs_due_private_ci();
 IF n<>1 THEN RAISE EXCEPTION 'FAIL_OWNER_B_DUE_COUNT %',n; END IF;
 SELECT count(*) INTO n FROM canone_ops.srs_due_private_ci('66666666-0000-4000-8000-000000000002',50);
 IF n<>0 THEN RAISE EXCEPTION 'FAIL_CROSS_SUBJECT_B_LEAK %',n; END IF;
END $tests$;
RESET ROLE;
UPDATE canone_commerce.entitlement SET revoked_at=now()
 WHERE user_id='77777777-7777-4777-8777-777777777777' AND source='admin';
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
DO $tests$ BEGIN
 BEGIN PERFORM * FROM canone_ops.srs_due_private_ci();
  RAISE EXCEPTION 'FAIL_REVOKED_SUBSCRIBER_ALLOWED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $tests$;
SELECT pg_catalog.set_config('request.jwt.claim.sub','',true);
DO $tests$ BEGIN
 BEGIN PERFORM * FROM canone_ops.srs_due_private_ci();
  RAISE EXCEPTION 'FAIL_ANONYMOUS_SUBJECT_ALLOWED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $tests$;
RESET ROLE;
ROLLBACK;
