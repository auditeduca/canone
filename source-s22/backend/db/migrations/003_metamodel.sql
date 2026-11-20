-- =============================================================================
-- 003 · METAMODELO EDITORIAL
-- -----------------------------------------------------------------------------
-- O PROBLEMA QUE ESTE METAMODELO RESOLVE
-- O ecossistema tem 26 módulos e vai ganhar mais. Se cada módulo virar um
-- par de tabelas (question/flashcard/lesson/case/map/...), o banco vira 60
-- tabelas que divergem entre si, e cada tela nova exige DDL.
--
-- A RESPOSTA
-- Um metamodelo: "conteúdo" é um único conceito com TIPO. O tipo define
-- campos; o item é uma instância; a versão é o snapshot imutável.
-- Consequência: adicionar um módulo = inserir uma linha em content_type,
-- não escrever migração.
--
-- MAS — e este é o trade-off honesto — JSONB puro não dá integridade
-- referencial. Por isso existe uma PROJEÇÃO RELACIONAL das coisas que o
-- banco precisa de verdade em join: item, alternativa, explicação, citação
-- normativa. A projeção é mantida por TRIGGER a partir do payload, então
-- as duas nunca divergem — e isso é verificável por teste.
--
-- A DIMENSÃO QUE FAZ DIFERENÇA NESTE PRODUTO
-- `verification` não é um boolean. É uma ENTIDADE com estado, método, fonte,
-- citação textual e VALIDADE. Porque norma técnica muda: a verificação que
-- valeu ontem pode estar vencida hoje. O banco precisa saber disso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CATÁLOGO DE TIPOS
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.content_type (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  -- Família agrupa tipos com o mesmo workflow (itens de avaliação, material
  -- de estudo, referências normativas). O workflow é herdado da família.
  family      text NOT NULL CHECK (family IN ('avaliacao','estudo','referencia','editorial')),
  description text,
  -- Tipos que descrevem relações (ex.: "citação de norma") não têm instâncias
  -- próprias: usam content_relation.
  is_relation_type boolean NOT NULL DEFAULT false,
  -- Se true, o tipo exige verificação vigente para ser publicado.
  requires_verification boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz,
  UNIQUE (key, retired_at)
);
COMMENT ON TABLE editorial.content_type IS
  'Catálogo de tipos de conteúdo. Adicionar módulo = inserir aqui, não criar tabela.';

CREATE TABLE editorial.content_type_version (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type_id  uuid NOT NULL REFERENCES editorial.content_type(id) ON DELETE CASCADE,
  version          int  NOT NULL,
  definition       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid REFERENCES identity.account(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type_id, version)
);

-- -----------------------------------------------------------------------------
-- CAMPOS DO TIPO — relacional porque o banco precisa consultá-los
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.field_definition (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type_version_id uuid NOT NULL REFERENCES editorial.content_type_version(id) ON DELETE CASCADE,
  key                    text NOT NULL,
  label                  text NOT NULL,
  data_kind              text NOT NULL CHECK (data_kind IN
                         ('texto','texto_longo','inteiro','decimal','booleano','data','data_hora',
                          'enumeracao','referencia','json','slug')),
  required               boolean NOT NULL DEFAULT false,
  -- Referência a qual content_type quando data_kind='referencia'.
  ref_content_type_key   text REFERENCES editorial.content_type(key),
  enumeration_key        text,
  validations            jsonb NOT NULL DEFAULT '{}'::jsonb,
  help_text              text,
  ordinal                int NOT NULL DEFAULT 0,
  -- Campo de busca/ordenação: entra em índice.
  is_indexed             boolean NOT NULL DEFAULT false,
  UNIQUE (content_type_version_id, key)
);
COMMENT ON COLUMN editorial.field_definition.data_kind IS
  'Kinds controlados pelo metamodelo. Campo novo não vira coluna nova — vira linha.';

-- -----------------------------------------------------------------------------
-- VOCABULÁRIOS CONTROLADOS
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.enumeration (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  is_multi    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- FK real: um campo que aponta para uma enumeração INEXISTENTE é erro de
-- digitação, e o banco precisa recusar. Sem esta FK, o gate de contrato
-- era a única defesa — e o gate não roda em toda escrita.
-- (ALTER e não REFERENCES na criação: a tabela da enumeração é criada
--  DEPOIS deste ponto no arquivo.)
ALTER TABLE editorial.field_definition
  ADD CONSTRAINT fk_field_definition_enumeration
  FOREIGN KEY (enumeration_key) REFERENCES editorial.enumeration(key);

CREATE TABLE editorial.enumeration_value (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enumeration_key text NOT NULL REFERENCES editorial.enumeration(key) ON DELETE CASCADE,
  key            text NOT NULL,
  label          text NOT NULL,
  -- Payload livre para a semântica do valor (ex.: cor, ordem, algoritmo).
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordinal        int NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  UNIQUE (enumeration_key, key)
);

-- -----------------------------------------------------------------------------
-- WORKFLOW
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.state_definition (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family      text NOT NULL,
  key         text NOT NULL,
  label       text NOT NULL,
  is_initial  boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,
  -- Publicar exige verificação vigente.
  requires_verification boolean NOT NULL DEFAULT false,
  -- Estado visível ao público (site, catálogo).
  is_public   boolean NOT NULL DEFAULT false,
  -- Estado que significa "rejeitado/recusado" — entra no relatório de
  -- alegações recusadas, que é parte do produto.
  is_refusal  boolean NOT NULL DEFAULT false,
  color_token text,
  ordinal     int NOT NULL DEFAULT 0,
  UNIQUE (family, key)
);
COMMENT ON COLUMN editorial.state_definition.is_refusal IS
  'Estados de recusa alimentam a página pública de integridade: o que a marca recusou.';

-- -----------------------------------------------------------------------------
-- TRANSIÇÕES DE ESTADO — dado, não código
-- -----------------------------------------------------------------------------
-- Uma função que sabe os caminhos válidos só consegue mudá-la com DDL.
-- Uma tabela muda com um INSERT — e o gate pode conferir a tabela inteira.
-- O que NÃO existe na tabela é proibido. Estado inicial não tem entrada.
CREATE TABLE editorial.state_transition (
  family     text NOT NULL,
  from_state text NOT NULL,
  to_state   text NOT NULL,
  -- Condição exigida para a transição. 'verificacao_vigente' = só passa
  -- se o item tem verificação de fonte em dia na data.
  requires   text NOT NULL DEFAULT ''
             CHECK (requires IN ('','verificacao_vigente')),
  label      text,
  PRIMARY KEY (family, from_state, to_state),
  FOREIGN KEY (family, from_state) REFERENCES editorial.state_definition(family, key) ON DELETE CASCADE,
  FOREIGN KEY (family, to_state)   REFERENCES editorial.state_definition(family, key) ON DELETE CASCADE
);
COMMENT ON TABLE editorial.state_transition IS
  'Caminhos de estado permitidos. O que não está aqui é proibido — a trigger de transição recusa qualquer caminho fora da tabela.';

-- -----------------------------------------------------------------------------
-- INSTÂNCIAS
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.content_item (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type_id      uuid NOT NULL REFERENCES editorial.content_type(id),
  content_type_version_id uuid NOT NULL REFERENCES editorial.content_type_version(id),
  -- Slug estável, legível, único por tipo. É o que o cliente cita.
  key                  text NOT NULL,
  state                text NOT NULL,
  -- Aponta para a versão corrente (criado depois; FK adicionada via ALTER).
  current_version_id   uuid,
  -- Rótulo curto para listagens. Desnormalizado de propósito: listar 10 mil
  -- itens não deve ler o payload inteiro.
  title                text NOT NULL,
  summary              text,
  -- Recortes do edital: o item aponta para assunto e subtópico.
  subject_id           uuid,
  subtopic_id          uuid,
  -- Peso na trilha e ordem de exibição dentro do módulo.
  ordinal              int NOT NULL DEFAULT 0,
  estimated_seconds    int,
  difficulty_band      text,
  created_by           uuid REFERENCES identity.account(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  retired_at           timestamptz,
  published_at         timestamptz,
  search_tsv           tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('portuguese', coalesce(title,'')), 'A') ||
                        setweight(to_tsvector('portuguese', coalesce(summary,'')), 'B')
                      ) STORED,
  UNIQUE (content_type_id, key)
);
CREATE INDEX ix_content_item_state ON editorial.content_item (state) WHERE retired_at IS NULL;
CREATE INDEX ix_content_item_subject ON editorial.content_item (subject_id, ordinal);
CREATE INDEX ix_content_item_search ON editorial.content_item USING gin (search_tsv);

CREATE TABLE editorial.content_item_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  version       int NOT NULL,
  -- O documento estruturado. Blocos tipados, ordem preservada.
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Diff contra a versão anterior, para revisão e para "o que mudou".
  diff          jsonb,
  author_id     uuid REFERENCES identity.account(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  UNIQUE (content_item_id, version)
);
ALTER TABLE editorial.content_item
  ADD CONSTRAINT fk_content_item_current_version
  FOREIGN KEY (current_version_id) REFERENCES editorial.content_item_version(id)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN editorial.content_item_version.payload IS
  'Documento estruturado do item. Blocos: enunciado, alternativa, justificativa, imagem, fórmula.';

-- -----------------------------------------------------------------------------
-- GRAFO RELACIONAL
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.content_relation_type (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  -- 'directed' = A→B; 'symmetric' = A↔B
  cardinality text NOT NULL DEFAULT 'directed' CHECK (cardinality IN ('directed','symmetric')),
  -- A relação herda o requisito de verificação do item de origem?
  requires_verification boolean NOT NULL DEFAULT false,
  description text
);

CREATE TABLE editorial.content_relation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relation_type text NOT NULL REFERENCES editorial.content_relation_type(key),
  from_item_id  uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  to_item_id    uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  -- O dado que sustenta a relação (ex.: o texto citado da norma).
  attributes    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES identity.account(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relation_type, from_item_id, to_item_id),
  CHECK (from_item_id <> to_item_id)
);
CREATE INDEX ix_content_relation_to ON editorial.content_relation (to_item_id, relation_type);
CREATE INDEX ix_content_relation_from ON editorial.content_relation (from_item_id, relation_type);

-- -----------------------------------------------------------------------------
-- HISTÓRICO DE WORKFLOW
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.content_revision (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  version_id    uuid REFERENCES editorial.content_item_version(id),
  from_state    text,
  to_state      text NOT NULL,
  actor_id      uuid REFERENCES identity.account(id),
  actor_role    text,
  reason        text,
  diff          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_content_revision_item ON editorial.content_revision (content_item_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- FONTES — a base auditável de tudo
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.source (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  -- 'legislacao' ≠ 'norma': lei/decreto de âmbito nacional vs. norma técnica
  -- emitida pelo CFC. Confundir os dois é o que faz a citação parecer certa
  -- e estar errada.
  kind          text NOT NULL CHECK (kind IN ('url','norma','legislacao','edital','livro','jurisprudencia','interno','arquivo')),
  title         text NOT NULL,
  publisher     text,
  url           text,
  -- Versão/identificador do documento (ex.: "Edital FGV 2026.3, 05/10/2026").
  version_label text,
  published_at  date,
  -- SHA-256 do arquivo baixado. Se o conteúdo mudar, o hash muda, e a
  -- verificação que dependia dele precisa ser revista.
  content_sha256 char(64),
  -- TRECHO LITERAL da fonte que sustenta os dados derivados dela.
  -- Um número sem o trecho ao lado é opinião bem formatada.
  source_quote   text,
  archived_path text,
  consulted_at  timestamptz,
  consulted_by  uuid REFERENCES identity.account(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN editorial.source.content_sha256 IS
  'Prova de imutabilidade da fonte. Sem hash, "a norma mudou" é opinião.';
COMMENT ON COLUMN editorial.source.source_quote IS
  'Trecho literal da fonte que sustenta os números derivados. É o que permite a um terceiro conferir sem confiar em nós.';

-- -----------------------------------------------------------------------------
-- VERIFICAÇÃO — a camada que sustenta a tese do produto
-- -----------------------------------------------------------------------------
CREATE TABLE editorial.verification (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES editorial.content_item(id) ON DELETE CASCADE,
  state          text NOT NULL CHECK (state IN ('nao_verificada','em_revisao','verificada','expirada','necessita_atualizacao','rejeitada')),
  method         text NOT NULL CHECK (method IN ('manual','automatizada','importacao','conferencia_dupla')),
  source_id      uuid REFERENCES editorial.source(id),
  -- Trecho EXATO da fonte que justifica a verificação. É o que permite a
  -- um terceiro auditar sem refazer o trabalho.
  source_quote   text,
  verified_by    uuid REFERENCES identity.account(id),
  verified_at    timestamptz,
  -- Validade: norma técnica expira. Sem esta coluna, uma verificação de 2019
  -- continua parecendo atual.
  valid_until    timestamptz,
  -- Motivo da recusa — aparece no relatório de alegações recusadas.
  refusal_reason text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_verification_quote CHECK (state <> 'verificada' OR source_quote IS NOT NULL)
);
COMMENT ON CONSTRAINT ck_verification_quote ON editorial.verification IS
  'Verificada exige trecho da fonte. "Eu conferi" não é auditável.';

-- Uma verificação ATIVA por item. As demais ficam no histórico.
CREATE UNIQUE INDEX ux_verification_active
  ON editorial.verification (content_item_id)
  WHERE state IN ('nao_verificada','em_revisao','verificada','expirada','necessita_atualizacao');

-- -----------------------------------------------------------------------------
-- VOCABULÁRIOS E RELAÇÕES BASE
-- -----------------------------------------------------------------------------
INSERT INTO editorial.enumeration (key, label, description) VALUES
  ('nivel_dificuldade', 'Nível de dificuldade', 'Usado no simulado adaptativo'),
  ('formato_aula',      'Formato de aula', 'Modos de exibição do conteúdo ilustrado'),
  ('status_pagamento',  'Status de pagamento', NULL),
  ('fase_metodo',       'Fase do Método Cânone', 'Estudar · Praticar · Evoluir · Aprovar');

INSERT INTO editorial.enumeration_value (enumeration_key, key, label, meta, ordinal) VALUES
  ('nivel_dificuldade','facil','Fácil', '{"ordem":1}', 1),
  ('nivel_dificuldade','medio','Médio', '{"ordem":2}', 2),
  ('nivel_dificuldade','dificil','Difícil', '{"ordem":3}', 3),
  ('nivel_dificuldade','avancado','Avançado', '{"ordem":4}', 4);

INSERT INTO editorial.enumeration_value (enumeration_key, key, label, meta, ordinal) VALUES
  ('formato_aula','resumo_ilustrado','Resumo ilustrado','{}',1),
  ('formato_aula','quadro_comparativo','Quadro comparativo','{}',2),
  ('formato_aula','fluxograma','Fluxograma','{}',3),
  ('formato_aula','linha_do_tempo','Linha do tempo','{}',4),
  ('formato_aula','checklist_visual','Checklist visual','{}',5),
  ('fase_metodo','estudar','Estudar','{"ordem":1}',1),
  ('fase_metodo','praticar','Praticar','{"ordem":2}',2),
  ('fase_metodo','evoluir','Evoluir','{"ordem":3}',3),
  ('fase_metodo','aprovar','Aprovar','{"ordem":4}',4);

-- Estados de workflow da família 'avaliacao' (itens de prova).
-- O caminho happy tem VERIFICAÇÃO como etapa obrigatória — não como opção.
INSERT INTO editorial.state_definition (family, key, label, is_initial, is_terminal, requires_verification, is_public, is_refusal, color_token, ordinal) VALUES
  ('avaliacao','rascunho',        'Rascunho',         true,  false, false, false, false, 'cinza',   1),
  ('avaliacao','em_revisao',      'Em revisão',       false, false, false, false, false, 'latao',   2),
  ('avaliacao','verificado',      'Verificado',       false, false, true,  false, false, 'verde',   3),
  ('avaliacao','necessita_atualizacao','Necessita atualização', false, false, false, false, false, 'ambar', 4),
  ('avaliacao','publicado',       'Publicado',        false, false, true,  true,  false, 'latao',   5),
  ('avaliacao','rejeitado',       'Rejeitado',        false, true,  false, false, true,  'vermelho',6),
  ('avaliacao','obsoleto',        'Obsoleto',         false, true,  false, false, false, 'cinza',   7),
  ('estudo','rascunho',          'Rascunho',         true,  false, false, false, false, 'cinza',   1),
  ('estudo','em_revisao',        'Em revisão',       false, false, false, false, false, 'latao',   2),
  ('estudo','publicado',         'Publicado',        false, false, false, true,  false, 'latao',   3),
  ('estudo','obsoleto',          'Obsoleto',         false, true,  false, false, false, 'cinza',   4),
  ('referencia','rascunho',      'Rascunho',         true,  false, false, false, false, 'cinza',   1),
  ('referencia','verificado',    'Verificado',       false, false, false, false, false, 'verde',   2),
  ('referencia','publicado',     'Publicado',        false, false, false, true,  false, 'latao',   3);

-- O CAMINHO FELIZ DA FAMÍLIA 'avaliacao' É:
--   rascunho → em_revisao → verificado → publicado
-- Verificar é etapa, não opção. 'publicado' só é alcançável por
-- 'verificado', e 'verificado' exige verificação de fonte vigente.
INSERT INTO editorial.state_transition (family, from_state, to_state, requires, label) VALUES
  ('avaliacao','rascunho','em_revisao','',            'Enviado para revisão'),
  ('avaliacao','em_revisao','rascunho','',            'Devolvido para edição'),
  ('avaliacao','em_revisao','rejeitado','',           'Recusado'),
  ('avaliacao','em_revisao','verificado','verificacao_vigente','Verificado na fonte'),
  ('avaliacao','verificado','em_revisao','',          'Reaberto'),
  ('avaliacao','verificado','necessita_atualizacao','','Norma mudou'),
  ('avaliacao','verificado','publicado','verificacao_vigente','Publicado'),
  ('avaliacao','publicado','necessita_atualizacao','', 'Norma mudou'),
  ('avaliacao','publicado','obsoleto','',              'Fora do edital vigente'),
  ('avaliacao','necessita_atualizacao','em_revisao','','Revisão aberta'),
  ('avaliacao','rejeitado','em_revisao','',           'Recusa reaberta'),
  ('avaliacao','obsoleto','em_revisao','',            'Reativado'),
  ('estudo','rascunho','em_revisao','',                'Enviado para revisão'),
  ('estudo','em_revisao','rascunho','',                'Devolvido para edição'),
  ('estudo','em_revisao','publicado','',               'Publicado'),
  ('estudo','publicado','obsoleto','',                 'Substituído'),
  ('estudo','obsoleto','em_revisao','',                'Reativado'),
  ('referencia','rascunho','verificado','',            'Verificado na fonte'),
  ('referencia','verificado','publicado','',           'Publicado');

INSERT INTO editorial.content_relation_type (key, label, cardinality, requires_verification, description) VALUES
  ('cita_norma',      'Cita norma',          'directed', false, 'Item aponta para item de norma (CPC/NBC/ITP).'),
  ('cobre_assunto',   'Cobre assunto',       'directed', false, 'Item cobre um assunto do conteúdo programático.'),
  ('explica',         'Explica',             'directed', false, 'Item explica outro item.'),
  ('variante_de',     'Variante de',         'directed', false, 'Variação de um item-base.'),
  ('pre-requisito_de','Pré-requisito de',    'directed', false, 'Ordem de estudo.'),
  ('derivado_de',     'Derivado de',         'directed', false, 'Item gerado a partir de outro (ex.: adaptation de norma).'),
  ('revisao_de',      'Revisão de',          'directed', false, 'Versão revisada de conteúdo anterior.');
