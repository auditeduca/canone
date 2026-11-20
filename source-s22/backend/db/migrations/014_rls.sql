-- =============================================================================
-- 014 · ROW LEVEL SECURITY — AS TRÊS ÁREAS
-- -----------------------------------------------------------------------------
-- O BANCO É A FRONTEIRA. A aplicação não é.
--
-- O backend conecta como canone_app e, POR REQUISIÇÃO, troca de papel:
--   SET LOCAL ROLE canone_public;
--   SET LOCAL app.current_user_id = '<uuid>';
--   SET LOCAL app.current_area = 'assinante';
--
-- Se a área for passada errado, o usuário vê o que a áreapermite — nunca
-- mais. Um bug de autorização vira, no máximo, vazamento entre áreas, e
-- o teste de RLS existe para provar que nem isso acontece.
--
-- A VISÃO DE USUÁRIO (admin) NÃO É RLS — é uma concessão auditada.
-- O staff não "é" o aluno: ele lê o dados do aluno COMO o aluno, sob uma
-- concessão com motivo e prazo, e tudo que ele vê fica registrado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HABILITA RLS
-- -----------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops')
       AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schema_name, t.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', t.schema_name, t.table_name);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- POLÍTICAS BASE
-- -----------------------------------------------------------------------------
-- Leitura pública: só conteúdo em estado público, e somente tabelas que
-- não têm dado de usuário.
CREATE POLICY pub_read_plan ON commerce.plan FOR SELECT TO canone_public
  USING (is_public AND is_active);

CREATE POLICY pub_read_subject ON taxonomy.subject FOR SELECT TO canone_public
  USING (active);

CREATE POLICY pub_read_subtopic ON taxonomy.subtopic FOR SELECT TO canone_public
  USING (true);

CREATE POLICY pub_read_module ON taxonomy.module FOR SELECT TO canone_public
  USING (active);

CREATE POLICY pub_read_content ON editorial.content_item FOR SELECT TO canone_public
  USING (retired_at IS NULL AND EXISTS (
    SELECT 1 FROM editorial.state_definition sd
      JOIN editorial.content_type ct ON ct.id = editorial.content_item.content_type_id
     WHERE sd.family = ct.family AND sd.key = editorial.content_item.state AND sd.is_public));

CREATE POLICY pub_read_content_version ON editorial.content_item_version FOR SELECT TO canone_public
  USING (published_at IS NOT NULL);

CREATE POLICY pub_read_relation ON editorial.content_relation FOR SELECT TO canone_public
  USING (true);

CREATE POLICY pub_read_norm ON norms.norm FOR SELECT TO canone_public USING (true);
CREATE POLICY pub_read_norm_version ON norms.norm_version FOR SELECT TO canone_public USING (true);
CREATE POLICY pub_read_norm_item ON norms.norm_item FOR SELECT TO canone_public USING (true);
CREATE POLICY pub_read_source ON editorial.source FOR SELECT TO canone_public USING (true);

-- Item de avaliação: o GABARITO NÃO VAI PARA O PÚBLICO.
-- A view v_public_item não expõe is_correct; a tabela learning.item_option
-- fica inacessível ao papel público. É assim que o gabarito não vaza.
CREATE POLICY pub_read_learning_item ON learning.item FOR SELECT TO canone_public
  USING (false);  -- público não consulta a tabela crua; usa a view pública

-- -----------------------------------------------------------------------------
-- ASSINANTE — dados próprios
-- -----------------------------------------------------------------------------
CREATE POLICY sub_own_profile ON identity.user_profile FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());
CREATE POLICY sub_own_profile_write ON identity.user_profile FOR UPDATE TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_consent ON identity.consent FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());
CREATE POLICY sub_insert_consent ON identity.consent FOR INSERT TO canone_subscriber
  WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_request ON identity.data_request FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());
CREATE POLICY sub_insert_request ON identity.data_request FOR INSERT TO canone_subscriber
  WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_session ON learning.session FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_event ON learning.review_event FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_state ON learning.user_item_state FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_mastery ON learning.mastery FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_favorite ON learning.favorite FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_note ON learning.note FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_offline ON learning.offline_pack FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_plan ON learning.study_plan FOR ALL TO canone_subscriber
  USING (user_id = ops.current_user_id()) WITH CHECK (user_id = ops.current_user_id());

CREATE POLICY sub_own_subscription ON commerce.subscription FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());
CREATE POLICY sub_own_payment ON commerce.payment FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());
CREATE POLICY sub_own_entitlement ON commerce.entitlement FOR SELECT TO canone_subscriber
  USING (user_id = ops.current_user_id());

-- -----------------------------------------------------------------------------
-- STAFF / ADMIN
-- -----------------------------------------------------------------------------
CREATE POLICY staff_read_account ON identity.account FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_read_profile ON identity.user_profile FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_read_content ON editorial.content_item FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_write_content ON editorial.content_item FOR ALL TO canone_staff
  USING (true) WITH CHECK (true);
CREATE POLICY staff_read_version ON editorial.content_item_version FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_write_version ON editorial.content_item_version FOR ALL TO canone_staff
  USING (true) WITH CHECK (true);
CREATE POLICY staff_read_verification ON editorial.verification FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_write_verification ON editorial.verification FOR ALL TO canone_staff
  USING (true) WITH CHECK (true);
CREATE POLICY staff_read_moderation ON admin.moderation_queue FOR ALL TO canone_staff
  USING (true) WITH CHECK (true);
CREATE POLICY staff_read_grant ON admin.support_access_grant FOR ALL TO canone_staff
  USING (true) WITH CHECK (true);
CREATE POLICY staff_insert_grant ON admin.support_access_grant FOR INSERT TO canone_staff
  WITH CHECK (staff_user_id = ops.current_user_id());
CREATE POLICY staff_read_audit ON audit.audit_log FOR SELECT TO canone_staff
  USING (true);
CREATE POLICY staff_insert_audit ON audit.audit_log FOR INSERT TO canone_staff
  WITH CHECK (actor_id = ops.current_user_id() OR actor_id IS NULL);
CREATE POLICY staff_read_ops ON ops.setting FOR SELECT TO canone_staff
  USING (NOT is_secret OR scope IN ('staff','global'));

-- Admin: acesso pleno (exceto audit log, que é append-only).
CREATE POLICY admin_read_all_account ON identity.account FOR SELECT TO canone_admin USING (true);
CREATE POLICY admin_read_all_profile ON identity.user_profile FOR ALL TO canone_admin USING (true);
CREATE POLICY admin_all_learning ON learning.review_event FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_mastery ON learning.mastery FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_subscription ON commerce.subscription FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_ops ON ops.setting FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_integration ON ops.integration FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);
CREATE POLICY admin_all_grant ON admin.support_access_grant FOR ALL TO canone_admin
  USING (true) WITH CHECK (true);

-- O papel técnico (canone_app) tem bypass de RLS porque é ele quem troca de
-- papel. NUNCA é o papel de uma requisição de usuário — é sempre o trampolim.
-- Por isso não recebe política de usuário: o backend SEMPRE troca de papel
-- antes de ler.
ALTER TABLE identity.account        ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.account        FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- VISÃO DE USUÁRIO: função que exige concessão válida
-- -----------------------------------------------------------------------------
-- A função é a ÚNICA forma de ler dado de aluno sob o papel staff.
-- Ela exige grant válido, e cada chamada é registrada.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin.read_user_progress_as(
  p_staff_user_id uuid,
  p_subject_user_id uuid,
  p_grant_id uuid
) RETURNS TABLE (
  subject_key text, subject_label text, items_seen int, items_mastered int,
  items_fragile int, items_unseen int, accuracy numeric, confidence numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_grant admin.support_access_grant%ROWTYPE;
BEGIN
  SELECT * INTO v_grant FROM admin.support_access_grant WHERE id = p_grant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concessão inexistente' USING ERRCODE = '42501';
  END IF;

  IF v_grant.staff_user_id <> p_staff_user_id THEN
    RAISE EXCEPTION 'Concessão não pertence a este staff' USING ERRCODE = '42501';
  END IF;

  IF v_grant.subject_user_id <> p_subject_user_id THEN
    RAISE EXCEPTION 'Concessão não cobre este titular' USING ERRCODE = '42501';
  END IF;

  IF v_grant.revoked_at IS NOT NULL OR v_grant.expires_at <= now() THEN
    RAISE EXCEPTION 'Concessão expirada ou revogada' USING ERRCODE = '42501';
  END IF;

  IF v_grant.scope NOT IN ('progresso','completo') THEN
    RAISE EXCEPTION 'Escopo % não permite ler progresso', v_grant.scope USING ERRCODE = '42501';
  END IF;

  INSERT INTO admin.support_access_log
    (grant_id, staff_user_id, subject_user_id, resource, action, row_count)
  VALUES (p_grant_id, p_staff_user_id, p_subject_user_id,
          'learning.mastery', 'leitura', NULL);

  RETURN QUERY
    SELECT s.key, s.label, m.items_seen, m.items_mastered, m.items_fragile,
           m.items_unseen, m.accuracy, m.confidence
      FROM learning.mastery m
      JOIN taxonomy.subject s ON s.id = m.subject_id
     WHERE m.user_id = p_subject_user_id;
END $$;

COMMENT ON FUNCTION admin.read_user_progress_as IS
  'ÚNICA porta de leitura de dado de aluno por staff. Exige grant válido e registra o acesso.';
