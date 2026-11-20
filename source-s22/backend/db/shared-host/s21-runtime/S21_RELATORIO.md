# Cânone V9 — relatório S21, PostgreSQL 17 real

**Release:** **NO-GO** | **Evidência obtida em:** `2026-11-15T02:17:46.990257+00:00` (UTC)

## Resultado confirmado

- **PostgreSQL 17.12 real** em Vercel Sandbox descartável, separado do Supabase.
- **17/17 scripts candidatos S13 aplicados:** bootstrap 001 + SQL 002–017. A cadeia de execução teve exit-code zero em todos os arquivos. **Não** testou as migrations 018–030 como overlay.
- **14 schemas canônicos, 83 tabelas**; 83/83 com RLS+FORCE, 0 schemas expostos aos papéis externos padrão; staff sem escrita em `support_access_grant`.
- **Asserções originais S13:** falharam em 2 funções `SECURITY DEFINER` pertencentes ao superusuário da fixture; a asserção A/B inicialmente falhou por falta de `USAGE` ao schema `canone_identity`.
- **Teste de correção isolada de privilégio:** concedido **somente no Sandbox** `GRANT USAGE ON SCHEMA canone_identity TO canone_subscriber`, teste A/B passou (A lê A, B lê B e tentativa de atualizar B a partir de A afeta 0 linhas).
- **Backup/restauração:** `pg_dump -Fc` → `pg_restore` em outro banco no mesmo cluster isolado passou; 14 schemas, 83 tabelas, dois perfis sintéticos, sentinela externa preservada.
- **Auditoria estática de contratos:** `canone_auth` ausente do bootstrap; **43 referências SQL distintas** a schemas antigos em strings executáveis do backend; falta `USAGE` para `canone_identity` na revisão 017. O `--strict` **recusa a liberação** (exit 41).
- **Regressões locais S11–S21:** **261/261** PASS (195 frontend com `node --experimental-strip-types`, 14 S11, 14 S12, 20 S13, 10 S20, 8 S21). Não equivalem a UAT navegador ou testes integrados da API.
- **Integridade:** 30/30 arquivos de migration originais preservados com hashes S5.

## Resultado operacional e distinções

O PG17 comprovou execução de DDL mas **não aprovou a segurança funcional**. O conjunto original das asserções ainda está em FAIL e precisa de correções aprovadas e reproduzidas em um banco recém-criado. O teste de owner privilegiado reflete a escolha do usuário SQL que aplicou as migrations candidatas (postgres no ensaio); precisa de política de ownership explícita no pipeline real. O `USAGE canone_identity` tem ausência na proposta de privilégio 017: é um bloqueio concreto. Também é necessária a harmonização completa do SQL/backend com os namespaces `canone_*` e o papel de login.

## Próximas ordens de trabalho bloqueantes

1. **WO-S22-01**: resolver mapa `canone_auth` e fronteira transacional/autenticação, incluindo GRANTs mínimos e testes de acesso/negação.
2. **WO-S22-02**: reconciliar consultas SQL do backend com namespaces `canone_*` e todos os objetos reais 018–030; usar parser ou revisão sistemática de diffs e ensaios integrados.
3. **WO-S22-03**: separar owners `SECURITY DEFINER` e refazer grants/policies para escrita auditável com `FORCE RLS`; testar função `grade_answer` contra enumeração.
4. **WO-S22-04**: completar DDL 018–030, revisão de concorrência, backup/restore em novo cluster e testes E2E API/navegador.
5. **WO-S22-05**: aprovações editoriais, normativas, jurídicas e humanas para a operação comercial.

## Restrições e rastreabilidade

Esta S21 **não modificou** Supabase compartilhado, Vercel de prévia, GitHub remoto ou migrations originais. O código S21 adiciona somente o auditor/validador local, ensaios e documentação. Não há certificação de segurança, validação de login em produção ou liberação comercial. A prévia S19 dos 26 módulos continua independente.

**Fontes normativas externas:** PostgreSQL 17 Row Security Policies (`https://www.postgresql.org/docs/17/ddl-rowsecurity.html`), `CREATE FUNCTION` (`https://www.postgresql.org/docs/17/sql-createfunction.html`) e [PGDG Apt](https://wiki.postgresql.org/wiki/Apt). Evidência de execução: `S21_PG17_RESULT.json`; análise dos 43 casos: `S21_BACKEND_CONTRACT_AUDIT.json`.
