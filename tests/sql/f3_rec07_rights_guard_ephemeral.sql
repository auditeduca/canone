-- F3-REC-07: rights decision overlay exclusively in ephemeral PG17 CI.
-- The preserved 001..010 migrations and alpha11 gateway are not changed.
-- The dual reviewers below are FAKE CI identifiers, not human approvals.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $guard$ BEGIN
 IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN
  RAISE EXCEPTION 'REFUSE_SHARED_SOURCE' USING ERRCODE='23514'; END IF;
 IF to_regclass('canone_editorial.content_item_version') IS NULL
 OR to_regprocedure('canone_ops.exam_questions(uuid)') IS NULL THEN
  RAISE EXCEPTION 'REQUIRE_F3_REC06_TEST_ONLY_PG17' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM canone_editorial.source
               WHERE key='alpha7-test' AND notes='CI_ORIGINAL_SYNTHETIC_REUSE_ONLY') THEN
  RAISE EXCEPTION 'SYNTHETIC_SOURCE_REQUIRED' USING ERRCODE='23514'; END IF;
END $guard$;

CREATE TABLE canone_editorial.rights_release_ci (
  content_item_id uuid PRIMARY KEY REFERENCES canone_editorial.content_item(id),
  content_version_id uuid NOT NULL REFERENCES canone_editorial.content_item_version(id),
  source_id uuid NOT NULL REFERENCES canone_editorial.source(id),
  decision text NOT NULL CHECK (decision IN ('TEST_ONLY','HOLD_RIGHTS','REJECTED')),
  permitted_scope text NOT NULL CHECK (permitted_scope IN ('EPHEMERAL_CI','NONE')),
  evidence_reference text NOT NULL,
  evidence_sha256 char(64) NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  editorial_reviewer text NOT NULL,
  rights_reviewer text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CONSTRAINT rights_independent_reviewers CHECK (editorial_reviewer<>rights_reviewer),
  CONSTRAINT rights_status_scope CHECK (
    (decision='TEST_ONLY' AND permitted_scope='EPHEMERAL_CI')
    OR (decision<>'TEST_ONLY' AND permitted_scope='NONE')
  )
);
REVOKE ALL ON TABLE canone_editorial.rights_release_ci FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE canone_editorial.rights_release_ci ENABLE ROW LEVEL SECURITY;
ALTER TABLE canone_editorial.rights_release_ci FORCE ROW LEVEL SECURITY;
COMMENT ON TABLE canone_editorial.rights_release_ci IS
 'Ephemeral CI fixture only. TEST_ONLY is not commercial copyright clearance.';

-- Bind a decision to the CURRENT content version, exact stem payload and all option
-- bodies; edits to either component immediately invalidate previously stored rights.
INSERT INTO canone_editorial.rights_release_ci (
 content_item_id,content_version_id,source_id,decision,permitted_scope,
 evidence_reference,evidence_sha256,content_sha256,
 editorial_reviewer,rights_reviewer,valid_until
)
SELECT ci.id,cv.id,src.id,'TEST_ONLY','EPHEMERAL_CI',
       'tests/sql/f3_rec06_question_delivery_ephemeral.sql',
       encode(sha256(convert_to('CI_ORIGINAL_SYNTHETIC_REUSE_ONLY', 'UTF8')),'hex'),
       encode(sha256(convert_to(cv.payload::text||'|'||
         (SELECT string_agg(o.ordinal||':'||o.body,'|' ORDER BY o.ordinal_pos)
          FROM canone_learning.item_option o WHERE o.item_id=it.id), 'UTF8')),'hex'),
       'ci-editorial-reviewer','ci-rights-reviewer',now()+interval '1 day'
FROM canone_editorial.content_item ci
JOIN canone_editorial.content_item_version cv ON cv.id=ci.current_version_id
JOIN canone_learning.item it ON it.content_item_id=ci.id
CROSS JOIN canone_editorial.source src
WHERE ci.id IN ('00000000-0000-4000-8000-000000000008',
                '00000000-0000-4000-8000-000000000009')
 AND src.key='alpha7-test' AND src.kind='interno'
 AND src.notes='CI_ORIGINAL_SYNTHETIC_REUSE_ONLY';
DO $count$ BEGIN
 IF (SELECT count(*) FROM canone_editorial.rights_release_ci)<>2 THEN
  RAISE EXCEPTION 'INCOMPLETE_SYNTHETIC_RIGHTS_FIXTURE' USING ERRCODE='23514'; END IF;
END $count$;

-- Preserve the F3-REC06 tested implementation, but remove direct service_role
-- EXECUTE on its old function. Only the guarded F3-REC07 wrapper is public to
-- the trusted gateway's service_role.
ALTER FUNCTION canone_ops.exam_questions(uuid) RENAME TO exam_questions_rec06_ci;
REVOKE ALL ON FUNCTION canone_ops.exam_questions_rec06_ci(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION canone_ops.exam_questions(p_form_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_total integer; v_passed integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
  RAISE EXCEPTION 'FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO v_total FROM canone_learning.exam_form_item fi
 WHERE fi.exam_form_id=p_form_id;
 IF v_total<1 OR v_total>100 THEN
  RAISE EXCEPTION 'FORM_NOT_RELEASED' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_passed
 FROM canone_learning.exam_form_item fi
 JOIN canone_learning.item it ON it.id=fi.item_id
 JOIN canone_editorial.content_item ci ON ci.id=it.content_item_id
 JOIN canone_editorial.content_item_version cv
   ON cv.id=ci.current_version_id AND cv.content_item_id=ci.id
 JOIN canone_editorial.rights_release_ci rights ON rights.content_item_id=ci.id
   AND rights.content_version_id=cv.id
 JOIN canone_editorial.source src ON src.id=rights.source_id
 WHERE fi.exam_form_id=p_form_id
  AND rights.decision='TEST_ONLY' AND rights.permitted_scope='EPHEMERAL_CI'
  AND rights.editorial_reviewer<>rights.rights_reviewer
  AND rights.editorial_reviewer LIKE 'ci-%' AND rights.rights_reviewer LIKE 'ci-%'
  AND rights.valid_until>now() AND rights.reviewed_at<=now()
  AND rights.evidence_reference='tests/sql/f3_rec06_question_delivery_ephemeral.sql'
  AND rights.evidence_sha256=encode(sha256(convert_to(
        'CI_ORIGINAL_SYNTHETIC_REUSE_ONLY','UTF8')),'hex')
  AND src.key='alpha7-test' AND src.kind='interno'
  AND src.notes='CI_ORIGINAL_SYNTHETIC_REUSE_ONLY'
  AND EXISTS (SELECT 1 FROM canone_editorial.verification v
    WHERE v.content_item_id=ci.id AND v.source_id=src.id
    AND v.state='verificada' AND v.valid_until>now())
  AND rights.content_sha256=encode(sha256(convert_to(cv.payload::text||'|'||
    (SELECT string_agg(o.ordinal||':'||o.body,'|' ORDER BY o.ordinal_pos)
     FROM canone_learning.item_option o WHERE o.item_id=it.id),'UTF8')),'hex');
 IF v_total<>v_passed THEN
  RAISE EXCEPTION 'CONTENT_RIGHTS_RELEASE_HOLD' USING ERRCODE='23514'; END IF;
 RETURN canone_ops.exam_questions_rec06_ci(p_form_id);
END;
$fn$;
REVOKE ALL ON FUNCTION canone_ops.exam_questions(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION canone_ops.exam_questions(uuid) TO service_role;
COMMENT ON FUNCTION canone_ops.exam_questions(uuid) IS
 'Temporary CI-only rights wrapper: content version hash, two fake reviewer IDs, source, scope and expiry. No production grant.';
COMMIT;
