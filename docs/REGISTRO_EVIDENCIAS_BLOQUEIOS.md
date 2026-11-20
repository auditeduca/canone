> **CAMADA COMPORTAMENTAL S22 — 20/11/2026, v0.23.0-alpha.5:** inventário SHA-256 de 18 views, 58 declarações de função, 26 triggers, 80 políticas; 16 views `security_invoker`, 18 políticas próprias restritivas em 12 tabelas e 1 função Auth convertidas. CI [44674089869](https://github.com/auditeduca/canone/actions/runs/44674089869) validou 12 testes Python e PGlite com 89 tabelas/16 views/21 políticas e 23 verificações A/B, além dos 277 testes legados. Ainda não convertidos: 57 definições de função, 26 triggers, duas views e 67 políticas fontes fora da whitelist. `NO_GO` permanece para produção; nenhuma escrita Supabase remota. Documentação: `docs/CONVERSAO_COMPORTAMENTO_S22_ALPHA5.md`.\n\n> **CONVERSÃO FÍSICA S22 — 20/11/2026, versão 0.23.0-alpha.4 na main:** 30/30 originais verificados; 90/90 origens: 82 DDL criados, 5 objetos já no piloto, 3 Auth gerenciados; 3 ENUM, 67 índices, 12 ALTER gerados; 4 índices classficados como excluídos por redundância/Auth/pg_trgm; PGlite 89 tabelas com 89 RLS+FORCE e 158 verificações; 19 testes Python e 277/277 regressões passaram no [CI 44671597384](https://github.com/auditeduca/canone/actions/runs/44671597384). Preservados `NO_GO` operacional, ausência de escrita remota, falta de conversão de funções/triggers/views/policies e necessidade de PG17 isolado. Veja `docs/CONVERSAO_FISICA_S22_ALPHA4.md`. Todo trabalho na `main`.\n\n> **ATUALIZAÇÃO — 19/11/2026, S22/S23 na `main`:** Código histórico recuperado (389 caminhos incluídos, 87 excluídos, 30 SQL originais) e versionado diretamente na `main` como `0.23.0-alpha.1`. PR #2 integrada; CI verificou 389 SHA-256, 277/277 regressões locais e bloqueio `NO-GO` (exit 41). **A importação no controle de versão está concluída**, mas **não é liberação para execução**. Nenhuma migration ou dado compartilhado foi implantado no Supabase; há 41 FKs candidatas (3 entre schemas), e 27 views compartilhadas, das quais uma `public.cfc_internal_library_catalog_v` não possui opção explícita `security_invoker` e requer revisão de concessões. Confirmar autenticidade/segurança normativa, licenças e teste PostgreSQL real em staging independente. O processo passa a seguir exclusivamente [VERSIONAMENTO_MAIN.md](VERSIONAMENTO_MAIN.md).

> **ATUALIZAÇÃO 19/11/2026 — FONTE RECUPERADA:** S22 app e bundle encontrados na Biblioteca; hashes conferidos e commit `164fa4df8e99de29e35c41d35a25f6ee0b2c6462` validado por clone local. A hipótese de ausência física da fonte (B-001) foi **resolvida como descoberta**, mas sua **importação no GitHub e auditoria de segurança/licença** continuam pendentes. Migrations candidatas S22 30/30 e testes históricos 277/277 PASS não equivalem a aplicação no Supabase nem GO. S23 v0.3 prioriza CFC. Nova evidência e inventário em [Consolidação multifonte](CONSOLIDACAO_MULTIFONTE_S22_S23_SUPABASE_20261119.md). Demais entradas abaixo refletem o corte inicial e são preservadas como histórico.

# Registro de evidências, premissas e bloqueios
**Corte de consulta:** 2026-11-19 · **Versão:** 0.1.0 · **Estado:** READ_ONLY_INSPECTION

## Fatos confirmados por conectores no corte
| Código | Ambiente | Constatação | Situação |
|---|---|---|---|
| EV-001 | GitHub `auditeduca/canone` | Repo público, `main` nominal, permissões administrativas; criado vazio, sem branch, commit nem PR antes do bootstrap | VERIFIED |
| EV-002 | Supabase `pgsybzggewhinaniybiy` | Projeto `Calculadoras-Smart` ACTIVE_HEALTHY | VERIFIED |
| EV-003 | Supabase | 14 schemas `canone_*`; apenas 4 tabelas de controle em `canone_control`; todas têm RLS, sem policies | VERIFIED |
| EV-004 | Supabase `canone_control.migration_catalog` | 30 registros, números 1–30, todos `NOT_APPLIED` | VERIFIED |
| EV-005 | Supabase `canone_control.release_gate` | `prod_release=NO_GO`, `commercial=NO_GO`, `backend_identity=HOLD_HUMAN`, `domain_migrations=HOLD_DEPENDENCY`, `regulatory_evidence=HOLD_SOURCE` | VERIFIED (registro gravado 2026-11-14) |
| EV-006 | Supabase `canone_control.external_source_binding` | 3 registros com `READ_ONLY_NOT_CONNECTED` e `grant_status=NONE` | VERIFIED |
| EV-007 | Vercel `canone-contabilidade-preview` | Último deployment consultado `dpl_J5SJzkgQVfNiyeyn7GBN6546vrLS`: READY, target null, Vite; nenhuma homologação funcional decorrente | VERIFIED |
| EV-008 | GitHub `IndiciumFIN/dev-chatgpt-workspace`, `IndiciumFIN/calculadorasdeenfermagem` | Busca pontual de branches/PRs chamadas `canone` não encontrou source canônico S21 | PARTIAL_SEARCH |

## Declarações históricas a reconciliar (não homologadas neste repo)
| Código | Declaração recebida do projeto | Prova necessária | Gate |
|---|---|---|---|
| CL-001 | S21 relatou 16/30 migrations testadas isoladamente em PostgreSQL 17.12 | Manifesto, arquivos, logs, commits | HOLD_SOURCE |
| CL-002 | S21 relatou 261/261 testes de regressão PASS | Workflow ou arquivo log assinado + commit | HOLD_SOURCE |
| CL-003 | Preview conteria 26 módulos demonstrativos | Inventário de rotas, código e ensaio E2E | HOLD_SOURCE |
| CL-004 | Back-end e motor único parcialmente planejados | Código-fonte, contrato, PR, testes | HOLD_SOURCE |

## Bloqueios materiais
1. **B-001 P0 — Origem S21 ausente:** localizar material original e recuperar os hashes sem inventar commits.
2. **B-002 P0 — Banco de domínio não implantado:** catálogo 30/30 NOT_APPLIED e 13 schemas de negócio vazios; não executar no banco compartilhado.
3. **B-003 P0 — Identidade e autorização:** RBAC/grants/funções/autenticação não homologados.
4. **B-004 P0 — Fonte jurídica/normativa:** direitos, íntegra e vigência CFC/Senado ainda não atestados.
5. **B-005 P1 — UI sem backend:** Vercel READY não comprova serviço end-to-end.
6. **B-006 P1 — Módulos:** cobertura, dados e conteúdos dos 26 ainda não rastreados ao código.

## Política de atualização
Cada nova evidência deve conter `fonte/URI`, `data observada`, `sha/versão`, `método de validação`, `resultado`, `limitação` e `decisão`. Qualquer mudança de `HOLD` para `PASS` exige artefato verificável e revisão independente. Não modificar fatos históricos sem preservar o registro anterior.