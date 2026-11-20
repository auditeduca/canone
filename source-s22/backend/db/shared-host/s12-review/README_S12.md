# Cânone V9 — S12: revisão semântica candidata, NO-GO

**Baseline imutável:** `716e01fd6c3619e336c1d7b2494f19355b951c29` (`work/canone-s11-portability`, tag `canone-v9-s11-preview-no-go`).
**Escopo:** 006–014 e privilégio dependente 017.
**Estado:** `PROPOSED_HOLD_NOT_EXECUTABLE`; **não** são migrations homologadas.

## Entregas geradas

- `reviews/S12_REVIEW_ONLY_*.sql.txt`: 10 propostas de alteração independentes, com SHA-256 de fonte e referência à revisão S11. Não executar, não renomear para `.sql` e não incluir no runner.
- `diffs/*.diff`: diferenças em relação à projeção léxica original S11.
- `S12_MANIFEST.json`: arquivo e intervenções, hashes, proveniência e limites.
- `s12_generate_candidates.py`: gerador determinístico e *fail-closed*, sem conexão ao Supabase, sem modificação de migrations originais.
- `test_s12_candidates.py`: 14 gates estáticos (testa inclusive adulteração do hash de origem).
- `evidence/test_run.log` e `evidence/s11_regression_node.log`: logs da execução local. Os 14 testes antigos e 14 novos passaram nos ambientes indicados nos logs.

## Reprodução no clone do S11

O diretório completo `s12-review` deve ser colocado sob `backend/db/shared-host/s12-review/` de um clone confiável de S11. Execute:

```bash
python3 backend/db/shared-host/s12-review/s12_generate_candidates.py \
  --source . \
  --output backend/db/shared-host/s12-review
python3 -m unittest discover -s backend/db/shared-host/s12-review -p 'test_s12_candidates.py' -v
cd backend && node --test db/shared-host/tests/*.test.mjs
```

O gerador **não** importa automaticamente a pasta `reviews/` para nenhum runner. Não autoriza backend, Supabase, Vercel ou GitHub remoto.

## Intervenções propostas por migration

| Migration | Adaptação candidata | Situação |
|---|---|---|
| 006 | Função privilegiada de correção com `search_path` restrito e revogação EXECUTE de `PUBLIC` | Sem ensaio funcional; endpoint de correção ainda pode revelar o gabarito por enumeração |
| 007 | Portabilidade dos identificadores em corpos SQL/PLpgSQL; SRS não foi homologado | HOLD |
| 008 | Projeção de namespaces do comércio, não é autorização de cobrança | HOLD |
| 009 | Encadeamento de auditoria com lock transacional de escritor único **proposto** | Precisa teste de concorrência real e isolamento |
| 010 | Projeção de namespaces operacionais | HOLD; segredos, jobs e integrações não homologados |
| 011 | Portabilidade de funções e nomes das 13 tabelas no SQL dinâmico de triggers | Sem prova de DDL e comportamento em PostgreSQL |
| 012 | Portabilidade de SQL procedimental do motor SRS | Precisa idempotência/replay/concorrência |
| 013 | View de progresso com `security_invoker=true` e filtro de titular | Precisa grants de tabelas e teste adversarial com dois usuários |
| 014 | RLS limitado a 9 schemas `canone_*`; bloqueio de auto-concessão staff; correção de policy de segredos; endurecimento da função de suporte | Falta comprovação de owners, sessões confiáveis e coerência entre RLS/grants |
| 017 | Remove alterações ACL no schema global `public`; concede USAGE somente aos schemas `canone_*`; remove escrita staff em concessões e leitura direta da view de mestria | Envolve decisão de autorização e validação DBA |

## Gates bloqueantes sem exceção

1. **S12-G01 Bootstrap:** revisar `001`, propriedades `BYPASSRLS`, `NOINHERIT`, `SET ROLE`, extensões e owner com DBA. Nenhum comando global deve afetar outras aplicações.
2. **S12-G02 PostgreSQL descartável real:** integrar 002–014 com 015–017 em um banco totalmente isolado; usar usuários A, B, staff, admin e anônimo sintéticos. `PGlite` não substitui esse gate.
3. **S12-G03 RLS/ACL:** verificar `pg_class.relrowsecurity`, `relforcerowsecurity`, `pg_policies`, `pg_roles`, `has_table_privilege`, `has_function_privilege` e o diff externo zero.
4. **S12-G04 Identidade e sessão:** validar assinatura/autenticação no backend, vínculo da configuração `app.current_user_id`, autorização de papéis e revogação; GUC por si só não é identidade confiável.
5. **S12-G05 Suporte:** grant somente mediante aprovação independente, revogação, escopo, validade e trilha auditável; verificar se a função `SECURITY DEFINER` consegue registrar o log sob RLS FORCE sem BYPASSRLS.
6. **S12-G06 Avaliação:** gabarito não pode ser descoberto por chamadas repetidas de `grade_answer` para A–E; corrigir o fluxo de tentativa no motor único, preservando contratos.
7. **S12-G07 Concorrência e replay:** audit hash chain sem bifurcações em inserções concorrentes, SRS idempotente, teste de `READ COMMITTED` e isolamento superior, rollback/restore.
8. **S12-G08 Liberação:** gates jurídicos/editoriais, UAT e segurança de sessão comercial independentes; aprovação humana + revisão normativa antes de alterar banco compartilhado.

**Atenção:** habilitar `FORCE ROW LEVEL SECURITY` sobre tabelas sem política pode bloquear escrita das funções e triggers (inclusive `canone_admin.support_access_log`). Isto é comportamento *fail-closed* esperado, mas impede classificar o overlay como operacional. `canone_admin` ainda recebe acesso direto a outras tabelas de progresso pela proposta de 017, o que exige decisão de arquitetura de concessões auditadas.

## Fontes oficiais para revisão humana

- PostgreSQL [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- PostgreSQL [CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html): `security_invoker` usa privilégios/policies do invocador.
- PostgreSQL [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html): `SECURITY DEFINER` requer caminho confiável e revogação explícita de `PUBLIC`.

## Estado de implantação

Nenhum script SQL executado. Nenhum arquivo original de `backend/db/migrations/` modificado. Nenhum push remoto, deploy ou escrita no Supabase. O destino exclusivo Cânone no GitHub ainda depende de confirmação; **não** integrar no workspace da Calculadoras de Enfermagem por engano.
