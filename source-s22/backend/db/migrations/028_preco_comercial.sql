-- =============================================================================
-- 028 · O PREÇO COMERCIAL — E A FONTE DELE
-- -----------------------------------------------------------------------------
-- O preço é o único número do Cânone que NÃO vem de norma: vem de decisão
-- comercial. Por isso ele não pode ser um número solto no código — é dado,
-- no banco, COM a sua origem ao lado.
--
-- DECISÃO DO DONO (13/11/2026): R$ 15,00/mês.
--
-- O plano ANUAL é DERIVADO: 12 × R$ 15,00/mês = R$ 180,00/ano. A derivação
-- está escrita na origem, porque deriva é decisão de quem derivou: se a
-- intenção era cobrar 10 meses, é uma linha em commerce.plan.price_source.
--
-- Os outros dois planos (essencial, avaliacao) SEGUEM SEM PREÇO: preço sem
-- decisão do comercial é NULL, nunca zero.
--
-- E um ajuste de regra que o próprio banco cobrava de boca:
--
--   O comentário da coluna dizia "NUNCA 0", mas a restrição aceitava 0.
--   Preço zero não é "preço não definido" — é giveaway, e giveaway no
--   cadastro de planos é erro de faturamento esperando para acontecer.
--   A regra passa a morar no banco, onde ela fica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · A COLUNA DA ORIGEM
-- -----------------------------------------------------------------------------
ALTER TABLE commerce.plan ADD COLUMN IF NOT EXISTS price_source text;

COMMENT ON COLUMN commerce.plan.price_source IS
  'Origem do preço: decisão comercial registrada, com data. NULL = preço não definido.';

-- -----------------------------------------------------------------------------
-- 2 · A REGRA: PREÇO É MAIOR QUE ZERO, OU NÃO EXISTE
-- -----------------------------------------------------------------------------
ALTER TABLE commerce.plan DROP CONSTRAINT IF EXISTS commerce_plan_price_cents_check;
ALTER TABLE commerce.plan ADD CONSTRAINT commerce_plan_price_cents_check
  CHECK (price_cents IS NULL OR price_cents > 0);

COMMENT ON CONSTRAINT commerce_plan_price_cents_check ON commerce.plan IS
  'Preço 0 é giveaway, não "preço não definido". Preço não definido é NULL.';

-- -----------------------------------------------------------------------------
-- 3 · OS PREÇOS, COM A SUA ORIGEM
-- -----------------------------------------------------------------------------
UPDATE commerce.plan
   SET price_cents = 1500,
       price_source = 'decisão do dono (13/11/2026): R$ 15,00/mês',
       updated_at = now()
 WHERE key = 'completo';

UPDATE commerce.plan
   SET price_cents = 18000,
       price_source = 'derivado de R$ 15,00/mês × 12 meses (sem desconto inventado); a confirmar com o dono',
       updated_at = now()
 WHERE key = 'anual';

-- 'essencial' e 'avaliacao' seguem sem preço: o comercial ainda não decidiu.
