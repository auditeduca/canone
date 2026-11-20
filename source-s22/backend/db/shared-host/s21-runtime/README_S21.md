# Cânone S21 — validação PostgreSQL 17 / contratos

S21 é uma revisão técnica **não promovível**. Nenhuma migration original 001–030 foi alterada.

## Execução local, sem acesso a bancos

```bash
python3 backend/db/shared-host/s13-isolated/prepare.py --check
python3 -m unittest discover -s backend/db/shared-host/s21-runtime -p 'test_s21_contracts.py' -v
python3 backend/db/shared-host/s21-runtime/audit_contracts.py --report
python3 backend/db/shared-host/s21-runtime/audit_contracts.py --strict  # exit 41: P0 BLOCKED
```

O scanner localiza referências SQL diretas a schemas antigos nas strings TypeScript de execução, confronta os papéis do backend com o bootstrap S13 e exige USAGE de `canone_identity`. O scanner é um gate complementar, não um parser SQL/TS completo. Um relatório com sucesso (`--report`) não equivale à liberação; `--strict` deve falhar até as P0 serem resolvidas.

## PostgreSQL real, Vercel Sandbox descartável

O ensaio S21 executou PostgreSQL 17.12 (PGDG Ubuntu resolute), banco `canone_s13_disposable` com sentinela `s13_sentinel.disposable_marker = 's13-verified'`, sem conexão ao Supabase. O `prepare.py --stage-disposable` gerou 001 bootstrap e 002–017 review-only, aplicados em ordem: **17/17 PASS de DDL**. Os testes `assertions.sql` e `assertions_two_users.sql` falharam inicialmente por proprietários superusuários em 2 funções SECURITY DEFINER e falta de USAGE no schema `canone_identity`. O segundo teste passou após GRANT apenas na fixture.

Também foi concluído `pg_dump -Fc` e `pg_restore -e` em outro banco descartável: 14 schemas canônicos, 83 tabelas e duas identidades sintéticas preservadas. Nenhum dado real foi usado.

Os achados de `canone_auth` inexistente e SQL backend ainda usando `identity`, `commerce` etc. são **bloqueios** de integração. A função privilegiada precisa de owner não-BYPASSRLS e políticas/grants funcionais após a redesign, sem concessões ad hoc em produção.

## Gates que continuam NO-GO

1. Resolver papéis/roles e contratos de schemas em todo backend, seguidos de testes reais no pool PostgreSQL 17.
2. Redesenhar e validar duas funções SECURITY DEFINER (incluindo fluxo de auditoria e bloqueio da enumeração de gabaritos).
3. Testar concorrência, RLS A/B em todos os domínios, grants de staff/admin e cenários adversariais.
4. Revisão editorial/normativa, copyright e UAT navegador; homologação e aprovação humana.
5. GitHub remoto canônico do projeto (não confundir com Calculadoras de Enfermagem).

**IMPORTANTE:** o zip final e o Git Bundle são cópias locais. Nenhuma correção foi aplicada ao Supabase, GitHub remoto ou Vercel produção.
