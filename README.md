# Cânone — preparação para exames de Contabilidade

**Código e planejamento do Cânone na única branch de trabalho `main`.** Versão: **[0.23.0-alpha.9](CHANGELOG.md)** · Estado: **NO-GO produção** · 20/11/2026.

> Este repositório contém uma **recuperação técnica histórica S22** e a **diretriz de produto S23 v0.3**, não um serviço pronto para produção, venda ou homologação.

## Escopo canônico

Plataforma educacional web/app para **Exame de Suficiência do CFC (P0)**, depois modalidades do **EQT**. Os 26 módulos são experiências sobre motores compartilhados (questões, tentativas, revisão, progresso, evidência e identidade), não 26 sistemas independentes. ERP, escritório real e automações profissionais ficam fora da V1.

O Cânone é separado do ecossistema *Calculadoras de Enfermagem / CKO / NCOS*.

## Crosswalk técnico para Supabase — marco v0.23.0-alpha.2

- **30/30 migrations** mapeadas para o destino de plataforma, com SHA-256 dos arquivos originais preservados.
- **90/90 tabelas S22** reconciliadas: 87 tabelas de domínio em schemas `canone_*` e 3 funções de autenticação substituídas por Supabase Auth.
- **43 FKs com `identity.account`** identificadas para adaptação ao `auth.users`; nove papéis e dez correspondências Auth/RLS especificados.
- **14/14 schemas** mapeados, sem tocar `public` global, `auth` ou `storage` do Supabase.
- Artefatos: [crosswalk legível](docs/CROSSWALK_PADRAO_SUPABASE_0_23_0_ALPHA2.md), [crosswalk JSON](crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json), [gerador](tools/canone_supabase_crosswalk.py) e [testes](tests/test_canone_crosswalk.py).
- **Sem HOLD genérico de desenvolvimento:** incompatibilidades têm regras e próximas ações. Produção permanece separada sob `NO_GO` até testes de Auth/RLS/PG17/segurança.

## Piloto de identidade/proveniência — marco v0.23.0-alpha.3

- **SQL de staging, sem aplicação remota:** [candidato de identidade e ponte de fontes](staging/supabase/001_identity_and_source_bridge.candidate.sql.txt), com 7 tabelas, 7 RLS+FORCE e 3 políticas de perfil próprio.
- Usa `auth.users(id)` do Supabase Auth; não duplica `identity.account`, `identity.session` ou `identity.magic_link`.
- Mantém papéis administrativos, dados sensíveis e referências de origem sem grants diretos ao navegador.
- [Manifesto SHA-256](staging/supabase/CANONE_IDENTITY_BRIDGE_PILOT_MANIFEST.json), [validador](tools/verify_supabase_stage_pilot.py), [testes estáticos](tests/test_supabase_stage_pilot.py), [PGlite in-memory](tests/supabase_stage_pilot_pglite.mjs) e [evidência CI](docs/evidences/SUPABASE_IDENTITY_PILOT_CI_20261120.json).
- CI validou **11/11 testes estáticos**, **7 tabelas executadas em PGlite, 14 verificações**, além de **277/277 testes S22** e gate `NO-GO` intacto.
- **Escopo:** piloto inicial; não significa 30 migrations portadas, 87 tabelas implantadas ou PG17 gerenciado homologado. Ver [documentação de implantação](docs/IDENTIDADE_SUPABASE_PILOTO_ALPHA3.md).

## Conversão física S22 — marco v0.23.0-alpha.4

A conversão agora é **gerada automaticamente em Python**, testada em **PostgreSQL em memória com JavaScript**, e versionada somente na `main`:

- **82 `CREATE TABLE` e 3 tipos ENUM** gerados e validados, mais 5 tabelas do piloto; 3 tabelas legadas de login substituídas por Supabase Auth: **90/90 origens reconciliadas**.
- **67 índices e 12 alterações estruturais** (`ALTER TABLE`) convertidos; quatro índices não recriados foram classificados individualmente para evitar duplicação ou exigir pré-requisito `pg_trgm`.
- CI no [run 44671597384](https://github.com/auditeduca/canone/actions/runs/44671597384): **89 tabelas criadas**, **89 RLS+FORCE**, **158 verificações de execução**, **19 testes Python de conversão** e **277 testes legados**.
- Geradores [tabelas](tools/convert_canone_schema.py) e [índices/constraints](tools/convert_canone_constraints.py), SQL candidatos [002](staging/supabase/002_domain_tables_82.candidate.sql.txt) e [003](staging/supabase/003_indexes_constraints.candidate.sql.txt), [manifestos](staging/supabase/) e [relatório operacional](docs/CONVERSAO_FISICA_S22_ALPHA4.md).

**Atenção:** `CREATE TABLE`, `ALTER TABLE` e índices compilados não substituem a migração de funções, triggers, views, RLS de acesso e fontes licenciadas. Os candidatos não são aplicáveis automaticamente ao Supabase remoto.

## Conversão de views e RLS — marco v0.23.0-alpha.5

- **Inventário auditável de 182 instruções**: 18 views, 58 funções, 26 triggers e 80 `CREATE POLICY`, com hashes e localização.
- **16 views convertidas** para `security_invoker=true`, **18 políticas de propriedade** em 12 tabelas e **1 função Auth** substituída por `auth.uid()` em vez de variável de sessão legado.
- **12/12 testes Python**, **23 verificações adversariais em PGlite** para perfis A/B; total de **89 tabelas e 21 políticas** (três do piloto original) compiladas. [CI 44674089869 aprovado](https://github.com/auditeduca/canone/actions/runs/44674089869).
- Artefatos: [gerador](tools/convert_canone_behaviour.py), [views](staging/supabase/004_invoker_views.candidate.sql.txt), [políticas](staging/supabase/005_owner_policies.candidate.sql.txt), [função](staging/supabase/006_auth_user_id_compat.candidate.sql.txt), [inventário](staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json) e [documentação](docs/CONVERSAO_COMPORTAMENTO_S22_ALPHA5.md).
- **Próximo escopo:** conversão de 57 definições remanescentes de funções, 26 triggers, duas views dependentes, políticas de serviços e E2E em PostgreSQL 17/Supabase independente. Sem mudança remota e sem GO de produção.

## Proteção de integridade — marco v0.23.0-alpha.6

- **7 funções revisadas** em `SECURITY INVOKER` e **20 triggers** de preservação de gabaritos definitivos, audit trail/SRS append-only e 12 carimbos `updated_at`.
- Novo gerador [Python](tools/convert_canone_integrity.py), [SQL 007](staging/supabase/007_integrity_triggers.candidate.sql.txt), [manifesto SHA-256](staging/supabase/CANONE_INTEGRITY_ALPHA6_MANIFEST.json), [testes de execução](tests/canone_integrity_pglite.mjs) e [documentação](docs/CONVERSAO_INTEGRIDADE_S22_ALPHA6.md).
- [CI aprovado](https://github.com/auditeduca/canone/actions/runs/44675846859): 14 testes Python, 27 verificações PGlite, funções sem `EXECUTE` para navegador, bloqueios de adulteração e UPDATE legítimo de nota pelo proprietário autenticado.
- Restam **50 instruções históricas de função** fora da whitelist e parte dos triggers originais, além de concorrência/PG17/Supabase Auth e cálculo seguro de hashes.
- SQL candidato **não implantável**; sem banco compartilhado, nova branch ou deploy. `NO_GO` para publicação.

## Cadeia de auditoria e selo — marco v0.23.0-alpha.7

- [Gerador auditável](tools/convert_canone_audit_seal.py), [template SQL](tools/sql_templates/canone_alpha7_audit_seal.sql.txt), [candidato 008](staging/supabase/008_audit_chain_and_seal.candidate.sql.txt), [manifesto](staging/supabase/CANONE_AUDIT_SEAL_ALPHA7_MANIFEST.json) e [documentação](docs/CONVERSAO_AUDITORIA_SELO_ALPHA7.md).
- **Cadeia de hashes v2:** conteúdo de 15 campos, ordenação de escrita por `pg_advisory_xact_lock`, sequência no servidor, verificação integral e bloqueio de TRUNCATE; acesso do navegador negado.
- **Selo:** gabarito deve nascer preliminar; transição para definitivo exige itens/entradas `1..N` completos, com locks coordenados.
- [GitHub Actions PostgreSQL 17.12 e PGlite](https://github.com/auditeduca/canone/actions/runs/44677935551): 12 testes Python, 21 cenários PGlite, 12 sessões concorrentes de auditoria sem hashes inválidos, e teste simultâneo de selo versus inclusão recusada. SQL **não foi implantado em Supabase**.
- **Pendências para liberação:** âncora externa imutável de auditoria, testes adicionais de interleavings, Auth gerenciado, funções legadas restantes e E2E; `NO_GO` apenas para produção.

## Fluxo privado de tentativas e SRS — marco v0.23.0-alpha.8

- **5 funções internas de serviço e uma tabela de idempotência SRS:** [gerador Python](tools/convert_canone_attempt_srs.py), [SQL 009 candidato](staging/supabase/009_attempt_grade_srs.candidate.sql.txt), [manifesto de fontes](staging/supabase/CANONE_ATTEMPT_SRS_ALPHA8_MANIFEST.json), [testes PGlite](tests/canone_attempt_srs_pglite.mjs), [teste PostgreSQL 17](tests/pg17_alpha8_attempt_srs.sh) e [documentação](docs/CONVERSAO_TENTATIVAS_SRS_ALPHA8.md).
- [CI alpha.8](https://github.com/auditeduca/canone/actions/runs/44680388780) **PASS**: 12 testes Python, 32 verificações PGlite e três verificações de segurança/concorrência no PostgreSQL 17 (resposta após fechamento, dois pedidos SRS simultâneos e permissão negada ao navegador). Regressões S22: 277/277.
- Serviço interno apenas: `service_role` sem exposição ao cliente; `auth.uid()` deve vir de um backend que realmente verifica o JWT. **Não houve deploy em Supabase.**
- A correção usa gabarito definitivo e posição da variante; a nota de corte/resultado de aprovação fica sem cálculo até haver regra oficial aplicável e direitos editoriais. `NO_GO` produção.

## Gateway Auth + assinatura — marco v0.23.0-alpha.9

O primeiro backend de confiança para as funções privadas de prova já está versionado em `main`, sem deploy:

- [Cinco rotas e executor PostgreSQL](gateway/alpha9-core.mjs), [servidor loopback](gateway/alpha9-server.mjs), [gate SQL 010](staging/supabase/010_private_feature_gate.candidate.sql.txt), [manifesto](staging/supabase/CANONE_ALPHA9_GATEWAY_MANIFEST.json), [testes Node](tests/alpha9-gateway.test.mjs), [testes PG17](tests/pg17_alpha9_entitlement.sh) e [documentação](docs/ALPHA9_GATEWAY_AUTH_ENTITLEMENT.md).
- [GitHub Actions 44682865475](https://github.com/auditeduca/canone/actions/runs/44682865475) **PASS**: 13 testes Node, autorização negativa/positiva em PostgreSQL 17, verificação de 9 lotes anteriores e regressões históricas preservadas.
- **Identidade** validada por Supabase Auth `/auth/v1/user` a cada chamada; o banco recebe somente o sujeito retornado. **Acesso** depende de assinatura ativa e recurso habilitado ou concessão válida.
- **Sem publicação:** apenas testes sintéticos; não existe projeto Supabase exclusivo acessível, nem credenciais/JWT de produção, nem direito editorial homologado. `NO_GO` continua apenas para promoção operacional.

## O que está versionado na main

- **389 arquivos de código recuperados do S22**, no diretório [source-s22/](source-s22/), sem serem promovidos à raiz executável.
- **30 migrations SQL originais**, mantidas sob `source-s22/backend/db/migrations/`; **não executadas no Supabase**.
- [Manifesto SHA-256](inventories/source/CANONE_S22_SOURCE_IMPORT_MANIFEST.json), incluindo 87 arquivos retidos fora do repositório sob revisão de origem/direitos.
- [Planejamento S23](planning/s23/) de exames CFC, fases, módulos e gates.
- Inventários [Supabase](inventories/supabase/) e [Drive/Biblioteca](inventories/sources/); dados compartilhados não foram importados.
- CI de integridade/regressão em [GitHub Actions](.github/workflows/canone-s22-recovery.yml), **sem deploy, sem conexão com bancos e com gate NO-GO**.

**Evidência CI:** [execução de 19/11/2026](https://github.com/auditeduca/canone/actions/runs/44663305666) — 389/389 hashes, 277/277 testes locais, bloqueio de produção (exit 41) confirmado. Esses testes não substituem PostgreSQL isolado, browser E2E, testes de conteúdo normativo ou revisão de segurança.

## Versionamento

- **Apenas `main` para os novos trabalhos** — nenhuma nova branch.
- Arquivos canônicos: [VERSION](VERSION), [CHANGELOG.md](CHANGELOG.md), [Política de versionamento](docs/VERSIONAMENTO_MAIN.md).
- Cada modificação recebe commit com motivo, testes e bloqueios registrados.
- Pré-versões (`alpha`/`beta`/`rc`) são snapshots de engenharia. **Não** equivalem a tags, releases públicos ou autorização de produção.
- A PR histórica [#2](https://github.com/auditeduca/canone/pull/2) foi integrada; sua branch antiga permanece apenas como referência histórica, não como área de trabalho.

## Próximo trabalho

1. Revisar os 87 arquivos excluídos e direitos/licenças; não publicar materiais CFC/Senado sem fonte oficial e autorização.
2. Validar 30 migrations e segurança (RLS, grants, roles, SECURITY DEFINER, autenticação) em PostgreSQL descartável; depois staging individual do Cânone.
3. Selecionar por finalidade e direitos as 54 tabelas/27 views candidatas do Supabase compartilhado; **não copiar banco inteiro nem dados de enfermagem**.
4. Concluir uma jornada real do aluno CFC (aula → questão licenciada → tentativa → feedback → revisão → progresso persistido), desktop/mobile.
5. Homologar acessibilidade, segurança, fontes, conteúdo e governança; obter aprovação expressa antes de produção.

Documentação: [Consolidação multifonte](docs/CONSOLIDACAO_MULTIFONTE_S22_S23_SUPABASE_20261119.md), [Programa Mestre S22–S26](docs/PROGRAMA_MESTRE_S22_S26.md), [Plano Supabase exclusivo](docs/PLANO_MIGRACAO_CANONE_SUPABASE_EXCLUSIVO.md), [Evidências e bloqueios](docs/REGISTRO_EVIDENCIAS_BLOQUEIOS.md).

## Estado dos ambientes

| Ambiente | Status |
| --- | --- |
| GitHub `auditeduca/canone` | `main` com recuperação S22 e planejamento S23 |
| Vercel `canone-contabilidade-preview` | Preview ilustrativo, não homologado; sem ligação Git confirmada no projeto acessível |
| Supabase compartilhado `Calculadoras-Smart` | 14 schemas reservados, apenas 4 tabelas nativas de controle; sem migrations de domínio aplicadas |
| Supabase exclusivo do Cânone | A criar pelo proprietário |
| Produção/comercial | **NO-GO** |

Não inserir credenciais, dados pessoais, gabaritos não homologados ou obras protegidas neste repositório público.
