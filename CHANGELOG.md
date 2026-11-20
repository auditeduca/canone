# Histórico de versões — Cânone

Todas as alterações de engenharia e de conteúdo do Cânone serão versionadas **somente na branch `main`**, por commits Git e registro de versão. O projeto permanece em desenvolvimento; a existência de uma versão não significa que ela esteja aprovada para produção.

Formato de versão: **MAJOR.MINOR.PATCH[-PRERELEASE]**, em que:
- `0.x.y`: software em construção, contratos ainda sujeitos a mudança;
- `-alpha.N`: inventário, integração e testes internos;
- `-beta.N`: fluxo funcional candidato a homologação;
- `-rc.N`: candidata a aprovação, sujeita a revisão independente;
- estável: somente quando todos os gates forem `GO`.

## [0.23.0-alpha.5] — 2026-11-20

**Estado:** `INVOCATION_VIEWS_AND_OWNER_RLS_CI_PASS / RELEASE_NO_GO`.

### Comportamento do banco convertido
- Inventário com **182 instruções históricas**: 18 views, 58 declarações de função, 26 triggers (incluindo `CONSTRAINT TRIGGER`) e 80 instruções `CREATE POLICY`, com proveniência e SHA-256.
- **16/18 views** recompiladas em `canone_*` com `WITH (security_invoker=true)`. Duas dependem de `due_items` e do legado `identity.account` e não foram copiadas de forma insegura.
- **18 políticas owner-only** sobre 12 tabelas, usando `user_id=(select auth.uid())`. `SELECT` restrito; somente notas, favoritos e solicitações LGPD permitem escritas explicitamente listadas. Nenhum grant automático para gabaritos, conteúdo ainda não licenciado, staff ou admin.
- Primeira função de identidade `canone_ops.current_user_id()` substituída por `auth.uid()` com `SECURITY INVOKER`, sem confiar em `app.current_user_id`. **57 instruções de função** e **26 instruções de trigger** continuam no inventário para adaptação segura.
- Testes de conversão Python **12/12** e teste adversarial JavaScript **23 verificações**, com **89 tabelas, 16 views invoker e 21 políticas incluindo as três anteriores** em PGlite isolado.
- [CI aprovado no commit f35475d](https://github.com/auditeduca/canone/actions/runs/44674089869); regressão histórica 277/277 e gate de produção 41/NO_GO preservados.

### Fronteira de homologação
SQL permanece com sufixo `.candidate.sql.txt`, não migration implantável. A existência de views sem grants de leitura não prova API pronta. O PostgreSQL em memória simula Auth, não substitui Supabase Auth gerenciado/PG17, e nenhum SQL foi aplicado ao Supabase compartilhado. A homologação de funções privilegiadas, triggers, gabaritos, conteúdo e referências oficiais permanece antes do GO.

## [0.23.0-alpha.4] — 2026-11-20

**Estado:** `S22_PHYSICAL_DDL_82_TABLES_67_INDEXES_12_ALTER_CI_PASS / RELEASE_NO_GO`.

### Conversão automatizada Python/JavaScript
- Gerador Python `tools/convert_canone_schema.py` verificou a integridade dos **30/30 SQL originais** e extraiu **82 definições físicas de tabela**, somadas a **5 tabelas adaptadas pelo piloto** e **3 tabelas de autenticação substituídas pelo Supabase Auth** (90/90 origens).
- **3 tipos ENUM** de aprendizagem convertidos e criados antes do DDL que os utiliza.
- Gerador Python `tools/convert_canone_constraints.py` converteu **67 índices** e **12 ALTER TABLE** estruturais, deixando 4 índices devidamente classificados (1 Auth, 2 duplicados do piloto, 1 `pg_trgm`) e 16 alterações de RLS não duplicadas.
- **38 FKs inline** remapeadas para `auth.users` no novo lote; outras referências de identidade já tratadas pelo piloto. O catálogo preserva a origem de todos os objetos e os hashes.
- Testes Python **12/12 + 7/7**, e execução isolada PGlite com **89 tabelas**, **89 RLS+FORCE**, **67 índices**, **12 ALTER** e **158 verificações**. Regressão S22: **277/277 PASS**.
- Evidência [GitHub Actions 44671597384](https://github.com/auditeduca/canone/actions/runs/44671597384), commit testado `a33fa0949b19901f24db097a51b36344c03edc40`.

### Limites de homologação
A conversão **não inclui ainda** funções/triggers/SECURITY DEFINER, views, políticas de autorização finais e seeds com fontes/licenças. Arquivos gerados usam `.candidate.sql.txt`, não são migrations automaticamente aplicáveis. PGlite em memória não substitui PostgreSQL 17 gerenciado nem teste com JWT real. Não houve alteração de banco compartilhado, Vercel ou implantação de produção. Gate **NO_GO**.

## [0.23.0-alpha.3] — 2026-11-20

**Estado:** `IDENTITY_PILOT_STAGING_CANDIDATE / NO_REMOTE_WRITES / RELEASE_NO_GO`.

### Implementação do crosswalk
- Primeiro candidato DDL para **7 tabelas** em `canone_identity` e `canone_bridge`, com referências ao Supabase Auth, sem uma segunda tabela de credenciais.
- RLS com `FORCE` em 7 tabelas e **3 políticas de perfil próprio**; papéis e dados sensíveis não têm permissões de escrita direta do cliente.
- Guard de ambiente recusa a fonte compartilhada quando existe `canone_control.migration_catalog`; pré-requisito de `auth.users`; DDL transacional.
- Validador Python com manifesto SHA-256, **11 testes unitários/adversariais**, mais teste de execução do SQL em **PGlite descartável**, adicionado ao CI.
- A versão preserva todos os SQL S22 originais e os arquivos do crosswalk `0.23.0-alpha.2` intactos.

### Limitações explicitadas
- **Piloto somente para identidade/proveniência**, ainda não migração das 87 tabelas de domínio ou todas as 43 FKs do S22.
- SQL versionado como `.candidate.sql.txt`, não como migration automaticamente aplicável. Nenhuma tabela criada no Supabase remoto.
- O teste PGlite usa `auth.users` e `auth.uid()` simulados e não representa homologação PostgreSQL 17/Supabase.
- O aceite de segurança, fluxo completo do aluno CFC, fontes e direitos continua necessário **somente para promoção operacional**.

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
