-- =============================================================================
-- 001 · SCHEMAS, PAPÉIS E EXTENSÕES
-- -----------------------------------------------------------------------------
-- Organiza por domínio, não por camada. Um módulo do produto (flashcards,
-- simulados) atravessa várias tabelas; um domínio (editorial, learning)
-- pertence a vários módulos. Organizar por camada obrigaria a mesma
-- informação a mudar de lugar a cada feature nova.
-- =============================================================================

-- pgcrypto NÃO é necessário: gen_random_uuid() é função de núcleo desde o
-- PostgreSQL 13, e sha256(bytea) existe desde o 11. Menos extensão = menos
-- divergência entre ambiente de teste e de produção.
CREATE EXTENSION IF NOT EXISTS citext;         -- e-mail sem diferenciar maiúsculo
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- busca textual em título/resumo
CREATE EXTENSION IF NOT EXISTS btree_gist;     -- exclusões de agenda

-- -----------------------------------------------------------------------------
-- PAPÉIS DE BANCO
-- -----------------------------------------------------------------------------
-- O backend NUNCA conecta com superusuário. Ele abre a conexão e troca de
-- papel por requisição (SET LOCAL ROLE), deixando o banco decidir o que cada
-- área enxerga. Um bug na aplicação vira, no máximo, acesso indevido dentro
-- do papel errado — não acesso total.
--
--   canone_app        → papel técnico do backend; só executa, não decide
--   canone_public     → área pública (sem login)
--   canone_subscriber → área do assinante (dados próprios)
--   canone_staff      → área administrativa: moderação e suporte
--   canone_admin      → administração plena
--   canone_migrator   → DDL; usado só pelo runner de migration
-- -----------------------------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['canone_app','canone_public','canone_subscriber',
                           'canone_staff','canone_admin','canone_migrator'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', r);
    END IF;
  END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS identity;    -- contas, papéis, consentimento LGPD
CREATE SCHEMA IF NOT EXISTS editorial;   -- metamodelo, conteúdo, verificação
CREATE SCHEMA IF NOT EXISTS taxonomy;    -- blueprint do edital, assuntos
CREATE SCHEMA IF NOT EXISTS norms;       -- corpo normativo (CPC/NBC/ITP)
CREATE SCHEMA IF NOT EXISTS learning;    -- itens de estudo, SRS, progresso
CREATE SCHEMA IF NOT EXISTS commerce;    -- planos, assinaturas, pagamentos
CREATE SCHEMA IF NOT EXISTS admin;       -- auditoria, moderação, suporte
CREATE SCHEMA IF NOT EXISTS ops;         -- settings, flags, integrações, jobs
CREATE SCHEMA IF NOT EXISTS audit;       -- log append-only, isolado

-- As TRÊS ÁREAS DO PRODUTO têm schema próprio. Uma área é um contrato de
-- leitura: o que a área pública enxerga é exatamente o que está nas views
-- do schema public. Nada mais.
CREATE SCHEMA IF NOT EXISTS public;      -- área pública (sem login)
CREATE SCHEMA IF NOT EXISTS subscriber;  -- área do assinante
-- 'public' já existe no Postgres (reserved). Usa-se o schema 'public' para
-- a área pública e um schema dedicado para as demais.

COMMENT ON SCHEMA editorial IS
  'Metamodelo editorial + conteúdo versionado. O conteúdo É o produto: por isso a verificação é dimensão de primeira classe, não um boolean.';
COMMENT ON SCHEMA learning IS
  'Runtime de estudo: itens, agendamento de repetição espaçada e progresso do aluno.';
COMMENT ON SCHEMA audit IS
  'Log append-only com encadeamento de hash. Isolado do schema admin para que nem o admin edite por engano.';

-- -----------------------------------------------------------------------------
-- CONTEXTO DE REQUISIÇÃO
-- -----------------------------------------------------------------------------
-- O backend injeta, por transação, quem é o usuário e qual é a área ativa.
-- As políticas de RLS leem essas variáveis. Sem elas, RLS não tem como
-- distinguir "o próprio aluno" de "outro aluno".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION ops.current_area() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_area', true), ''), 'public')
$$;

CREATE OR REPLACE FUNCTION ops.current_request_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.request_id', true), '')
$$;

CREATE OR REPLACE FUNCTION ops.is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT ops.current_area() IN ('staff','admin')
$$;

COMMENT ON FUNCTION ops.current_user_id() IS
  'ID do usuário da requisição. NULL = anônimo. Injetado via SET LOCAL.';
