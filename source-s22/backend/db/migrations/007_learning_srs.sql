-- =============================================================================
-- 007 · REPETIÇÃO ESPAÇADA, SESSÕES E PROGRESSO
-- -----------------------------------------------------------------------------
-- O NÚCLEO PEDAGÓGICO, e o lugar onde o modelo de 4 estados vira dados.
--
-- OS 4 ESTADOS (revisão de flashcard, autodeclarados pelo aluno)
--   facil    → acertou com consolidate  → intervalo longo
--   esforco  → acertou mas frágil       → intervalo curto
--   errei    → errou                     → revisão + Caderno de Erros
--   naosei   → nunca viu                 → trilha de ESTUDO, não de revisão
--
-- POR QUE "ERREI" E "NÃO SABIA" SÃO ESTADOS DIFERENTES
-- "Errei" = conteúdo visto e falhou → o item precisa de REVISÃO.
-- "Não sabia" = conteúdo nunca visto → o item precisa de ENSINO.
-- Tratar os dois como "errou" faz o aluno revisar o que nunca aprendeu —
-- o erro de método mais caro que existe neste produto.
--
-- FUNDIMENTO (a diferença que ninguém vê no código)
--   basis='sistema'       → gabarito conhecido (simulado). O estado é DERIVADO.
--   basis='autodeclarado' → só o aluno sabe (flashcard). O estado é DECLARADO.
-- Guardar os dois separadamente é o que impede o dashboard de mentir:
-- "taxa de acerto" só conta base='sistema'.
--
-- O LOG DE EVENTOS É A VERDADE. O ESTADO É UM CACHE DERIVADO.
-- Se o algoritmo de repetição mudar, os eventos continuam lá e o estado
-- pode ser recalculado. Por isso todo evento guarda algo ALGORITHM_VERSION.
-- =============================================================================

CREATE TYPE learning.review_grade AS ENUM ('facil','esforco','errei','naosei');
CREATE TYPE learning.review_basis AS ENUM ('sistema','autodeclarado');
CREATE TYPE learning.session_kind AS ENUM ('flashcard','simulado','pratica','duelo','revisao');

-- -----------------------------------------------------------------------------
-- SESSÃO DE ESTUDO
-- -----------------------------------------------------------------------------
CREATE TABLE learning.session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  kind          learning.session_kind NOT NULL,
  -- Onde a sessão foi iniciada (deep link, módulo, dashboard).
  origin        text,
  subject_id    uuid REFERENCES taxonomy.subject(id),
  module_id     uuid REFERENCES taxonomy.module(id),
  planned_count int,
  answered_count int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz,
  ended_at      timestamptz,
  duration_ms   int,
  -- Contexto de dispositivo/canal, para diagnóstico.
  client        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_session_user_started ON learning.session (user_id, started_at DESC);
CREATE INDEX ix_session_open ON learning.session (user_id) WHERE ended_at IS NULL;

-- -----------------------------------------------------------------------------
-- LOG DE EVENTOS — fonte da verdade do progresso
-- -----------------------------------------------------------------------------
CREATE TABLE learning.review_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES learning.item(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES learning.session(id) ON DELETE SET NULL,
  grade         learning.review_grade NOT NULL,
  basis         learning.review_basis NOT NULL,
  -- Só quando basis='sistema'. NULL quando o aluno declarou.
  correct       boolean,
  -- O que o aluno respondeu (alternativa escolhida, texto digitado).
  response      jsonb,
  -- Quanto tempo levou. Serve para o simulado adaptativo.
  duration_ms   int,
  -- Repetição: 1 = primeira vez, 2+ = revisões.
  repetition    int NOT NULL DEFAULT 1,
  -- Item do simulado, se houver.
  mock_exam_id  uuid REFERENCES learning.mock_exam(id) ON DELETE SET NULL,
  -- CRÍTICO: versão do algoritmo que processou este evento. Sem ela, mudar o
  -- algoritmo torna o histórico irreconstruível.
  algorithm_version text NOT NULL DEFAULT 'srs-v1',
  reviewed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_event_correct_basis CHECK (
    (basis = 'sistema' AND correct IS NOT NULL) OR
    (basis = 'autodeclarado' AND correct IS NULL)
  )
);
CREATE INDEX ix_review_event_user_item ON learning.review_event (user_id, item_id, reviewed_at DESC);
CREATE INDEX ix_review_event_session ON learning.review_event (session_id);
CREATE INDEX ix_review_event_user_time ON learning.review_event (user_id, reviewed_at DESC);

-- O log é imutável. Corrigir resposta errada de usuário é evento novo.
CREATE OR REPLACE FUNCTION learning.review_event_is_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'learning.review_event é append-only: crie um novo evento (reviewed_at='') em vez de editar'
    USING ERRCODE = '23514';
END $$;

-- A FUNÇÃO EXISTIA MAS O TRIGGER NÃO. Sem esta linha, o log de revisão —
-- a VERDADE do SRS — podia ser editado. A proteção que só existe no
-- código morto não é proteção.
CREATE TRIGGER trg_review_event_immutable
  BEFORE UPDATE OR DELETE ON learning.review_event
  FOR EACH ROW EXECUTE FUNCTION learning.review_event_is_immutable();

-- -----------------------------------------------------------------------------
-- ESTADO POR ITEM (cache derivado do log)
-- -----------------------------------------------------------------------------
CREATE TABLE learning.user_item_state (
  user_id         uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES learning.item(id) ON DELETE CASCADE,
  state           text NOT NULL DEFAULT 'nova'
                 CHECK (state IN ('nova','aprendendo','revisao','reaprendendo','suspensa')),
  -- Estabilidade: dias até a probabilidade de acerto cair a 90%.
  stability_days  numeric(8,3) NOT NULL DEFAULT 0,
  difficulty      numeric(5,2) NOT NULL DEFAULT 5.00,
  -- Data em que o item volta para revisão.
  due_at          timestamptz,
  last_review_at  timestamptz,
  last_grade      learning.review_grade,
  -- Ultimo intervalo aplicado, para exibir "você viu isso há N dias".
  last_interval_days int,
  repetitions     int NOT NULL DEFAULT 0,
  lapses          int NOT NULL DEFAULT 0,
  -- Fragmentação: o aluno acertou "com esforço" N vezes seguidas.
  fragile_streak  int NOT NULL DEFAULT 0,
  -- Sinaliza conteúdo frágil ao dashboard (≠ "errou").
  is_fragile      boolean GENERATED ALWAYS AS (fragile_streak >= 2) STORED,
  algorithm_version text NOT NULL DEFAULT 'srs-v1',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX ix_user_item_due ON learning.user_item_state (user_id, due_at)
  WHERE due_at IS NOT NULL;
CREATE INDEX ix_user_item_fragile ON learning.user_item_state (user_id)
  WHERE is_fragile;
CREATE INDEX ix_user_item_new ON learning.user_item_state (user_id)
  WHERE state = 'nova';

-- -----------------------------------------------------------------------------
-- MAESTRIA POR ASSUNTO — o que o dashboard mostra
-- -----------------------------------------------------------------------------
CREATE TABLE learning.mastery (
  user_id      uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  subject_id   uuid NOT NULL REFERENCES taxonomy.subject(id) ON DELETE CASCADE,
  -- Itens do assunto que o aluno já tocou.
  items_seen   int NOT NULL DEFAULT 0,
  items_mastered int NOT NULL DEFAULT 0,
  -- Itens frágil (acerto com esforço) — o que o dashboard destaca.
  items_fragile int NOT NULL DEFAULT 0,
  -- Itens "não sabia": nunca vistos. Não contam como erro.
  items_unseen int NOT NULL DEFAULT 0,
  -- Desempenho em base='sistema' (gabarito conhecido).
  correct_answers int NOT NULL DEFAULT 0,
  total_answers   int NOT NULL DEFAULT 0,
  accuracy        numeric(5,2) GENERATED ALWAYS AS (
                    CASE WHEN total_answers = 0 THEN NULL
                         ELSE round(correct_answers::numeric * 100 / total_answers, 2) END
                  ) STORED,
  -- Confiança no recorte: 0 a 1, cresce com mais evidência.
  confidence     numeric(4,3) NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_id)
);

-- -----------------------------------------------------------------------------
-- FAVORITOS, NOTAS E PACOTES OFFLINE
-- -----------------------------------------------------------------------------
CREATE TABLE learning.favorite (
  user_id        uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

CREATE TABLE learning.note (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  content_item_id uuid REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  subject_id      uuid REFERENCES taxonomy.subject(id),
  body            text NOT NULL,
  -- Ancora dentro do item (bloco), para nota contextual.
  anchor          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_note_user ON learning.note (user_id, updated_at DESC);

CREATE TABLE learning.offline_pack (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  label         text NOT NULL,
  subject_id    uuid REFERENCES taxonomy.subject(id),
  -- Itens incluídos (materialized para o client).
  item_ids      uuid[] NOT NULL DEFAULT '{}',
  bytes_estimate bigint,
  downloaded_at timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_offline_pack_user ON learning.offline_pack (user_id) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- PLANO DE ESTUDO
-- -----------------------------------------------------------------------------
CREATE TABLE learning.study_plan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  exam_edition_id uuid REFERENCES taxonomy.exam_edition(id),
  -- Objetivo declarado: horas/dia, data-alvo, prioridades.
  target_date  date,
  daily_minutes int NOT NULL DEFAULT 45,
  -- Recorte: quais assuntos ele quer cobrir.
  focus        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Plano pode se reescrever sozinho quando o desempenho muda.
  is_adaptive  boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_until  timestamptz,
  -- Versão do gerador: para reprocessar.
  generator_version text NOT NULL DEFAULT 'plan-v1'
);
CREATE INDEX ix_study_plan_user ON learning.study_plan (user_id, generated_at DESC);

-- -----------------------------------------------------------------------------
-- DUELO DE QUESTÕES (módulo competitive)
-- -----------------------------------------------------------------------------
CREATE TABLE learning.duel (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dois participantes; pode ser contra a máquina.
  host_user_id  uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  guest_user_id uuid REFERENCES identity.account(id) ON DELETE CASCADE,
  subject_id    uuid REFERENCES taxonomy.subject(id),
  status        text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','finalizado','abandonado')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);
