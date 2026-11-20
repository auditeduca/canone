# Histórico de versões — Cânone

Todas as alterações de engenharia e de conteúdo do Cânone serão versionadas **somente na branch `main`**, por commits Git e registro de versão. O projeto permanece em desenvolvimento; a existência de uma versão não significa que ela esteja aprovada para produção.

Formato de versão: **MAJOR.MINOR.PATCH[-PRERELEASE]**, em que:
- `0.x.y`: software em construção, contratos ainda sujeitos a mudança;
- `-alpha.N`: inventário, integração e testes internos;
- `-beta.N`: fluxo funcional candidato a homologação;
- `-rc.N`: candidata a aprovação, sujeita a revisão independente;
- estável: somente quando todos os gates forem `GO`.

## [0.23.0-alpha.2] — 2026-11-19

**Estado:** `PLATFORM_CROSSWALK_30_90_COMPLETE / DEV_CONTINUES / RELEASE_NO_GO`.

### Crosswalk canônico implementado
- Inventário determinístico de **30/30 migrations S22**, preservadas por SHA-256; **14/14 schemas** traduzidos para `canone_*`.
- Reconciliação física de **90/90 tabelas**: 87 tabelas de domínio a projetar e três recursos de login substituídos pelo Supabase Auth.
- Mapeamento de **43 referências a `identity.account`** para contrato `auth.users`; 10 regras de identidade/autenticação e nove papéis de acesso.
- Três referências entre schemas compartilhados mapeadas para contratos de proveniência `canone_bridge`, sem cópia integral de acervos CE/CKO.
- Gerador `tools/canone_supabase_crosswalk.py` e validação de integridade sem executar SQL.
- Catálogo [JSON](crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json), [documento operacional](docs/CROSSWALK_PADRAO_SUPABASE_0_23_0_ALPHA2.md) e **10 testes automáticos de contrato**.

### Separação de status
**Mapeado e versionado** não é sinônimo de **migration executável/homologada**. Autenticação e RLS exigem código de adaptação e testes de PG17; conteúdo e licenças continuam em revisão própria. Desenvolvimento segue sem bloqueio genérico, produção permanece `NO_GO`.

## [0.23.0-alpha.1] — 2026-11-19

**Estado:** `SOURCE_RECOVERED / CI_OFFLINE_ONLY / RELEASE_NO_GO`.

### Acrescentado
- Fonte histórica S22 recuperada sob `source-s22/` (389 arquivos), isolada da raiz de publicação.
- 30 migrations originais **versionadas, nunca aplicadas automaticamente**.
- Manifesto de integridade por SHA-256 e 87 exclusões sob `HOLD_RIGHTS` / revisão.
- Planejamento S23 para Exame de Suficiência e EQT/CFC, com quatro matrizes CSV.
- Inventário do Supabase compartilhado: 81 relações, 54 tabelas e 27 views candidatas; colunas, ACL, FK e registros das 4 tabelas nativas de controle.
- Histórico de descobertas ChatGPT/Google Drive com deduplicação nominal por referência.
- CI de recuperação sem deploy, hashes e suíte local, mais gate `NO-GO`.
- Documentação para migrar seletivamente a um projeto Supabase exclusivo, ainda inexistente.

### Validação
- **389/389 hashes conferidos** no workflow de recuperação;
- **277/277 testes locais** com dependência de compatibilidade TS5.8.3 isolada no CI;
- `s22_release_gate.py --strict`: bloqueio `NO-GO` intencional, código 41;
- Não foram reexecutados neste GitHub os testes completos de PostgreSQL 17, browser E2E, pagamentos ou gabaritos de exame reais.

### Pendências
Segurança RLS/roles e funções privilegiadas, direitos/fontes oficiais, revisão dos 87 excluídos, staging Supabase independente, teste integrado aluno CFC e aceite humano. **Proibido declarar GO ou executar migrations a partir desta versão.**

_Registro de versão documental: não implica criação de tag Git, release GitHub ou deploy._
