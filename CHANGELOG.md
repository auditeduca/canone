# Histórico de versões — Cânone

Todas as alterações de engenharia e de conteúdo do Cânone serão versionadas **somente na branch `main`**, por commits Git e registro de versão. O projeto permanece em desenvolvimento; a existência de uma versão não significa que ela esteja aprovada para produção.

Formato de versão: **MAJOR.MINOR.PATCH[-PRERELEASE]**, em que:
- `0.x.y`: software em construção, contratos ainda sujeitos a mudança;
- `-alpha.N`: inventário, integração e testes internos;
- `-beta.N`: fluxo funcional candidato a homologação;
- `-rc.N`: candidata a aprovação, sujeita a revisão independente;
- estável: somente quando todos os gates forem `GO`.

### Decisão de sequência registrada em 20/11/2026

O proprietário decidiu **adiar Supabase exclusivo até a etapa final F8**, após desenvolvimento/QA do banco, backend, frontend, conteúdo, assinaturas simuladas, segurança e pacote de implantação (F1–F7). Trata-se de alteração documental da ordem de execução, **sem release funcional novo**. Veja [plano Supabase por último](docs/PLANO_CONCLUSAO_SUPABASE_ULTIMO.md).

## [0.23.0-alpha.9] — 2026-11-20

**Estado:** `AUTHENTICATED_GATEWAY_AND_ENTITLEMENT_PG17_CI_PASS / RELEASE_NO_GO`.

### Backend de autenticação e autorização
- Criado [gateway privado](gateway/alpha9-core.mjs) em Node.js com **cinco rotas** para iniciar, responder, concluir, revelar e revisar prova; contrato estrito Bearer/JSON, sem `userId` fornecido pelo cliente.
- Validada identidade pelo endpoint **Supabase Auth `GET /auth/v1/user`** no projeto fixado por configuração e HTTPS. Em caso de token inválido, ausência de identidade, usuário anônimo ou falha do servidor, acesso negado. O código **não usa `user_metadata` ou JWT decodificado como fonte de autorização**.
- [Executor PostgreSQL](gateway/alpha9-core.mjs) com transação delimitada, `SET LOCAL ROLE service_role`, `request.jwt.claim.sub` definido apenas a partir do ID retornado pelo Auth, checagem de benefício em **toda requisição**, SQL parametrizado com whitelist de operações e rollback em erro.
- Candidato [SQL 010](staging/supabase/010_private_feature_gate.candidate.sql.txt) define `canone_ops.can_use_feature`, `SECURITY DEFINER` sem `EXECUTE` no navegador; acesso somente com **assinatura ativa/período válido, plano ativo + feature** ou concessão temporária não revogada. Trial, cancelamento, assinatura expirada, pendente e entitlement `source='assinatura'` obsoleto não autorizam por si.
- [Entrypoint de desenvolvimento](gateway/alpha9-server.mjs) vinculado a loopback, recusa o Supabase compartilhado, exige correspondência URL Auth/host PostgreSQL e TLS verificado. **Não foi implantado**.
- Manifesto SHA-256 inclui **6 artefatos novos** e valida dependência do SQL 009. Código histórico preservado.
- [Actions 44682865475](https://github.com/auditeduca/canone/actions/runs/44682865475) **PASS nos dois jobs**: **13/13 testes Node**, verificador do manifesto PASS, PG17 com negação padrão, impersonação recusada, assinatura ativa liberada, pendente/trial/expirada/cancelada negadas, concessão administrativa válida/revogada e EXECUTE negado ao navegador; regressões históricas **277/277** mantidas.

### Limites explícitos
O Auth e o PG foram testados **independentemente com identidades sintéticas**: não há JWT real emitido pelo projeto exclusivo nem E2E integrado. Ainda não existem webhook de pagamentos homologado, rate limiting/WAF, gestão de credenciais e certificado, revogação forte de sessão, gateway público protegido e acervo editorial licenciado. Não houve escrita no Supabase conectado nem deploy em produção. SQL `010` permanece `.candidate.sql.txt`; `NO_GO` operacional.

## [0.23.0-alpha.8] — 2026-11-20

**Estado:** `PRIVATE_EXAM_ATTEMPT_AND_SRS_PG17_CI_PASS / RELEASE_NO_GO`.

### Fluxo protegido da prova e aprendizagem
- Conversão controlada dos contratos S22 `006/007/012/018/019`, após revalidar **30/30 hashes das migrations históricas**, sem alteração dos SQL originais.
- **Cinco métodos internos**: `exam_start`, `exam_answer`, `exam_finish`, `exam_reveal`, `exam_to_srs`. `SECURITY DEFINER` com `search_path=pg_catalog`, propriedade verificada por `auth.uid()`; `EXECUTE` negado a `PUBLIC`, `anon`, `authenticated` e concedido somente a `service_role`. **É indispensável backend que valide JWT real e não exponha `canone_ops` na Data API.**
- `exam_answer` usa `FOR UPDATE` no registro da tentativa, corrige pelo **gabarito definitivo daquela variante/posição** e retorna `void`, não o veredito. Substituições repetidas recalculam contagens, sem duplicar. `exam_reveal` só atende tentativa concluída do proprietário.
- `exam_finish` é idempotente e retorna apenas contagens factuais; **não inventa nota de corte, status de aprovação ou questões com direitos pendentes**.
- Nova `canone_learning.exam_review_receipt`, com **RLS + FORCE** e unicidade por `(attempt_id,ordinal)`, registra SRS somente para resposta concluída e **não anulada**; retry devolve o mesmo evento, sem repetir o estado `canone-srs-exam-v1`.
- [GitHub Actions #44680388780](https://github.com/auditeduca/canone/actions/runs/44680388780) **sucesso em dois jobs**: **12/12 testes estáticos Python**, **32 verificações de PGlite** e **PostgreSQL 17** com disputa entre resposta/encerramento (resposta atrasada recusada), duas requisições simultâneas SRS (1 recibo, 1 repetição) e tentativa de chamada privilegiada pelo navegador negada. **277/277 testes históricos** preservados.

### Não homologado para uso real
`009_attempt_grade_srs.candidate.sql.txt` é candidato, **não migration publicada**. Backend JWT/Supabase Auth gerenciado, autorização de consumo/assinatura, variantes simuladas, múltiplos interleavings, audit trail do serviço, conteúdo/licença e nota oficial permanecem fora do aceite. Sem escrita no Supabase compartilhado, sem deploy e sem novas branches. `NO_GO` produção.

## [0.23.0-alpha.7] — 2026-11-20

**Estado:** `AUDIT_HASH_CHAIN_V2_AND_COMPLETE_SEAL_PG17_CI_PASS / RELEASE_NO_GO`.

### Banco: auditoria e integridade de provas
- Gerador Python verificou **30/30 migrations S22** por SHA-256 e produziu o candidato `008_audit_chain_and_seal.candidate.sql.txt`.
- **Cadeia de hashes v2** com 15 campos de auditoria, payload canônico, `seq` atribuído pelo servidor, serialização com `pg_advisory_xact_lock` sob `READ COMMITTED` e recálculo independente em `verify_chain`. `UPDATE`, `DELETE`, `TRUNCATE` e acesso direto do navegador seguem negados.
- **Selo definitivo** recusa gabarito inserido diretamente como definitivo e exige correspondência completa de **1..N** entre posições de formulário e entradas de gabarito; lock do formulário para a transição e para mutações de posições.
- **4 funções novas, 2 adaptadas, 2 triggers novos e 1 redefinido**; os SQL 001–007 anteriores permanecem preservados.
- [CI PostgreSQL 17.12 + PGlite (https://github.com/auditeduca/canone/actions/runs/44677935551)](https://github.com/auditeduca/canone/actions/runs/44677935551) PASS: **12 testes Python**, **21 verificações em PGlite**, **12 transações de auditoria concorrentes (seq 1..12, zero hashes divergentes)** e corrida de selo x inclusão de questão recusada. Regressões S22 277/277 preservadas.

### Limitações
Os arquivos permanecem candidatos não implantáveis; **não houve escrita Supabase remota**. Apenas os cenários de concorrência especificados foram executados. A auditoria ainda exige âncora externa independente para proteção contra reescrita privilegiada, mais testes JWT gerenciado, direitos editoriais e validações de ponta a ponta. Produção segue `NO_GO`.

## [0.23.0-alpha.6] — 2026-11-20

**Estado:** `INTEGRITY_FUNCTIONS_7_TRIGGERS_20_CI_PASS / RELEASE_NO_GO`.

### Integridade de provas, SRS e auditoria
- **7 funções trigger** `SECURITY INVOKER` com `search_path` controlado e sem `EXECUTE` público.
- **20 triggers candidatos**: oito para imutabilidade e selo de provas/gabaritos, mais 12 `updated_at` em tabelas permitidas. O mecanismo histórico que tentava atualizar `identity.account` foi substituído pelo uso do Supabase Auth.
- Proteção adicional contra **INSERIR novas entradas em gabarito definitivo** e exclusão do próprio gabarito; bloqueio da alteração de `question_count` em exame/edição depois do selo. As operações idempotentes preservadas são explicitadas nos testes.
- Inventário de procedência com arquivo/linha/SHA-256 por função e verificação de 30 migrations antes de gerar SQL. Restam **50 instruções históricas de função** não convertidas, incluindo cadeia de hashes da auditoria, cálculo de notas e serviços privilegiados.
- CI no commit `500d62a`: [GitHub Actions 44675846859](https://github.com/auditeduca/canone/actions/runs/44675846859) **PASS**, 14/14 testes Python e 27 verificações PGlite, incluindo UPDATE legítimo de nota pelo aluno autenticado; regressões 277/277 e gate de produção 41/NO_GO preservados.

### Limites
A candidata `007_integrity_triggers.candidate.sql.txt` não é migration aplicável. Testes em memória **não comprovam concorrência ou integridade transacional PG17**, selo completo de gabarito, encadeamento de hashes, JWT/Supabase Auth gerenciado ou liberação de dados. Nenhum SQL remoto executado; produção segue `NO_GO`.

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
