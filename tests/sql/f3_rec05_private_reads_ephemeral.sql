-- Cânone F3-REC-05: TEST-ONLY SQL. Apply exclusively in ephemeral PG17 CI after canonical candidate 010.
-- Reuses source S22 learning.exam_attempt, exam_form, exam_form_item and answer tables.
-- Never deploy directly or grant SELECT to browsers. Approved license/content still HOLD.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $guard$ BEGIN
 IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN
   RAISE EXCEPTION 'REFUSE_SHARED_CANONE_SOURCE' USING ERRCODE='23514'; END IF;
 IF to_regclass('canone_learning.exam_attempt') IS NULL
    OR to_regclass('canone_learning.exam_form_item') IS NULL
    OR to_regprocedure('canone_ops.can_use_feature(uuid,text)') IS NULL THEN
   RAISE EXCEPTION 'REQUIRES_F3_ALPHA9_EPHEMERAL_STAGING' USING ERRCODE='23514'; END IF;
END $guard$;

-- All three are SECURITY DEFINER, owned by migration account and callable solely
-- by service_role. The verified user comes from transaction-local JWT claims.
-- Defense-in-depth: re-evaluate feature entitlement inside every read function.
CREATE OR REPLACE FUNCTION canone_ops.exam_catalog()
RETURNS TABLE(form_id uuid,form_label text,question_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
   RAISE EXCEPTION 'FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT f.id,f.form_label,count(fi.ordinal)::bigint
 FROM canone_learning.exam_form f
 JOIN canone_taxonomy.exam_track t ON t.id=f.exam_track_id
 JOIN canone_taxonomy.exam_edition e ON e.id=t.exam_edition_id
 JOIN canone_learning.exam_form_item fi ON fi.exam_form_id=f.id
 WHERE e.status='realizada'
  AND EXISTS(SELECT 1 FROM canone_learning.answer_key k
             WHERE k.exam_form_id=f.id AND k.status='definitivo')
 GROUP BY f.id,f.form_label
 HAVING count(fi.ordinal)>0
 ORDER BY f.form_label,f.id
 LIMIT 20;
END;
$fn$;

CREATE OR REPLACE FUNCTION canone_ops.exam_history()
RETURNS TABLE(attempt_id uuid,form_id uuid,status text,started_at timestamptz,
 finished_at timestamptz,answered_count integer,correct_count integer,question_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
   RAISE EXCEPTION 'FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT a.id,a.exam_form_id,a.status,a.started_at,a.finished_at,a.answered_count,
        CASE WHEN a.status='concluida' THEN a.correct_count ELSE NULL::integer END,
        (SELECT count(*) FROM canone_learning.exam_form_item fi
          WHERE fi.exam_form_id=a.exam_form_id)::bigint
 FROM canone_learning.exam_attempt a
 WHERE a.user_id=v_uid AND a.exam_form_id IS NOT NULL
 ORDER BY a.started_at DESC,a.id DESC LIMIT 20;
END;
$fn$;

CREATE OR REPLACE FUNCTION canone_ops.exam_resume(p_attempt_id uuid)
RETURNS TABLE(attempt_id uuid,form_id uuid,status text,started_at timestamptz,
 finished_at timestamptz,answered_count integer,question_count bigint,answers jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
   RAISE EXCEPTION 'FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM canone_learning.exam_attempt a
                WHERE a.id=p_attempt_id AND a.user_id=v_uid)
 THEN RAISE EXCEPTION 'OBJECT_NOT_FOUND' USING ERRCODE='23503'; END IF;
 RETURN QUERY
 SELECT a.id,a.exam_form_id,a.status,a.started_at,a.finished_at,a.answered_count,
        (SELECT count(*) FROM canone_learning.exam_form_item fi
           WHERE fi.exam_form_id=a.exam_form_id)::bigint,
        COALESCE((SELECT jsonb_agg(
          jsonb_build_object('ordinal',ans.ordinal,'option',ans.chosen_option)
          ORDER BY ans.ordinal)
          FROM canone_learning.exam_attempt_answer ans
          WHERE ans.attempt_id=a.id),'[]'::jsonb)
 FROM canone_learning.exam_attempt a WHERE a.id=p_attempt_id AND a.user_id=v_uid;
END;
$fn$;

REVOKE ALL ON FUNCTION canone_ops.exam_catalog() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION canone_ops.exam_history() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION canone_ops.exam_resume(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION canone_ops.exam_catalog() TO service_role;
GRANT EXECUTE ON FUNCTION canone_ops.exam_history() TO service_role;
GRANT EXECUTE ON FUNCTION canone_ops.exam_resume(uuid) TO service_role;
COMMENT ON FUNCTION canone_ops.exam_resume(uuid) IS
 'Owner-only answer selections: never return verdict, correct option, answer key or question payload.';
COMMIT;
