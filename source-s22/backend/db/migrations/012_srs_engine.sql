-- =============================================================================
-- 012 · MOTOR DE REPETIÇÃO ESPAÇADA
-- -----------------------------------------------------------------------------
-- Implementação de um SRS inspirado no FSRS, com duas adaptações que o
-- produto exige:
--
--   1) O GRADE DE 4 ESTADOS, não o binário acerto/erro.
--      'facil'    → intervalo longo
--      'esforco'  → intervalo curto (o conteúdo está frágil)
--      'errei'    → intervalo muito curto + entra no Caderno de Erros
--      'naosei'    → NÃO entra no agendamento. Entra na trilha de estudo.
--
--   2) O FUNDIMENTO. Quando o gabarito é conhecido (simulado), o estado é
--      DERIVADO pelo sistema. Quando não é (flashcard), é DECLARADO.
--      O motor nunca mistura os dois.
--
-- POR QUE O ESTADO É UM CACHE E O LOG É A VERDADE
-- learning.review_event é append-only e guarda algorithm_version. Se o
-- algoritmo mudar, learning.user_item_state é recalculável a partir do log.
-- Sem isso, mudar o motor de repetição destruiria o histórico do aluno.
--
-- A FUNÇÃO É IDEMPOTENTE POR (event_id). Reprocessar o mesmo evento não
-- muda o estado — isso importa quando o job de agendamento roda duas vezes.
-- =============================================================================

CREATE OR REPLACE FUNCTION learning.derive_grade(
  p_basis learning.review_basis,
  p_correct boolean,
  p_declared learning.review_grade
) RETURNS learning.review_grade
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_basis = 'autodeclarado' THEN
    IF p_declared IS NULL THEN
      RAISE EXCEPTION 'base=autodeclarado exige grade declarado'
        USING ERRCODE = '23514';
    END IF;
    RETURN p_declared;
  END IF;

  IF p_correct IS NULL THEN
    RAISE EXCEPTION 'base=sistema exige correct'
      USING ERRCODE = '23514';
  END IF;

  -- Base sistema: só sabemos acertou ou errou. 'facil' vs 'esforco' é
  -- autoavaliação — não se pode inventar a partir do gabarito.
  RETURN CASE WHEN p_correct THEN 'facil'::learning.review_grade
              ELSE 'errei'::learning.review_grade END;
END $$;

-- -----------------------------------------------------------------------------
-- ATUALIZAÇÃO DE ESTADO APÓS UM EVENTO
-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- REPLAY: aplica UM EVENTO AO ESTADO (sem gravar evento novo)
-- -----------------------------------------------------------------------------
-- A separação é obrigatória: apply_review_event GRAVA o evento e depois
-- chama replay; rebuild_user_state chama replay direto. Se as duas coisas
-- estivessem na mesma função, o rebuild recriaria os eventos e o log
-- cresceria a cada reconstrução — a verdade viria mentira.
--
-- BUG HISTÓRICO (achado pelo teste de comportamento): apply_review_event
-- atualizava o estado e NÃO gravava nada em learning.review_event. O log
-- ficava vazio, rebuild_user_state não tinha o que reconstruir, e a
-- propriedade "o log é a verdade" era só uma frase no comentário.
CREATE OR REPLACE FUNCTION learning.replay_event(p_event_id uuid)
RETURNS learning.user_item_state
LANGUAGE plpgsql AS $$
DECLARE
  v_event   learning.review_event%ROWTYPE;
  v_state   learning.user_item_state%ROWTYPE;
  v_grade   learning.review_grade;
  v_new_stability numeric;
  v_new_difficulty numeric;
  v_new_due timestamptz;
  v_interval_days int;
BEGIN
  SELECT * INTO v_event FROM learning.review_event WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de revisão % inexistente', p_event_id USING ERRCODE = '23503';
  END IF;

  v_grade := learning.derive_grade(v_event.basis, v_event.correct, v_event.grade);

  SELECT * INTO v_state
    FROM learning.user_item_state
   WHERE user_id = v_event.user_id AND item_id = v_event.item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO learning.user_item_state (user_id, item_id, algorithm_version)
    VALUES (v_event.user_id, v_event.item_id, v_event.algorithm_version)
    RETURNING * INTO v_state;
  END IF;

  -- ── 'naosei' NÃO ENTRA NO AGENDAMENTO ──────────────────────────────────
  -- Conteúdo nunca visto não é revisão. O item fica 'nova' e o motor de
  -- trilha de estudo o puxa. Revisar o que nunca foi ensinado é desperdício.
  IF v_grade = 'naosei' THEN
    UPDATE learning.user_item_state
       SET state = 'nova',
           due_at = NULL,
           last_review_at = now(),
           last_grade = 'naosei',
           fragile_streak = 0,
           algorithm_version = v_event.algorithm_version,
           updated_at = now()
     WHERE user_id = v_event.user_id AND item_id = v_event.item_id
    RETURNING * INTO v_state;
    RETURN v_state;
  END IF;

  -- ── CÁLCULO DE ESTABILIDADE ─────────────────────────────────────────────
  -- Modelo simplificado (SM-2 com as adaptações do produto).
  --   facil   → multiplica por 2.4 e soma folga
  --   esforco → intervalo curto, mas o item NÃO é considerado consolidado
  --   errei   →cai a estabilidade; o item entra em reaprendizado
  IF v_grade = 'facil' THEN
    v_new_stability := least(
      coalesce(v_state.stability_days, 0) * 2.4 + 1.5,
      365.0);
    v_new_difficulty := greatest(1.0, v_state.difficulty - 0.35);
    v_interval_days := greatest(1, round(v_new_stability)::int);
  ELSIF v_grade = 'esforco' THEN
    v_new_stability := least(
      coalesce(v_state.stability_days, 0) * 1.05 + 0.4,
      14.0);
    v_new_difficulty := greatest(1.0, v_state.difficulty + 0.20);
    v_interval_days := 1;
  ELSE -- errei
    v_new_stability := greatest(0.4, coalesce(v_state.stability_days, 0) * 0.35);
    v_new_difficulty := least(10.0, v_state.difficulty + 0.85);
    v_interval_days := 0;
  END IF;

  v_new_due := now() + make_interval(days => v_interval_days);

  UPDATE learning.user_item_state
     SET state = CASE
                   WHEN v_grade = 'errei' THEN 'reaprendendo'
                   WHEN v_state.state = 'nova' THEN 'aprendendo'
                   ELSE 'revisao'
                 END,
         stability_days = v_new_stability,
         difficulty = v_new_difficulty,
         due_at = v_new_due,
         last_review_at = now(),
         last_grade = v_grade,
         last_interval_days = v_interval_days,
         repetitions = v_state.repetitions + 1,
         lapses = v_state.lapses + CASE WHEN v_grade = 'errei' THEN 1 ELSE 0 END,
         fragile_streak = CASE
                            WHEN v_grade = 'facil' THEN 0
                            WHEN v_grade = 'esforco' THEN v_state.fragile_streak + 1
                            ELSE 0
                          END,
         algorithm_version = v_event.algorithm_version,
         updated_at = now()
   WHERE user_id = v_event.user_id AND item_id = v_event.item_id
  RETURNING * INTO v_state;

  RETURN v_state;
END $$;

-- -----------------------------------------------------------------------------
-- GRAVAR REVISÃO: evento primeiro, estado depois
-- -----------------------------------------------------------------------------
-- Esta é a ÚNICA porta de escrita de revisão. Ela sempre grava o evento
-- (append-only, com algorithm_version) e só então aplica ao estado. A
-- ordem importa: se o estado更新 primeiro e a gravação do evento falhasse,
-- o estado advanced sem lastro no log.
CREATE OR REPLACE FUNCTION learning.apply_review_event(
  p_user_id uuid,
  p_item_id uuid,
  p_grade learning.review_grade,
  p_basis learning.review_basis,
  p_correct boolean,
  p_duration_ms int DEFAULT NULL,
  p_algorithm_version text DEFAULT 'srs-v1'
) RETURNS learning.user_item_state
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Valida ANTES de gravar: um evento inválido não entra no log.
  PERFORM learning.derive_grade(p_basis, p_correct, p_grade);

  INSERT INTO learning.review_event
    (user_id, item_id, grade, basis, correct, duration_ms, algorithm_version)
  VALUES
    (p_user_id, p_item_id, p_grade, p_basis, p_correct, p_duration_ms, p_algorithm_version)
  RETURNING id INTO v_event_id;

  RETURN learning.replay_event(v_event_id);
END $$;

-- -----------------------------------------------------------------------------
-- RECALCULAR MAESTRIA POR ASSUNTO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.refresh_mastery(p_user_id uuid, p_subject_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO learning.mastery (
    user_id, subject_id, items_seen, items_mastered, items_fragile, items_unseen,
    correct_answers, total_answers, confidence, updated_at)
  -- A AGREGACAÇÃO É POR ASSUNTO, e a versão anterior errava em dois
  -- pontos ao mesmo tempo:
  --   1. GROUP BY i.id produzia UMA LINHA POR ITEM, e o ON CONFLICT
  --      sobrescrevia a linha do assunto com o último item lido — a
  --      mestria virava "quantos itens o último item tem".
  --   2. O LEFT JOIN com review_event multiplicava as linhas (item ×
  --      evento), inflando as contagens.
  -- Aqui: primeiro consolida POR ITEM, depois soma no assunto.
  SELECT p_user_id, p_subject_id,
         count(*) FILTER (WHERE x.state <> 'nova'),
         count(*) FILTER (WHERE x.state = 'revisao' AND x.stability_days >= 21),
         count(*) FILTER (WHERE x.is_fragile),
         count(*) FILTER (WHERE x.state = 'nova'),
         coalesce(sum(x.correct_answers), 0),
         coalesce(sum(x.total_answers), 0),
         -- Confiança = 60% domínio do assunto (itens maduros) + 40%
         -- acerto. Sem o número mágico "40 itens" da versão anterior:
         -- a confiança cresce com a EVIDÊNCIA do aluno, não com relógio.
         round((
           0.6 * (count(*) FILTER (WHERE x.state = 'revisao' AND x.stability_days >= 21))::numeric
                 / greatest(1, count(*) FILTER (WHERE x.state <> 'nova'))
         + 0.4 * (coalesce(sum(x.correct_answers), 0))::numeric
                 / greatest(1, coalesce(sum(x.total_answers), 0))
         )::numeric, 3),
         now()
    FROM (
      SELECT i.id AS item_id,
             coalesce(s.state, 'nova')       AS state,
             coalesce(s.stability_days, 0)   AS stability_days,
             coalesce(s.is_fragile, false)   AS is_fragile,
             count(e.id)                     AS total_answers,
             count(e.id) FILTER (WHERE e.correct) AS correct_answers
        FROM learning.item i
        JOIN learning.item_subject isub
          ON isub.item_id = i.id AND isub.subject_id = p_subject_id
        LEFT JOIN learning.user_item_state s
          ON s.item_id = i.id AND s.user_id = p_user_id
        LEFT JOIN learning.review_event e
          ON e.item_id = i.id AND e.user_id = p_user_id AND e.basis = 'sistema'
       GROUP BY i.id, s.state, s.stability_days, s.is_fragile
    ) x
  ON CONFLICT (user_id, subject_id) DO UPDATE SET
    items_seen = EXCLUDED.items_seen,
    items_mastered = EXCLUDED.items_mastered,
    items_fragile = EXCLUDED.items_fragile,
    items_unseen = EXCLUDED.items_unseen,
    correct_answers = EXCLUDED.correct_answers,
    total_answers = EXCLUDED.total_answers,
    confidence = EXCLUDED.confidence,
    updated_at = now();
END $$;

-- -----------------------------------------------------------------------------
-- ITENS DE REVISÃO DO DIA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.due_items(
  p_user_id uuid,
  p_subject_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50
) RETURNS TABLE (
  item_id uuid, subject_id uuid, due_at timestamptz, state text,
  stability_days numeric, is_fragile boolean, last_grade learning.review_grade
)
LANGUAGE sql STABLE AS $$
  SELECT i.id, isub.subject_id, s.due_at, s.state, s.stability_days, s.is_fragile, s.last_grade
    FROM learning.user_item_state s
    JOIN learning.item i ON i.id = s.item_id
    JOIN learning.item_subject isub ON isub.item_id = i.id
   WHERE s.user_id = p_user_id
     AND s.due_at IS NOT NULL
     AND s.due_at <= now()
     AND (p_subject_id IS NULL OR isub.subject_id = p_subject_id)
     AND s.state <> 'nova'
   ORDER BY s.due_at
   LIMIT p_limit
$$;

-- -----------------------------------------------------------------------------
-- RECONSTRUIR ESTADO A PARTIR DO LOG (quando o algoritmo muda)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.rebuild_user_state(
  p_user_id uuid,
  p_algorithm_version text DEFAULT 'srs-v1'
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_event RECORD;
  v_count int := 0;
BEGIN
  DELETE FROM learning.user_item_state WHERE user_id = p_user_id;

  FOR v_event IN
    SELECT id
      FROM learning.review_event
     WHERE user_id = p_user_id
     ORDER BY reviewed_at, id
  LOOP
    -- replay_event, NUNCA apply_review_event: reconstruir não pode criar
    -- eventos novos, senão o log cresce a cada reconstrução.
    PERFORM learning.replay_event(v_event.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;
