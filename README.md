# Cânone — preparação para exames de Contabilidade

**Código e planejamento do Cânone na única branch de trabalho `main`.** Versão: **[0.23.0-alpha.1](CHANGELOG.md)** · Estado: **NO-GO produção** · 19/11/2026.

> Este repositório contém uma **recuperação técnica histórica S22** e a **diretriz de produto S23 v0.3**, não um serviço pronto para produção, venda ou homologação.

## Escopo canônico

Plataforma educacional web/app para **Exame de Suficiência do CFC (P0)**, depois modalidades do **EQT**. Os 26 módulos são experiências sobre motores compartilhados (questões, tentativas, revisão, progresso, evidência e identidade), não 26 sistemas independentes. ERP, escritório real e automações profissionais ficam fora da V1.

O Cânone é separado do ecossistema *Calculadoras de Enfermagem / CKO / NCOS*.

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
