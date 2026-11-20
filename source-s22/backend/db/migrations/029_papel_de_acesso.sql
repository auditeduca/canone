-- =============================================================================
-- 029 · O PAPEL DE ACESSO — QUEM ENTRA
-- -----------------------------------------------------------------------------
-- A conta do assinante nasce aqui: o link de acesso (magic link) e a sessão.
-- Sem isso, o app tem duas metades que não se tocam: a vitrine pública (que
-- é o que existe) e o motor da prova (que roda no banco) — sem porta entre
-- as duas.
--
-- O PAPEL
--
-- `canone_auth` é um papel de SISTEMA, NOLOGIN: ninguém entra nele. Ele é o
-- que o backend troca ao servir /api/auth/*. Ele existe para que o acesso
-- não dependa de ser admin, e para que o papel do assinante (que NÃO pode
-- criar conta nem sessão) continue restrito.
--
-- O QUE ELE TOCA
--
-- Só a identidade: account, user_profile, user_role, session, magic_link.
-- Nada de conteúdo, nada de commerce, nada de log. O escopo é o princípio:
-- um endpoint público que envia e-mail é superfície de ataque; quanto menos
-- ele alcança, melhor.
--
-- A POLICY
--
-- identity.* tem RLS ENABLE + FORCE (a varredura da 014). Sem policy, o
-- papel de acesso não enxerga nem a própria tabela de sessão — e o
-- sintoma é o mesmo do furo de 2026-11-14: recusa silenciosa, agora na
-- porta de entrada.
--
-- A ENTREGA DO LINK
--
-- O link não é enviado por dentro do banco: o banco grava o token
-- (hasheado) e devolve o token CRU para o backend entregar pelo canal que
-- estiver configurado. O banco não sabe e não precisa saber mandar e-mail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · O PAPEL
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canone_auth') THEN
    BEGIN
      EXECUTE 'CREATE ROLE canone_auth NOLOGIN NOINHERIT';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION
        'O Cânone precisa do papel canone_auth (dono do fluxo de acesso). '
        'Peça ao DBA: CREATE ROLE canone_auth NOLOGIN NOINHERIT; e rode de novo.';
    END;
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA identity TO canone_auth';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON identity.account, identity.user_profile, identity.user_role, identity.session, identity.magic_link TO canone_auth';

  -- A policy: o papel de acesso é o dono do fluxo, então enxerga a
  -- identidade inteira. Nome explícito, para o catálogo mostrar onde.
  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'identity'
       AND c.relkind IN ('r','p')
       AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_full ON identity.%I', r.table_name);
    EXECUTE format(
      'CREATE POLICY auth_full ON identity.%I FOR ALL TO canone_auth USING (true) WITH CHECK (true)',
      r.table_name);
  END LOOP;

  -- O backend (papel técnico) troca para ele.
  EXECUTE 'GRANT canone_auth TO canone_app';
END $$;

COMMENT ON ROLE canone_auth IS
  'Papel de sistema do fluxo de acesso (link mágico e sessão). NOLOGIN. Alcança apenas identity.* — e a política dele é explícita porque identity.* tem RLS FORCE.';
