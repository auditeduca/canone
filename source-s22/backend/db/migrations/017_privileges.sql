-- =============================================================================
-- 017 · PRIVILÉGIOS POR PAPEL
-- -----------------------------------------------------------------------------
-- Os papéis existem desde a 001, mas NENHUM privilégio foi concedido. Um
-- papel sem privilégio não é uma restrição: é um erro de configuração que
-- só aparece em produção, quando o primeiro SELECT retorna
-- "permission denied for table" e ninguém sabe se é RLS ou privilégio.
--
-- A SEPARAÇÃO DE TRÊS FRONTEIRAS:
--
--   1. PRIVÍLEGIO (aqui)  → o papel pode sequer tocar na tabela?
--   2. RLS     (014)      → o papel pode ver ESTA LINHA?
--   3. VIEW    (013)      → o papel enxerga a ATRAVÉS de qual contrato?
--
-- As três precisam estar certainas. A 014 fecha a fronteira de linha, a 013
-- dá o contrato de leitura, e esta fecha a fronteira de objeto.
--
-- NENHUM papel público recebe acesso a learning.item_option: o GABARITO
-- não é público. A view v_public_item entrega o item sem a resposta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · SCHEMAS
-- -----------------------------------------------------------------------------
-- O schema 'public' do Postgres é REUTILIZADO como a área pública do
-- produto (já que ele é reservado). Tudo que existe dentro é nosso.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public, subscriber, taxonomy, editorial, norms, learning, commerce, admin, ops, audit
  TO canone_app, canone_public, canone_subscriber, canone_staff, canone_admin;

-- canone_app é o TRAMPOLIM: o backend conecta com ele e troca de papel por
-- requisição. Para isso ele precisa ser MEMBRO dos papéis de área.
-- canone_app é NOINHERIT (criado na 001) — ou seja, NÃO herda as
-- permissões automaticamente. Trocar de papel é sempre EXPLÍCITO.
GRANT canone_public, canone_subscriber, canone_staff, canone_admin TO canone_app;

-- -----------------------------------------------------------------------------
-- 2 · ÁREA PÚBLICA (sem login)
-- -----------------------------------------------------------------------------
-- O público lê conteúdo publicado e material de referência. Não lê dado de
-- aluno, não lê gabarito, não lê nada de usuário.
GRANT SELECT ON
  -- taxonomia
  taxonomy.knowledge_area, taxonomy.subject, taxonomy.subtopic, taxonomy.module,
  taxonomy.exam_edition, taxonomy.blueprint, taxonomy.item_placement,
  -- conteúdo (o RLS da 014 filtra por estado público)
  editorial.content_item, editorial.content_item_version, editorial.content_relation,
  editorial.content_type, editorial.content_type_version, editorial.field_definition,
  editorial.enumeration, editorial.enumeration_value, editorial.state_definition,
  editorial.source,
  -- normas
  norms.issuer, norms.norm, norms.norm_version, norms.norm_item,
  -- comercial
  commerce.plan
  TO canone_public;

-- As VIEWS são o contrato de leitura da área.
GRANT SELECT ON
  public.v_public_plan, public.v_public_subject, public.v_public_module,
  public.v_public_content, public.v_public_item
  TO canone_public;

-- O GABARITO NÃO É PÚBLICO. learning.item também não: o público usa a view.
-- learning.item_option NÃO entra na lista — é a resposta.
GRANT SELECT ON learning.item_option TO canone_staff, canone_admin;

-- TABELAS DE CATÁLOGO usadas pelas funções do motor de repetição.
-- Sem estes SELECT, learning.refresh_mastery e learning.due_items falham
-- com "permission denied" quando rodam como o papel do assinante.
-- (learning.review_event e learning.user_item_state NÃO entram aqui: são
--  dado de usuário, e ficam sob o RLS.)
GRANT SELECT ON learning.item, learning.item_subject, learning.explanation
  TO canone_subscriber, canone_staff, canone_admin;

-- O assinante recebe as ALTERNATIVAS pela view, que esconde o gabarito.
GRANT SELECT ON subscriber.v_item_options TO canone_subscriber;

-- -----------------------------------------------------------------------------
-- 3 · ÁREA DO ASSINANTE
-- -----------------------------------------------------------------------------
-- O assinante vê o que é DELE, e só o que é dele. A regra está em duas
-- camadas: o RLS (014) diz "user_id = ops.current_user_id()" e a view
-- (013) repete o filtro. Duas camadas, porque uma só pode ser esquecida.
GRANT SELECT ON
  identity.user_profile, identity.consent, identity.data_request,
  commerce.subscription, commerce.payment, commerce.entitlement
  TO canone_subscriber;

GRANT INSERT ON identity.consent, identity.data_request TO canone_subscriber;
GRANT UPDATE ON identity.user_profile TO canone_subscriber;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  learning.session, learning.review_event, learning.user_item_state,
  learning.mastery, learning.favorite, learning.note,
  learning.offline_pack, learning.study_plan
  TO canone_subscriber;

GRANT SELECT ON subscriber.v_my_progress, subscriber.v_my_due, subscriber.v_my_history, subscriber.v_my_state
  TO canone_subscriber;

-- -----------------------------------------------------------------------------
-- 4 · ÁREA ADMINISTRATIVA — STAFF
-- -----------------------------------------------------------------------------
-- Staff lê o que precisa para trabalhar. NÃO enxerga o progresso do aluno
-- por tabela: só pela porta única admin.read_user_progress_as, que exige
-- concessão e registra o acesso. Por isso learning.mastery e
-- learning.review_event NÃO entram na lista de SELECT do staff.
GRANT SELECT ON
  identity.account, identity.user_profile, identity.consent, identity.data_request,
  editorial.content_item, editorial.content_item_version, editorial.content_relation,
  editorial.verification, editorial.source, editorial.content_type, editorial.content_type_version,
  editorial.field_definition, editorial.enumeration, editorial.enumeration_value,
  editorial.state_definition, editorial.content_revision,
  taxonomy.knowledge_area, taxonomy.subject, taxonomy.subtopic, taxonomy.module,
  taxonomy.exam_edition, taxonomy.blueprint, taxonomy.item_placement,
  norms.issuer, norms.norm, norms.norm_version, norms.norm_item,
  commerce.plan, commerce.subscription, commerce.payment, commerce.entitlement,
  admin.moderation_queue, admin.support_access_grant, admin.support_access_log,
  admin.content_report, admin.user_note, admin.feature_flag,
  ops.setting, ops.integration, ops.webhook, ops.job_run,
  audit.audit_log
  TO canone_staff;

GRANT INSERT, UPDATE ON
  editorial.content_item, editorial.content_item_version, editorial.verification,
  editorial.content_revision,
  admin.support_access_grant, admin.moderation_queue, admin.user_note, admin.feature_flag,
  admin.content_report
  TO canone_staff;

GRANT INSERT ON audit.audit_log TO canone_staff;
-- audit.audit_log é append-only: UPDATE e DELETE ficam bloqueados pelo
-- trigger, e o privilégio nem é concedido.

GRANT SELECT ON admin.v_content_health, admin.v_user_overview, admin.v_user_mastery,
                  admin.v_audit_recent, admin.v_refused_claims
  TO canone_staff;

-- -----------------------------------------------------------------------------
-- 5 · ÁREA ADMINISTRATIVA — ADMIN
-- -----------------------------------------------------------------------------
-- Admin tem acesso pleno, exceto ao log de auditoria, que é append-only
-- por trigger. O admin também não "é" o aluno: a visão de usuário do
-- admin passa pela mesma concessão auditada.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  identity.account, identity.user_profile, identity.consent, identity.data_request,
  editorial.content_item, editorial.content_item_version, editorial.content_relation,
  editorial.verification, editorial.source, editorial.content_type, editorial.content_type_version,
  editorial.field_definition, editorial.enumeration, editorial.enumeration_value,
  editorial.state_definition, editorial.content_revision,
  taxonomy.knowledge_area, taxonomy.subject, taxonomy.subtopic, taxonomy.module,
  taxonomy.exam_edition, taxonomy.blueprint, taxonomy.item_placement,
  norms.issuer, norms.norm, norms.norm_version, norms.norm_item,
  learning.item, learning.item_option, learning.explanation, learning.item_subject,
  learning.session, learning.review_event, learning.user_item_state, learning.mastery,
  learning.favorite, learning.note, learning.offline_pack, learning.study_plan,
  learning.mock_exam, learning.mock_exam_item,
  commerce.plan, commerce.subscription, commerce.payment, commerce.entitlement,
  admin.moderation_queue, admin.support_access_grant, admin.support_access_log,
  admin.content_report, admin.user_note, admin.feature_flag,
  ops.setting, ops.integration, ops.webhook, ops.job_run
  TO canone_admin;

GRANT INSERT ON audit.audit_log TO canone_admin;
GRANT SELECT ON admin.v_content_health, admin.v_user_overview, admin.v_user_mastery,
                  admin.v_audit_recent, admin.v_refused_claims
  TO canone_admin;

-- -----------------------------------------------------------------------------
-- 6 · FUNÇÕES
-- -----------------------------------------------------------------------------
-- As funções de apoio precisam ser executáveis pelos papéis de área.
GRANT EXECUTE ON FUNCTION
  ops.current_user_id(), ops.current_area(), ops.current_request_id(), ops.is_staff()
  TO canone_public, canone_subscriber, canone_staff, canone_admin, canone_app;

-- A PORTA ÚNICA de leitura de dado de aluno por staff.
GRANT EXECUTE ON FUNCTION admin.read_user_progress_as(uuid, uuid, uuid)
  TO canone_staff, canone_admin;

-- As views de assinante chamam learning.due_items().
GRANT EXECUTE ON FUNCTION learning.due_items(uuid, uuid, int)
  TO canone_subscriber, canone_staff, canone_admin;

-- A correção é do servidor: o assinante manda a alternativa, recebe o veredito.
GRANT EXECUTE ON FUNCTION learning.grade_answer(uuid, text)
  TO canone_subscriber, canone_staff, canone_admin;
