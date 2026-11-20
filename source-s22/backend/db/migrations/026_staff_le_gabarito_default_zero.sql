-- =============================================================================
-- 026 · O STAFF PRECISA LER O GABARITO — E O DEFAULT 50 NÃO TEM DONO
-- -----------------------------------------------------------------------------
-- ACHADO 1 · O CAMINHO CONCEDIDO PARA LER O GABARITO ESTAVA MORTO
--
-- A 017 concede SELECT em learning.item_option ao staff e ao admin. A
-- 018 cria as tabelas novas com RLS ENABLE + FORCE. E a 014 — a varredura
-- que cria policy por papel — NÃO criou policy para learning.item_option
-- (a tabela já existia, e a varredura listava só as que precisavam de
-- leitura por área).
--
-- Resultado: com RLS FORCE e ZERO policies, o staff e o admin enxergam
-- ZERO linhas de learning.item_option. O privilégio concedido não
-- chegava ao fim. E o QA mediu a consequência prática: o caminho
-- CONCEDIDO de conferir a extração do gabarito à mão estava morto, e a
-- falha se disfarçava de outra coisa — a mensagem acusava o DADO
-- ("a alternativa C que não existe") quando o problema era o PRivilÉGIO.
--
-- Pior: as funções que conferem e projetam a entrada do gabarito
-- (check_answer_key_entry e project_answer_key_entry) são SECURITY
-- INVOKER — elas rodam com o direito de quem chama. Quem não enxerga a
-- alternativa não consegue conferi-la. As duas passam a ser SECURITY
-- DEFINER: a regra confere o gabarito com o direito de quem o mantém,
-- e o erro passa a ser sobre o dado, quando é sobre o dado.
--
-- E o assinante continua sem enxergar nada: a policy é do staff e do
-- admin, e a tabela segue sem SELECT para o assinante.
--
-- ACHADO 2 · O DEFAULT 50 É UM NÚMERO SEM DONO
--
-- A 019 tirou o NOT NULL de exam_edition.question_count e
-- passing_score — porque o número da prova é NULL enquanto não houver
-- fonte conferida. Mas o DEFAULT 50/25 ficou. Ou seja: uma rodada criada
-- sem número explícito recebia 50 questões e 25 de corte — SILENCIOSAMENTE,
-- sem fonte nenhuma. É exatamente o que o projeto não faz: número sem
-- fonte vira número inventado por default.
--
-- A correção: DEFAULT NULL. Quem não tem fonte não escreve número.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · O STAFF E O ADMIN ALCANÇAM O GABARITO (E O ASSINANTE, NÃO)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS staff_read_item_option ON learning.item_option;

CREATE POLICY staff_read_item_option ON learning.item_option FOR SELECT TO canone_staff
  USING (true);

DROP POLICY IF EXISTS admin_read_item_option ON learning.item_option;

CREATE POLICY admin_read_item_option ON learning.item_option FOR SELECT TO canone_admin
  USING (true);

-- A conferência da extração é do staff: é quem olha o PDF e o gabarito
-- lado a lado. A política de ESCRITA continua vedada — a letra é
-- derivada (021/022), e escrever à mão é recusado.
COMMENT ON POLICY staff_read_item_option ON learning.item_option IS
  'O staff lê o gabarito — é quem confere a extração. Só LEITURA: a letra é derivada do gabarito oficial e escrever por cima é recusado pelo banco.';

-- -----------------------------------------------------------------------------
-- 2 · AS FUNÇÕES QUE CONFEREM A CHAVE RODAM COM O DIREITO DE QUEM MANTÉM
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.check_answer_key_entry() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
DECLARE
  v_key      learning.answer_key%ROWTYPE;
  v_form_q   int;
  v_item     uuid;
  v_has      int;
BEGIN
  SELECT * INTO v_key FROM learning.answer_key WHERE id = NEW.answer_key_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gabarito % inexistente', NEW.answer_key_id USING ERRCODE = '23503';
  END IF;

  SELECT t.question_count INTO v_form_q
    FROM learning.exam_form ef
    JOIN taxonomy.exam_track t ON t.id = ef.exam_track_id
   WHERE ef.id = v_key.exam_form_id;

  IF NEW.ordinal > v_form_q THEN
    RAISE EXCEPTION 'Posição % não existe na prova (que tem % questões)',
      NEW.ordinal, v_form_q USING ERRCODE = '23514';
  END IF;

  SELECT efi.item_id INTO v_item
    FROM learning.exam_form_item efi
   WHERE efi.exam_form_id = v_key.exam_form_id
     AND efi.ordinal = NEW.ordinal;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'A prova % não tem item na posição %',
      v_key.exam_form_id, NEW.ordinal USING ERRCODE = '23514';
  END IF;

  IF NOT NEW.is_annulled THEN
    SELECT count(*) INTO v_has
      FROM learning.item_option
     WHERE item_id = v_item AND ordinal = NEW.correct_option;
    IF v_has = 0 THEN
      RAISE EXCEPTION
        'Gabarito aponta para a alternativa % que não existe na questão da posição %',
        NEW.correct_option, NEW.ordinal USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION learning.project_answer_key_entry() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
DECLARE
  v_key  learning.answer_key%ROWTYPE;
  v_item uuid;
BEGIN
  SELECT * INTO v_key FROM learning.answer_key WHERE id = NEW.answer_key_id;
  SELECT efi.item_id INTO v_item
    FROM learning.exam_form_item efi
   WHERE efi.exam_form_id = v_key.exam_form_id
     AND efi.ordinal = NEW.ordinal;
  IF v_item IS NULL THEN RETURN NULL; END IF;

  -- Questão ANULADA não tem resposta: a letra projetada é removida.
  IF NEW.is_annulled THEN
    PERFORM learning.clear_item_correct(v_item);
    RETURN NULL;
  END IF;

  PERFORM learning.set_item_correct(v_item, NEW.correct_option);
  RETURN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3 · NÚMERO SEM FONTE NÃO VIRA NÚMERO POR DEFAULT
-- -----------------------------------------------------------------------------
ALTER TABLE taxonomy.exam_edition ALTER COLUMN question_count DROP DEFAULT;
ALTER TABLE taxonomy.exam_edition ALTER COLUMN passing_score DROP DEFAULT;

COMMENT ON COLUMN taxonomy.exam_edition.question_count IS
  'Número de questões da Suficiência da rodada. NULL enquanto não houver fonte conferida — e SEM DEFAULT: número inventado por default é número sem fonte.';
COMMENT ON COLUMN taxonomy.exam_edition.passing_score IS
  'Nota de corte da rodada. NULL enquanto não houver fonte conferida — e SEM DEFAULT.';
