-- F1 NS01-02: ephemeral PG17 ONLY; NO production migration.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $guard$ BEGIN
 IF current_database()<>'canone_alpha7_ci'
    OR to_regclass('canone_control.migration_catalog') IS NOT NULL
    OR to_regclass('canone_learning.user_item_state') IS NULL
    OR to_regclass('canone_learning.item_subject') IS NULL
    OR to_regprocedure('canone_ops.can_use_feature(uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'REFUSE_NON_EPHEMERAL_CANONE_ENV' USING ERRCODE='23514';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION canone_ops.srs_due_private_ci(
 p_subject_id uuid DEFAULT NULL, p_limit integer DEFAULT 50
) RETURNS TABLE (
 item_id uuid, subject_id uuid, due_at timestamptz, state text,
 stability_days numeric, is_fragile boolean, last_grade canone_learning.review_grade
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $srs$
DECLARE v_uid uuid := auth.uid();
BEGIN
 IF v_uid IS NULL THEN
  RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN
  RAISE EXCEPTION 'SRS_LIMIT_OUT_OF_RANGE' USING ERRCODE='22023';
 END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
  RAISE EXCEPTION 'SRS_FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT s.item_id,a.subject_id,s.due_at,s.state,s.stability_days,
        s.is_fragile,s.last_grade
 FROM canone_learning.user_item_state s
 JOIN canone_learning.item_subject a ON a.item_id=s.item_id
 WHERE s.user_id=v_uid AND s.due_at IS NOT NULL AND s.due_at<=now()
   AND s.state<>'nova'
   AND (p_subject_id IS NULL OR a.subject_id=p_subject_id)
 ORDER BY s.due_at,s.item_id,a.subject_id
 LIMIT p_limit;
END;
$srs$;
REVOKE ALL ON FUNCTION canone_ops.srs_due_private_ci(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION canone_ops.srs_due_private_ci(uuid,integer) TO service_role;
COMMENT ON FUNCTION canone_ops.srs_due_private_ci(uuid,integer) IS
 'CI ephemeral candidate only: owner and valid entitlement, not historical semantic parity or production clearance';
COMMIT;
