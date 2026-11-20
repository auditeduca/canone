-- =============================================================================
-- 024 · O GABARITO DEFINITIVO É IMUTÁVEL, E A RÉGUA NÃO SE REBASEIA
-- -----------------------------------------------------------------------------
-- A CADEIA QUE O QA ADVERSARIAL MEDIU
--
-- O QA não achou um furo: achou uma CADEIA de quatro, e a cadeia inteira
-- fecha. O ponto de partida era uma prova de 3 posições com gabarito
-- DEFINITIVO de 3 entradas:
--
--   [1] rebaixar o DEFINITIVO para PRELIMINAR e apagar a entrada 3  → PASSOU
--   [2] a prova perdeu o selo: apagar a POSIÇÃO 3 da prova            → PASSOU
--   [3] rebasear a régua: question_count da trilha 3 → 2             → PASSOU
--   [4] novo gabarito DEFINITIVO com 2 entradas                      → PASSOU
--
-- No fim, o banco tinha uma prova de 3 posições que agora valia 2, com um
-- gabarito DEFINITIVO de 2 entradas, e a visão de governança mostrando
-- question_count=2, items_linked=2, keyed=2 — tudo "verde".
--
-- A PROVA DE FORMA CONTINUAVA VERDE. É a regra exata que este projeto já
-- conhece: "SQL não executado é hipótese" e "migration que aplica sem
-- erro NÃO é prova".
--
-- OS DOIS FECHOS
--
-- (1) O GABARITO DEFINITIVO É IMUTÁVEL. Ele é um documento oficial: o
--     status não pode voltar a preliminar, a fonte não pode trocar, a
--     entrada não pode ser apagada nem mudada. A transição
--     preliminar → definitivo continua livre (é o caminho normal); o que
--     é proibido é DESFAZER o selo. A ingestão continua idempotente
--     porque reimportar o MESMO acervo reescreve os mesmos valores —
--     e reescrever o mesmo valor não é mudar.
--
-- (2) A RÉGUA NÃO SE REBASEIA. `exam_track.question_count` (e o da
--     rodada) é o número contra o qual a completude é conferida. Mudar a
--     régua depois de selar a prova é a mesma coisa que∀ trocar o gabarito
--     — só que por fora. Com a prova selada, o número é imutável.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · O GABARITO DEFINITIVO É IMUTÁVEL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.answer_key_definitivo_imutavel() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT k.status INTO v_status FROM learning.answer_key k WHERE k.id = OLD.answer_key_id;
  ELSE
    SELECT k.status INTO v_status FROM learning.answer_key k WHERE k.id = NEW.answer_key_id;
  END IF;

  IF v_status IS DISTINCT FROM 'definitivo' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'A entrada % do gabarito DEFINITIVO % não pode ser apagada: o gabarito oficial é imutável',
      OLD.ordinal, OLD.answer_key_id USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.ordinal IS DISTINCT FROM OLD.ordinal
       OR NEW.correct_option IS DISTINCT FROM OLD.correct_option
       OR NEW.is_annulled IS DISTINCT FROM OLD.is_annulled THEN
      RAISE EXCEPTION
        'A entrada % do gabarito DEFINITIVO % não pode mudar: o gabarito oficial é imutável',
        OLD.ordinal, OLD.answer_key_id USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_answer_key_entry_definitivo_imutavel
  BEFORE UPDATE OR DELETE ON learning.answer_key_entry
  FOR EACH ROW EXECUTE FUNCTION learning.answer_key_definitivo_imutavel();

CREATE OR REPLACE FUNCTION learning.answer_key_status_imutavel() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
BEGIN
  IF OLD.status = 'definitivo' THEN
    IF NEW.status IS DISTINCT FROM 'definitivo' THEN
      RAISE EXCEPTION
        'O gabarito DEFINITIVO % não pode voltar a %: o selo do gabarito oficial não se desfaz',
        OLD.id, NEW.status USING ERRCODE = '23514';
    END IF;
    IF NEW.source_id IS DISTINCT FROM OLD.source_id THEN
      RAISE EXCEPTION
        'O gabarito DEFINITIVO % não pode trocar a fonte: o gabarito oficial é imutável',
        OLD.id USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_answer_key_status_imutavel
  BEFORE UPDATE ON learning.answer_key
  FOR EACH ROW EXECUTE FUNCTION learning.answer_key_status_imutavel();

CREATE TRIGGER trg_answer_key_definitivo_imutavel
  BEFORE DELETE ON learning.answer_key
  FOR EACH ROW EXECUTE FUNCTION learning.answer_key_status_imutavel();

COMMENT ON FUNCTION learning.answer_key_status_imutavel() IS
  'O gabarito DEFINITIVO é imutável: nem o status volta a preliminar, nem a fonte troca, nem a entrada muda. A transição preliminar→definitivo é livre.';
COMMENT ON FUNCTION learning.answer_key_definitivo_imutavel() IS
  'Entrada de gabarito DEFINITIVO é imutável: não se apaga, não muda a letra, não muda a anulação.';

-- -----------------------------------------------------------------------------
-- 2 · A RÉGUA NÃO SE REBASEIA DEPOIS DO SELO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.exam_count_imutavel_apos_selo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
DECLARE
  v_tem_selo boolean;
BEGIN
  IF NEW.question_count IS NOT DISTINCT FROM OLD.question_count THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'exam_track' THEN
    SELECT EXISTS (
      SELECT 1 FROM learning.exam_form f
        JOIN learning.answer_key k ON k.exam_form_id = f.id AND k.status = 'definitivo'
       WHERE f.exam_track_id = OLD.id
    ) INTO v_tem_selo;
  ELSE
    -- O número da RODADA é o número da SUFICIÊNCIA (o exame principal).
    -- O selo de uma variante de EQT da mesma rodada não o impede de ser
    -- preenchido: são exames diferentes, com contagens diferentes.
    SELECT EXISTS (
      SELECT 1 FROM taxonomy.exam_track t
        JOIN learning.exam_form f ON f.exam_track_id = t.id
        JOIN learning.answer_key k ON k.exam_form_id = f.id AND k.status = 'definitivo'
       WHERE t.exam_edition_id = OLD.id AND t.track_code = 'suficiencia'
    ) INTO v_tem_selo;
  END IF;

  IF v_tem_selo THEN
    RAISE EXCEPTION
      'O número de questões não pode mudar depois do selo: a prova já tem gabarito DEFINITIVO. Ver %',
      OLD.id USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_exam_track_count_imutavel
  BEFORE UPDATE OF question_count ON taxonomy.exam_track
  FOR EACH ROW EXECUTE FUNCTION learning.exam_count_imutavel_apos_selo();

CREATE TRIGGER trg_exam_edition_count_imutavel
  BEFORE UPDATE OF question_count ON taxonomy.exam_edition
  FOR EACH ROW EXECUTE FUNCTION learning.exam_count_imutavel_apos_selo();

COMMENT ON FUNCTION learning.exam_count_imutavel_apos_selo() IS
  'O número de questões (trilha ou rodada) é a régua da completude: depois do selo do gabarito definitivo, ele não muda mais. Rebasear a régua é trocar o gabarito por fora.';
