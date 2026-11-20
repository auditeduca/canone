-- F3-REC-06 synthetic test-only editorial release. PostgreSQL 17 ephemeral CI ONLY.
-- Reuses S22 content_item, content_item_version, item_option, source and verification.
-- No production migration, no official editorial materials, no keys delivered.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $gate$ BEGIN
 IF to_regclass('canone_control.migration_catalog') IS NOT NULL THEN
  RAISE EXCEPTION 'REFUSE_SHARED_SOURCE_DB' USING ERRCODE='23514'; END IF;
 IF to_regclass('canone_learning.exam_form_item') IS NULL
 OR to_regclass('canone_editorial.verification') IS NULL
 OR to_regprocedure('canone_ops.exam_catalog()') IS NULL
 THEN RAISE EXCEPTION 'REQUIRES_F3_EPHEMERAL_PG17' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM canone_editorial.source WHERE key='alpha7-test' AND title='SYNTHETIC - not publishable')
 THEN RAISE EXCEPTION 'REQUIRES_CI_SYNTHETIC_SEED' USING ERRCODE='23514'; END IF;
END $gate$;

-- These keys are only used in the isolated CI source and verification record.
-- This token is NOT evidence of real-world publication or rights.
UPDATE canone_editorial.source
 SET kind='interno',notes='CI_ORIGINAL_SYNTHETIC_REUSE_ONLY',
 content_sha256=repeat('a',64),consulted_at=now()
 WHERE key='alpha7-test' AND title='SYNTHETIC - not publishable';
INSERT INTO canone_editorial.content_item_version(id,content_item_id,version,payload,published_at)
VALUES
 ('00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000008',1,
  '{"stem":"Questão fictícia contábil um para teste?"}'::jsonb,now()),
 ('00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000009',1,
  '{"stem":"Questão fictícia contábil dois para teste?"}'::jsonb,now());
UPDATE canone_editorial.content_item SET current_version_id =
 CASE id WHEN '00000000-0000-4000-8000-000000000008'::uuid
 THEN '00000000-0000-4000-8000-000000000020'::uuid
 ELSE '00000000-0000-4000-8000-000000000021'::uuid END
WHERE id IN ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000009');
INSERT INTO canone_learning.item_option(item_id,ordinal,body,ordinal_pos)
VALUES
 ('00000000-0000-4000-8000-000000000011','A','Opção A sintética',1),
 ('00000000-0000-4000-8000-000000000011','B','Opção B sintética',2),
 ('00000000-0000-4000-8000-000000000012','A','Opção A sintética',1),
 ('00000000-0000-4000-8000-000000000012','B','Opção B sintética',2);
INSERT INTO canone_editorial.verification(content_item_id,state,method,source_id,
 source_quote,verified_at,valid_until,notes)
SELECT i.id,'verificada','conferencia_dupla',s.id,
 'CI synthetic original written for this isolated integration test',
 now(),now()+interval '1 day','CI_LICENSE_SYNTHETIC_ONLY'
FROM canone_editorial.content_item i
CROSS JOIN canone_editorial.source s
WHERE i.id IN ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000009')
AND s.key='alpha7-test';

-- A deliberately narrow SELECT projection; never return any payload JSON or option flags.
-- Deny the ENTIRE form if any item is unverified, unlicensed or missing alternatives.
CREATE OR REPLACE FUNCTION canone_ops.exam_questions(p_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_expected integer;v_eligible integer;v_form jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_JWT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT canone_ops.can_use_feature(v_uid,'cfc.exam') THEN
  RAISE EXCEPTION 'FEATURE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer INTO v_expected FROM canone_learning.exam_form_item fi
  WHERE fi.exam_form_id=p_form_id;
 IF v_expected<1 OR v_expected>100
  OR NOT EXISTS(
   SELECT 1 FROM canone_learning.exam_form f
    JOIN canone_taxonomy.exam_track t ON t.id=f.exam_track_id
    JOIN canone_taxonomy.exam_edition e ON e.id=t.exam_edition_id
    JOIN canone_learning.answer_key k ON k.exam_form_id=f.id AND k.status='definitivo'
   WHERE f.id=p_form_id AND e.status='realizada')
 THEN RAISE EXCEPTION 'FORM_NOT_RELEASED' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer INTO v_eligible
 FROM canone_learning.exam_form_item fi
 JOIN canone_learning.item it ON it.id=fi.item_id
 JOIN canone_editorial.content_item ci ON ci.id=it.content_item_id
 JOIN canone_editorial.content_item_version cv
  ON cv.id=ci.current_version_id AND cv.content_item_id=ci.id
 WHERE fi.exam_form_id=p_form_id
 AND ci.retired_at IS NULL AND cv.published_at IS NOT NULL
 AND jsonb_typeof(cv.payload->'stem')='string'
 AND length(trim(cv.payload->>'stem')) BETWEEN 3 AND 2000
 AND EXISTS (
  SELECT 1 FROM canone_editorial.verification v
  JOIN canone_editorial.source src ON src.id=v.source_id
  WHERE v.content_item_id=ci.id AND v.state='verificada'
   AND v.verified_at IS NOT NULL AND v.valid_until>now()
   AND v.notes='CI_LICENSE_SYNTHETIC_ONLY'
   AND src.key='alpha7-test' AND src.kind='interno'
   AND src.notes='CI_ORIGINAL_SYNTHETIC_REUSE_ONLY'
   AND src.content_sha256=repeat('a',64)
 )
 AND (SELECT count(*) FROM canone_learning.item_option opt
      WHERE opt.item_id=it.id AND length(trim(opt.body)) BETWEEN 1 AND 500
      AND opt.ordinal IN ('A','B','C','D','E')) BETWEEN 2 AND 5;
 IF v_expected<>v_eligible
 THEN RAISE EXCEPTION 'CONTENT_RIGHTS_OR_COMPLETENESS_HOLD' USING ERRCODE='23514'; END IF;
 SELECT jsonb_build_object('id',p_form_id,'questions',
   COALESCE(jsonb_agg(
      jsonb_build_object(
        'ordinal',fi.ordinal,'stem',cv.payload->>'stem',
        'options',(
          SELECT jsonb_agg(jsonb_build_object('code',o.ordinal,'text',o.body)
                    ORDER BY o.ordinal_pos)
          FROM canone_learning.item_option o WHERE o.item_id=it.id))
      ORDER BY fi.ordinal),'[]'::jsonb)) INTO v_form
 FROM canone_learning.exam_form_item fi
 JOIN canone_learning.item it ON it.id=fi.item_id
 JOIN canone_editorial.content_item ci ON ci.id=it.content_item_id
 JOIN canone_editorial.content_item_version cv ON cv.id=ci.current_version_id
 WHERE fi.exam_form_id=p_form_id;
 RETURN v_form;
END;
$fn$;
REVOKE ALL ON FUNCTION canone_ops.exam_questions(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION canone_ops.exam_questions(uuid) TO service_role;
COMMIT;
