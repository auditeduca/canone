-- =============================================================================
-- 008 · COMERCIAL
-- -----------------------------------------------------------------------------
-- REGRA DESTE SCHEMA: O QUE NÃO FOI DECIDIDO, NÃO É PUBLICADO.
-- plan.price_cents é NULL enquanto o comercial não define preço. A API
-- pública serve o plano SEM preço, e a interface mostra pendência — igual
-- treatment que o app dá a {N_ALUNOS}. Uma intenção de "depois a gente preenche"
-- no banco vira um R$ 29,90 fantasma na tela.
--
-- Período de carência e cobrança também são explícitos: assinatura sem
-- pagamento é estado do sistema, não ausência de dado.
-- =============================================================================

CREATE TABLE commerce.plan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  billing_period text NOT NULL CHECK (billing_period IN ('mensal','anual','semestral','vitalicio')),
  -- NULL = preço ainda não definido pelo comercial.
  price_cents  int CHECK (price_cents IS NULL OR price_cents >= 0),
  currency     char(3) NOT NULL DEFAULT 'BRL',
  trial_days   int NOT NULL DEFAULT 0,
  is_public    boolean NOT NULL DEFAULT true,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN commerce.plan.price_cents IS
  'NULL enquanto o comercial não definir. A API pública serve sem preço e a UI mostra pendência.';

CREATE TABLE commerce.plan_feature (
  plan_id     uuid NOT NULL REFERENCES commerce.plan(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  -- Limite (ex.: max_simulados_mes = 20). NULL = sem limite.
  limit_value int,
  enabled     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE commerce.subscription (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES commerce.plan(id),
  provider          text NOT NULL DEFAULT 'interno'
                    CHECK (provider IN ('interno','stripe','pagarme','boleto','manual')),
  provider_ref      text,
  status            text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','ativa','past_due','cancelada','expirada','reembolsada','inadimplente')),
  -- Período COBRADO (não o período de serviço).
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at       timestamptz,
  -- Trial termina aqui; antes disso a assinatura ainda não dá acesso.
  trial_ends_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_subscription_user ON commerce.subscription (user_id, status);
CREATE INDEX ix_subscription_provider_ref ON commerce.subscription (provider, provider_ref)
  WHERE provider_ref IS NOT NULL;
-- Uma assinatura ativa por usuário (por provedor).trial_ends_at IS NULL
CREATE UNIQUE INDEX ux_subscription_active
  ON commerce.subscription (user_id)
  WHERE status IN ('pendente','ativa','past_due');

CREATE TABLE commerce.payment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES commerce.subscription(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  provider_ref    text NOT NULL,
  amount_cents    int NOT NULL CHECK (amount_cents >= 0),
  currency        char(3) NOT NULL DEFAULT 'BRL',
  status          text NOT NULL CHECK (status IN ('pendente','pago','falhou','estornado','cancelado')),
  method          text,
  installments    int NOT NULL DEFAULT 1,
  paid_at         timestamptz,
  failure_code    text,
  failure_message text,
  raw_payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX ix_payment_user ON commerce.payment (user_id, created_at DESC);

CREATE TABLE commerce.invoice (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES commerce.subscription(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  payment_id      uuid REFERENCES commerce.payment(id) ON DELETE SET NULL,
  number          text,
  amount_cents    int NOT NULL,
  tax_cents       int NOT NULL DEFAULT 0,
  total_cents     int NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'BRL',
  status          text NOT NULL DEFAULT 'emitida'
                  CHECK (status IN ('emitida','paga','vencida','cancelada')),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  due_at          timestamptz,
  paid_at         timestamptz,
  lines           jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ix_invoice_user ON commerce.invoice (user_id, issued_at DESC);

-- Entitlements: o que o usuário TEM acesso, separado da assinatura.
-- Permite dar acesso avulso (parceria, empresa parceira, cortesia) sem criar assinatura.
CREATE TABLE commerce.entitlement (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  source     text NOT NULL DEFAULT 'assinatura'
             CHECK (source IN ('assinatura','promocao','parceria','compensacao','admin')),
  source_ref text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_entitlement_user_feature ON commerce.entitlement (user_id, feature_key)
  WHERE revoked_at IS NULL;

CREATE TABLE commerce.coupon (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text,
  percent_off int CHECK (percent_off BETWEEN 0 AND 100),
  amount_off_cents int,
  max_redemptions int,
  redemptions int NOT NULL DEFAULT 0,
  valid_from  timestamptz,
  valid_until timestamptz,
  plan_ids    uuid[],
  active      boolean NOT NULL DEFAULT true
);
