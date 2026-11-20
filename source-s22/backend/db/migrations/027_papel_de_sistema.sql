-- =============================================================================
-- 027 · O PAPEL DE SISTEMA — QUEM AS FUNÇÕES DO BANCO OLHAM COM
-- -----------------------------------------------------------------------------
-- O FURO (medido, não suposto)
--
-- As funções SECURITY DEFINER (grade_answer, reveal_exam_key, a projeção, a
-- ingestão, a leitura do aluno) pertencem ao papel que rodou a migration.
-- Em PRODUÇÃO esse papel é comum: não é superusuário, e as tabelas têm RLS
-- ENABLE + FORCE — ou seja, o DONO também está sujeito às policies.
--
-- O dono comum não tem policy. Logo, a função enxerga ZERO linhas.
--
-- O QUE ISSO PRODUZ (medido em PGlite, simulando o dono de produção):
--
--   learning.grade_answer(item, 'C')  →  'errada'      <-- a CORRETA
--   learning.grade_answer(item, 'A')  →  'errada'
--
-- O aluno que ACERTOU é reprovado. E o pior: não há erro, não há exceção,
-- não há log — é um veredito FALSO, silencioso. A nota do aluno é contada
-- errado por baixo dos panos.
--
-- Por que os 139 testes passavam: no PGlite, `postgres` é SUPERUSUÁRIO e
-- superusuário ignora RLS mesmo com FORCE. Ou seja: o teste media uma
-- condição que PRODUÇÃO NÃO TEM. A suíte estava verde no vazio.
--
-- A CORREÇÃO
--
-- Um papel de SISTEMA: `canone_system`, NOLOGIN, sem BYPASSRLS, que é o
-- dono das funções SECURITY DEFINER e tem alcance explícito sobre as
-- tabelas de domínio. Três peças:
--
--   1. USAGE nos schemas + GRANT de tabela (o dono comum não tinha nem
--      privilégio de tabela — a função morria em "permission denied for
--      table").
--   2. Policy permissiva POR TABELA para canone_system (USING true).
--      Sem BYPASSRLS de propósito: o atributo BYPASSRLS só o superusuário
--      concede, e|num Postgres gerenciado o dono da base raramente é
--      superusuário. A policy funciona em qualquer ambiente.
--   3. As funções SECURITY DEFINER passam a ter canone_system como dono.
--
-- POR QUE ISSO NÃO É UM BURACO
--
-- canone_system é NOLOGIN: ninguém entra nele. canone_app NÃO é membro
-- dele (o app não pode virar o sistema). E o alcance do sistema não
-- ignora as REGRAS: RLS é visibilidade de linha, não é trigger. O sistema
-- ainda não publica sem verificação, ainda não reescreve o log de
-- auditoria, ainda não mexe no gabarito selado. As regras que moram no
-- banco continuam valendo para o papel mais poderoso que existe.
--
-- O QUE ESTE ARQUIVO PROVA (e é o que o teste 12 confere)
--
--   · nenhuma função SECURITY DEFINER do domínio tem dono que não seja o
--     papel de sistema;
--   · o papel de sistema NÃO é superusuário e NÃO tem BYPASSRLS — ou
--     seja, o schema não depende de o ambiente estar em modo superusuário;
--   · as funções do sistema enxergam o dado através do RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · O PAPEL DE SISTEMA
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_atual text := current_user;
  r       record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canone_system') THEN
    BEGIN
      EXECUTE 'CREATE ROLE canone_system NOLOGIN NOINHERIT';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION
        'O Cânone precisa do papel canone_system (dono das funções SECURITY DEFINER). '
        'Peça ao DBA: CREATE ROLE canone_system NOLOGIN NOINHERIT; e rode de novo.';
    END;
  END IF;

  -- O papel de sistema precisa de privilégio de tabela E de policy: o RLS
  -- é uma segunda barreira, não a única.
  EXECUTE format('GRANT USAGE ON SCHEMA identity, editorial, taxonomy, norms, learning, commerce, admin, ops, audit TO canone_system');
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity, editorial, taxonomy, norms, learning, commerce, admin, ops, audit TO canone_system');

  -- A policy permissiva, tabela por tabela. USING (true) = o sistema vê o
  -- estado final da transação. O nome é o da tabela: o catálogo mostra
  -- exatamente onde o sistema tem alcance.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops')
       AND c.relkind IN ('r','p')
       AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS system_full ON %I.%I', r.schema_name, r.table_name);
    EXECUTE format(
      'CREATE POLICY system_full ON %I.%I FOR ALL TO canone_system USING (true) WITH CHECK (true)',
      r.schema_name, r.table_name);
  END LOOP;

  -- O dono da função precisa poder transferi-la para o papel de sistema.
  EXECUTE format('GRANT canone_system TO %I', v_atual);
END $$;

-- -----------------------------------------------------------------------------
-- 2 · AS FUNÇÕES DO SISTEMA PASSAM A PERTENCER AO PAPEL DE SISTEMA
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, n.nspname AS schema_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prosecdef
       AND n.nspname IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit')
       AND pg_get_userbyid(p.proowner) <> 'canone_system'
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO canone_system', f.sig);
  END LOOP;
END $$;

COMMENT ON ROLE canone_system IS
  'Dono das funções SECURITY DEFINER do Cânone. NOLOGIN: ninguém entra nele. Tem alcance sobre as tabelas de domínio (privilégio + policy permissiva) porque as funções precisam enxergar o estado final da transação — as REGRAS (triggers) continuam valendo para ele.';

-- -----------------------------------------------------------------------------
-- 3 · O PORTÃO: O ALCANCE DO SISTEMA PODE SER AUDITADO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.system_reach()
RETURNS TABLE (
  funcao text,
  dono text,
  dono_superusuario boolean,
  dono_bypassrls boolean,
  alcancada boolean
)
LANGUAGE sql STABLE AS $$
  SELECT p.oid::regprocedure::text,
         pg_get_userbyid(p.proowner),
         r.rolsuper,
         r.rolbypassrls,
         has_table_privilege('canone_system', c.oid, 'SELECT')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    JOIN pg_class c ON c.oid = 'learning.item_option'::regclass
   WHERE p.prosecdef
     AND n.nspname IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit')
   ORDER BY 1
$$;

COMMENT ON FUNCTION ops.system_reach() IS
  'Auditoria do alcance do papel de sistema: quem é o dono de cada função SECURITY DEFINER, se esse dono é superusuário ou tem BYPASSRLS (o schema NÃO pode depender disso) e se o papel de sistema alcança as tabelas.';
