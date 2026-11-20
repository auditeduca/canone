-- =============================================================================
-- 004 · TAXONOMIA E BLUEPRINT DO EDITAL
-- -----------------------------------------------------------------------------
-- O edital define 13 conteúdos programáticos, cada um com subtópicos A, B, C…
-- O produto precisa mapear conteúdo → assunto → subtópico para:
--   · medir progresso por assunto (não por tempo de tela)
--   · montar simulados com a mesma proporção do edital
--   · dizer ao aluno "você está fraco em X", que é actionable
--
-- A taxonomia é VERSIONÁVEL por edição. O edital de 2026 não é o de 2027.
-- Guardar o blueprint histórico permite comparar edições — e responder
-- "esse conteúdo já caiu?".
-- =============================================================================

-- ÁREA DE CONHECIMENTO — primeira classe, não valor de enumeração.
-- São os 13 assuntos do edital; têm identidade própria, ordem oficial e
-- podem carregar metadados (peso, Transient) que uma enumeração não comporta.
CREATE TABLE taxonomy.knowledge_area (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  -- Ordem no edital. É a ordem que o aluno espera ver.
  ordinal     int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE taxonomy.subject (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  -- Área de conhecimento do edital (13 assuntos).
  area_key    text NOT NULL REFERENCES taxonomy.knowledge_area(key)
              DEFERRABLE INITIALLY DEFERRED,
  -- Chave do tipo de conteúdo que materializa este assunto.
  content_type_key text REFERENCES editorial.content_type(key),
  description text,
  ordinal     int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE taxonomy.subject IS
  'Assunto do conteúdo programático. É a unidade de recorte do produto: todo item aponta para um.';

CREATE TABLE taxonomy.subtopic (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES taxonomy.subject(id) ON DELETE CASCADE,
  key         text NOT NULL,
  label       text NOT NULL,
  description text,
  ordinal     int NOT NULL DEFAULT 0,
  UNIQUE (subject_id, key)
);
COMMENT ON TABLE taxonomy.subtopic IS
  'Subtópico A/B/C… do edital. A letra é o identificador oficial — não renumerar.';

CREATE TABLE taxonomy.exam_edition (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,          -- '2026.1'
  label           text NOT NULL,
  edition_number  int NOT NULL,
  year            int NOT NULL,
  -- Datas conferidas na fonte oficial (CFC/FGV).
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  -- Prazo máximo de pagamento do boleto (posterior ao encerramento das
  -- inscrições). É o que o candidato realmente precisa saber.
  payment_deadline      date,
  application_date date NOT NULL,
  application_start_time time NOT NULL DEFAULT '10:00',
  application_end_time   time NOT NULL DEFAULT '14:00',
  modality        text NOT NULL DEFAULT 'presencial' CHECK (modality IN ('presencial','remota')),
  question_count  int NOT NULL DEFAULT 50,
  options_per_question int NOT NULL DEFAULT 4,
  passing_score   int NOT NULL DEFAULT 25,
  passing_percent numeric(5,2) NOT NULL DEFAULT 50.00,
  registration_fee_cents int,
  source_id       uuid REFERENCES editorial.source(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE taxonomy.exam_edition IS
  'Edição do exame. Datas e taxas são copiadas da fonte e revisadas a cada publicação.';

CREATE TABLE taxonomy.blueprint (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_edition_id uuid NOT NULL REFERENCES taxonomy.exam_edition(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES taxonomy.subject(id),
  -- Peso relativo na prova (soma 100 por edição).
  weight          numeric(5,2) NOT NULL DEFAULT 0,
  expected_questions int,
  UNIQUE (exam_edition_id, subject_id)
);

CREATE TABLE taxonomy.item_placement (
  content_item_id uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  exam_edition_id uuid NOT NULL REFERENCES taxonomy.exam_edition(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES taxonomy.subject(id),
  subtopic_id     uuid REFERENCES taxonomy.subtopic(id),
  -- Onde este item pode cair. Um item que serve a 2026.3 pode servir a 2027.1.
  weight          numeric(5,2) NOT NULL DEFAULT 0,
  is_forecast     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (content_item_id, exam_edition_id)
);
CREATE INDEX ix_item_placement_edition ON taxonomy.item_placement (exam_edition_id, subject_id);

-- Módulos do produto (os 26) — a camada de produto, distinta do edital.
CREATE TABLE taxonomy.module (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  short_name  text NOT NULL,
  description text NOT NULL,
  phase       text NOT NULL CHECK (phase IN ('Estudar','Praticar','Evoluir','Aprovar')),
  ordinal     int NOT NULL,
  content_type_key text REFERENCES editorial.content_type(key),
  icon_key    text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE taxonomy.module IS
  'Os módulos do ecossistema. Ligam o produto (o que o usuário vê) ao edital (o que a banca cobra).';

CREATE TABLE taxonomy.module_subject (
  module_id uuid NOT NULL REFERENCES taxonomy.module(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES taxonomy.subject(id) ON DELETE CASCADE,
  PRIMARY KEY (module_id, subject_id)
);
