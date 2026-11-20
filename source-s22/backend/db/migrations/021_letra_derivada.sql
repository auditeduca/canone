-- =============================================================================
-- 021 · A LETRA DO ITEM É DERIVADA, NÃO ESCRITA
-- -----------------------------------------------------------------------------
-- O ACHADO
--
-- A 018 deu ao gabarito oficial a PRECEDÊNCIA sobre o payload: quando os
-- dois divergem, quem vale é o gabarito. Mas essa precedência valia DENTRO
-- do caminho da projeção (payload → trigger → item_option).
--
-- learning.item_option não tem UPDATE para nenhum papel de aplicação (017:
-- só SELECT para staff e admin) — a camada de privilégio já barra a escrita
-- pela aplicação. MAS o dono do schema (o papel que roda a migration) pode
-- escrever a letra por cima da letra oficial, e NADA no banco impede: a
-- projeção deixa de ser derivada e vira escrita manual — exatamente o
-- dual-write que o projeto proíbe.
--
-- A CORREÇÃO
--
-- Um trigger que reconcilia: se o item pertence a uma prova, a letra é
-- SEMPRE a do gabarito oficial. Escrever na mão é recusado.
--
-- FAIL-CLOSED (a parte que importa)
--
-- Se a letra for marcada como correta e o gabarito NÃO estiver visível
-- para quem escreve, a regra NÃO se disfarça de "não há gabarito": ela
-- RECUSA. Uma regra que só existe quando o contexto ajuda é regra morta.
--
-- SECURITY DEFINER
--
-- O trigger precisa ler o gabarito com privilégio de quem o mantém, não de
-- quem escreve — senão a validação depende de o chamador ter privilégio de
-- leitura no segredo. Em produção, o dono da função precisa de leitura nas
-- tabelas do gabarito (o papel de sistema com BYPASSRLS é a pendência
-- aberta; o gate de produção vai acusar isso).
-- =============================================================================

CREATE OR REPLACE FUNCTION learning.reconcile_item_correct() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, learning, editorial, taxonomy, identity, norms, ops
AS $$
DECLARE
  v_letter   text;
  v_annulled boolean;
  v_em_prova boolean;
BEGIN
  IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.is_correct THEN
    -- Desmarcar não precisa de gabarito: limpar é sempre seguro.
    RETURN NEW;
  END IF;

  SELECT e.correct_option, e.is_annulled INTO v_letter, v_annulled
    FROM learning.vigente_answer_key(NEW.item_id) e;

  IF NOT FOUND THEN
    SELECT EXISTS (SELECT 1 FROM learning.exam_form_item WHERE item_id = NEW.item_id)
      INTO v_em_prova;

    IF v_em_prova THEN
      RAISE EXCEPTION
        'A questão % pertence a uma prova e a letra é DERIVADA do gabarito oficial, que não pôde ser lido; recuso marcar a alternativa % como correta',
        NEW.item_id, NEW.ordinal USING ERRCODE = '23514';
    END IF;

    -- Item fora de prova: a letra vem do tipo de conteúdo, não do gabarito.
    RETURN NEW;
  END IF;

  IF v_annulled THEN
    RAISE EXCEPTION
      'A questão % está ANULADA no gabarito oficial: não existe alternativa correta',
      NEW.item_id USING ERRCODE = '23514';
  END IF;

  IF NEW.ordinal <> v_letter THEN
    RAISE EXCEPTION
      'A alternativa % da questão % não é a do gabarito oficial (%); a letra do item é DERIVADA',
      NEW.ordinal, NEW.item_id, v_letter USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_reconcile_item_correct
  AFTER UPDATE OF is_correct ON learning.item_option
  FOR EACH ROW EXECUTE FUNCTION learning.reconcile_item_correct();

COMMENT ON FUNCTION learning.reconcile_item_correct() IS
  'A letra do item que pertence a uma prova é DERIVADA do gabarito oficial. Escrever na mão é recusado (fail-closed).';
