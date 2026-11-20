> **F4-04-A/B/C — ESTRUTURA, 63 OBJETIVOS PILOTO E REVISÕES NBC (20/11/2026):** [CI #44777051352](https://github.com/auditeduca/canone/actions/runs/44777051352) **4/4 PASS**; 13 áreas/82 grupos da Suficiência, 6 modalidades/30 clusters candidatos EQT, 42 códigos normativos candidatos. 18 grupos de Contabilidade Geral e Custos possuem **63 objetivos didáticos originais em BASIC/INTERMEDIATE/ADVANCED**, mas **0 homologados**. CFC 2026: Revisões 32, 33 e errata TG 03 atingem 6 códigos candidatos; eficácia e licenciamento em HOLD. Restam 64 grupos para detalhar e as seis modalidades EQT exigem decomposição específica. Nenhuma questão externa, norma ou aula publicada; F4 incompleta, `NO_GO`; F8 Supabase por último. [Checkpoint F4-04](F4_04_CHECKPOINT_20261120.md).

> **F4-01/02/03 — FONTES PRIMÁRIAS + DIREITOS POR TRILHA / CI PASS (20/11/2026):** [CI #44719200458](https://github.com/auditeduca/canone/actions/runs/44719200458) **4/4 SUCCESS** na `main` SHA `a4b5d2cfc4ee6b17b634b25ebd8c6b2d19463c47`. FGV/CFC: **2 edições Suficiência**, **6 modalidades EQT**, **13 áreas curriculares**, **7 trilhas S23**, **26 módulos inventariados**; associações curriculares de planejamento em **19 módulos**, mais 7 módulos de uso transversal. **Cobertura editorial homologada 0/13; 0 questões reais publicáveis**. Registro de direitos expandido: **11 referências = 2 TEST_ONLY + 9 HOLD_RIGHTS**, nenhuma com autorização comercial. Suficiência 2026.3: 50 questões com 4 alternativas, regra normativa 90 dias antes da prova. EQT 2026.2: 25 objetivas com 5 alternativas + 2 discursivas e **vigência de normas na publicação do edital**, sem aproveitamento automático das regras Suficiência. F4 ainda aberta para atomização integral do Anexo II, NBC/CPC e normas específicas por edição, direitos/titularidade e revisão humana, produção `NO_GO`; Supabase dedicado somente F8. [Checkpoint F4](F4_03_CHECKPOINT_FONTES_DIREITOS_20261120.md).

> **F3-REC-07 — DIREITOS E PROVENIÊNCIA FAIL-CLOSED PASS (20/11/2026):** [GitHub CI #44715445719](https://github.com/auditeduca/canone/actions/runs/44715445719) **4/4 jobs SUCCESS**. Registro editorial: **2 TEST_ONLY sintéticos, 3 HOLD_RIGHTS, 0 publicáveis**. Validadores e 11 testes negativos offline, SQL apenas no PG17 efêmero: um item HOLD, hash adulterado ou direito vencido bloqueia **todo o formulário**; antiga função F3-REC-06 não é diretamente executável por `service_role`. `alpha.9`, `alpha.10`, `alpha.11`, migrations candidatas 001–010 e as 26 rotas S22 preservadas. [Norma e evidência](F3_REC_07_EDITORIAL_RIGHTS_STANDARD.md). Liberação externa exige revisão humana jurídica/editorial F4; F3/F6/F8 ainda abertas. `NO_GO`.

> **F3-REC-06 — QUESTÕES SERVER-SIDE + RESTART + RIGHTS GATE PASS (20/11/2026):** [CI #44707383292](https://github.com/auditeduca/canone/actions/runs/44707383292), **4/4 jobs PASS**. React S22 recebe questões pelo gateway alpha.11, SQL de conteúdo sintético verificado apenas no PG17 efêmero, gabarito nunca antecipado, processo gateway reiniciado e token HMAC rotacionado, sessão mobile recupera tentativa, direitos vencidos bloqueiam formulário. Viewport mobile corrigido e comprovado 390×844; histórico acessível sem clique forçado. [Relatório](F3_REC_06_SERVER_QUESTIONS_AND_RESTART.md). **Não é autorização editorial real; F3/F4/F6/F8 e gate de produção seguem abertos.** Alpha.9 e migrations candidatas 001–010 preservadas, `NO_GO`.

> **F3-REC-05 — HISTÓRICO E RECUPERAÇÃO PASS (20/11/2026):** [CI #44702274617](https://github.com/auditeduca/canone/actions/runs/44702274617) **4/4 jobs PASS**; React S22→alpha.10→PG17 real efêmero; catálogo de metadados, histórico, retomada após reload, respostas, fechamento, correção posterior e SRS. Testados IDOR 404, entitlement 403, bloqueio de chave e funções SQL inacessíveis ao navegador. **alpha.9 e migrations 001–010 preservadas**; consultas SQL em `tests/sql` exclusivamente. [Relatório F3](F3_REC_05_STUDENT_READ_CONTRACTS.md). Falta entrega editorial/autenticação gerenciada/multi-dispositivo/restart e homologação final. `NO_GO`; Supabase F8.

> **F3-REC-04 — PRIMEIRO E2E REACT→GATEWAY→PG17 REAL (20/11/2026):** [CI #44699825988](https://github.com/auditeduca/canone/actions/runs/44699825988) **4/4 jobs PASS**; Chromium→React S22→proxy HTTP loopback→gateway NS-03→PostgreSQL 17 descartável, Auth exclusivamente sintético, exercício inventado. Negativos `KEY_ONLY_AFTER_FINISH`, `NOT_OWNER` e usuário sem benefício; tentativa finalizada e recibo SRS confirmados em SQL. **F3 ainda não homologada:** falta catálogo autorizado, recuperação/histórico, Auth gerenciado, direitos de conteúdo e múltiplos dispositivos. [Relatório](F3_REC_04_REAL_BROWSER_PG17.md). `NO_GO`; Supabase F8.

> **F3-REC-03 — CÓDIGO ADITIVO REACT P0 (20/11/2026):** nova entrada `jornada-servidor.html` com `src/secure-p0/` reutilizando `Nav/Footer/ExamQuestion` da aplicação S22 (26 rotas e arquivos anteriores preservados). Cliente aceita somente formulário sem chave, JWT via provedor **local CI em memória** e cinco operações NS-03; resultado/gabarito apenas após finalização. Sem autenticação Supabase nem catálogo autorizado real. CI incluiu testes de contratos e build Vite da nova entrada. [Plano e limitações](F3_REC_03_REACT_GATEWAY_LOCAL.md). **NO_GO produção, Supabase F8.**

> **CORREÇÃO F3-REC-01 — CONTEXTO DO ROTEADOR REAL (20/11/2026):** `source-s22/app/src/main.tsx` monta os componentes de **26/26 módulos**, agrupados em 8 locais + 4 conhecimento + 5 workbenches + 5 laboratórios + 2 prática + 2 financeiro. A auditoria anterior examinou apenas `App.tsx` e classificou incorretamente 19 como candidatos/7 como catálogo e 0 rotas. **O código das rotas já existia**; testes CI React 195/195 PASS, mas não há homologação produtiva. [Crosswalk corrigido](F3_REC_01_FRONTEND_S22_S23_NS04.md). `NO_GO` / Supabase F8.

> **F3-REC-02 — BUILD HISTÓRICO CONFIRMADO (20/11/2026):** [CI #44697112319](https://github.com/auditeduca/canone/actions/runs/44697112319) **4/4 jobs PASS**; React S22 `tsc + Vite` compilou, **195/195 testes do app PASS**. 26/26 módulos reconciliados e hashes conferidos. **Ressalvas:** nove URLs de fontes `.woff2` ausentes geraram avisos (HOLD_ASSET visual/licenças); React S22 não foi ligado ao gateway e PG17 nesta prova. [Relatório F3](F3_REC_01_FRONTEND_S22_S23_NS04.md). `NO_GO`; Supabase somente F8.

> **F3-REC-01/02 — React S22 → S23 → NS-04 (20/11/2026):** matriz 26/26 módulos, com fonte/hash e observação de componentes preservados ainda não montados no roteador principal; [crosswalk](F3_REC_01_FRONTEND_S22_S23_NS04.md). CI de build/testes isolados da app React S22 adicionado, sem mudar código histórico, sem deploy. `frontend/student/` NS-04 permanece harness local e não substitui automaticamente React S22. **Sem percentual global auditado**, `NO_GO`, Supabase F8.

> **CONTEXTO S22/S23 → NS-04 RECONCILIADO (20/11/2026):** A estimativa genérica de ~30% global não é uma medição auditada do avanço acumulado e não deve ser repetida como fato. A `main` preserva 389 arquivos S22 (incluindo **61 arquivos da aplicação React**), 30 migrations históricas, 26 módulos no catálogo e planejamentos de 61 telas, além de backend e CI NS-01–NS-04. A nova UI `frontend/student/` é **prova isolada** e ainda não reutiliza o frontend React `source-s22/app/`; isso cria risco de retrabalho, não evidência de perda de arquivos. A partir de agora, a prioridade é reconciliar e reutilizar componentes existentes, com métricas separadas de recuperação, integração e produção. [Relatório antirretrabalho](RECONCILIACAO_CONTEXTO_S22_S23_NS04_20261120.md). `NO_GO`; Supabase só F8.

> **NS-04 FRONTEND — PRIMEIRA FATIA PASS (20/11/2026):** frontend de aluno responsivo, apenas em localhost com `?demo=1`, concluído e corrigido na `main`. CI [#44692128299](https://github.com/auditeduca/canone/actions/runs/44692128299): **3 jobs PASS** (regressões/Node, PostgreSQL 17 e Chromium desktop/mobile), com 7 testes Node próprios e jornada de navegador (resposta, conclusão, gabarito posterior, revisão, teclado e viewport 390px). [Evidências e limitações](NS04_FRONTEND_P0.md). **F3 permanece em andamento:** a UI opera com conteúdo e estado sintéticos na memória, sem catálogo autenticado, histórico persistido ou browser→gateway→PG17. Supabase continua exclusivo da F8 e produção `NO_GO`.

> **NS-03 — HTTP + POSTGRESQL17 EFÊMERO (20/11/2026):** [GitHub Actions #44689056599](https://github.com/auditeduca/canone/actions/runs/44689056599) passou nos dois jobs. A NS-03 executou **13/13 cenários** HTTP reais→`createGateway`→`makePgExecutor`→PG17, com login de teste `canone_gateway_ci` não superusuário, `SET LOCAL ROLE service_role`, `auth.uid()` derivado da identidade sintética verificada, sessão de banco limpa após COMMIT/ROLLBACK, isolamento A/B, autorização comercial revalidada por operação e prova/SRS realmente gravados. As regressões de banco e 277 testes legados também passaram. **Auth ainda é sintético** e o teste não constitui E2E do Supabase; próximo NS-04: frontend web/mobile do aluno. A implantação Supabase permanece como última F8. [Relatório](NS03_HTTP_PG17_E2E_LOCAL.md).

> **NS-02 — IDENTIDADE LOCAL / GATEWAY HTTP (20/11/2026):** 12 testes Node end-to-end de HTTP loopback com duas identidades e assinaturas sintéticas, assinatura HMAC efêmera, token forjado/expirado, `user_metadata` não confiável, IDOR entre A/B, revogação, acesso antecipado ao gabarito, reenvio SRS e rotas desconhecidas. O verificador preserva o contrato `/auth/v1/user` via `fetchImpl` injetado. **Executor de dados é dublê; não é teste PG17, JWT gerenciado ou Supabase real.** Fixture somente em `tests/` e flag `CANONE_SYNTHETIC_TEST_ONLY=1`; CI dedicado. [Documento NS-02](NS02_IDENTIDADE_SINTETICA_GATEWAY.md). Próximo: NS-03 HTTP→PostgreSQL17 com transação e autorização reais no contêiner. Supabase F8, último.

> **NS-01 CONCLUÍDA COMO INVENTÁRIO — 20/11/2026:** cruzamento determinístico de **182 declarações S22** (58 funções, 26 triggers, 18 views, 80 políticas) com **10 candidatos 001–010**, SHA-256 dos SQL originais e hashes previamente atestados de cada candidato. Achados de trabalho: **40 declarações de função sem porte, 17 triggers sem porte, 2 views pendentes e 67 políticas legadas para reavaliação de segurança**. Outros itens têm mesmo nome ou contrato substituto, sem equivalência afirmada. [Relatório NS-01](NS01_INVENTARIO_FUNCOES_TRIGGERS_VIEWS_POLICIES.md). **F1 NÃO está concluída**; próximo: NS-02 (fixture de identidade local sem credenciais Supabase), seguido por NS-03 PG17/API. Projeto Supabase continua por último (F8).

> **DECISÃO DE PRIORIDADE — 20/11/2026 (após alpha.9):** **Supabase exclusivo é a ÚLTIMA etapa F8**, não a próxima tarefa imediata. Antes disso, executar F1–F7: (F1) paridade de banco e funções/views/RLS em PG17; (F2) backend E2E com identidade sintética segura; (F3) frontend e jornada do aluno; (F4) conteúdo CFC/EQT e direitos; (F5) assinaturas/painel com pagamentos simulados; (F6) qualidade, segurança, acessibilidade e recuperação; (F7) pacote de instalação reproduzível. Pré-requisitos de F8: testes e fontes/licenças homologadas, sem falhas críticas, ambiente local reproduzível e autorização formal. **Nenhuma escrita no Supabase compartilhado nem criação de projeto até F8.** Fonte de verdade: [Plano de conclusão com Supabase por último](PLANO_CONCLUSAO_SUPABASE_ULTIMO.md). Esta decisão de sequência substitui menções anteriores a provisionamento imediato; os históricos alpha.2–alpha.9 permanecem preservados.

> **MARCO ALPHA.9 — 20/11/2026:** backend privado com cinco operações da prova conectado por contrato ao Supabase Auth (`GET /auth/v1/user`), com validação de usuário em cada chamada e execução PostgreSQL por transação de contexto `auth.uid()` derivado apenas do resultado verificado. Gate SQL 010 controla benefício `cfc.exam` por assinatura ativa ou permissão administrativa vigente. [CI 44682865475](https://github.com/auditeduca/canone/actions/runs/44682865475) PASS: 13 testes Node, negativos PG17 (pendente/trial/expirada/cancelada/revogada/impersonação), positivos (assinatura ativa e benefício admin), navegador sem execução, hash manifesto válido e regressão legada. **Próximas microtarefas:** Supabase isolado + JWT real, webhooks/entitlements, API rate-limited, browser E2E com simulado sintético, revisão jurídica editorial. 0 escrita remota e `NO_GO` produção.

> **MARCO ALPHA.8 — 20/11/2026:** cinco funções privadas de prova e revisão SRS + tabela `exam_review_receipt` com idempotência `(attempt_id,ordinal)`. [GitHub Actions #44680388780](https://github.com/auditeduca/canone/actions/runs/44680388780) passou: 12 testes Python, 32 negativos/positivos em PGlite, corrida de resposta vs. encerramento bloqueada, duplicata simultânea de SRS reduzida a 1 evento/recibo e browser sem EXECUTE em PostgreSQL 17. Scripts 001–009 executados em banco efêmero, sem qualquer aplicação no Supabase compartilhado. **Próxima frente:** integração JWT real em backend privado, autorização comercial/RBAC e licenças do conteúdo, sessão/simulado, teste de concorrência da resposta mesma posição e promoção isolada somente após homologação. `NO_GO` para produção.

> **MARCO ALPHA.7 — 20/11/2026:** as migrations de staging 001–008 foram executadas em PostgreSQL 17.12 descartável. [CI #44677935551](https://github.com/auditeduca/canone/actions/runs/44677935551) PASS (ambos os jobs). O SQL 008 converteu cadeia hash v2 da auditoria e a regra de completude do selo. Evidências: 12 sessões independentes com sequência 1..12, 0 divergências, e tentativa concorrente de inclusão após selo recusada; PGlite 21 verificações e Python 12 testes. Artefatos `tools/convert_canone_audit_seal.py`, `tests/pg17_alpha7_concurrency.sh` e `docs/CONVERSAO_AUDITORIA_SELO_ALPHA7.md`. Próximas microtarefas: (i) âncora externa imutável, (ii) ampliar combinações de concorrência no PG17, (iii) portar serviços de correção/tentativas/SRS e (iv) implantação homologada em Supabase **exclusivo**. Nenhuma migração remota; `NO_GO` produção.

> **AVANÇO ALPHA.6 — 20/11/2026:** banco Cânone S22 → Supabase conta agora com 89 tabelas físicas compiladas, 67 índices/12 ALTER, 16 views invoker, 21 políticas RLS, 1 função compat Auth, e novo lote de **7 funções + 20 triggers** de integridade testados em PGlite. [CI 44675846859](https://github.com/auditeduca/canone/actions/runs/44675846859) PASS com 27 verificações novas. Próximas microtarefas: (1) cadeia de hash de auditoria serializada e testes de concorrência; (2) validação do gabarito completo antes do selo; (3) funções de prova, tentativas e SRS com Auth real; (4) PG17 isolado; (5) staging Supabase exclusivo. Manter SQL como candidata e `NO_GO` para produção.\n\n> **ADENDO DE EXECUÇÃO — 19/11/2026, `main`:** O proprietário determinou **versionamento exclusivamente na `main`**, sem novas branches. A PR histórica #2 foi integrada à `main`, preservando 389 arquivos S22 sob `source-s22/`, 87 excluídos por revisão e 30 migrations não executadas. Versão documental `0.23.0-alpha.1`; CI `main` validou 389 hashes, 277/277 testes e o gate NO-GO. **S22-08: PASS_VERSIONED_QUARANTINE**, mas `HOLD_RIGHTS / HOLD_SECURITY / NO-GO` de produção continua. Para execução prevalece a [Política de versionamento](VERSIONAMENTO_MAIN.md), com changelog e commits exclusivos na main.

> **ADENDO 19/11/2026:** recuperação S22 concluída em material local de Biblioteca, S23 v0.3 redefine a prioridade de produto para Exame de Suficiência e EQT/CFC. O texto abaixo preserva o planejamento inicial; para status atual e inventário, prevalece [Consolidação multifonte S22/S23](CONSOLIDACAO_MULTIFONTE_S22_S23_SUPABASE_20261119.md). S22-02 (origem) agora **PASS_RECOVERED**, S22-03 (30 SQL no ZIP) **PASS_INVENTORY**, S22-04 (26 demos) **PARTIAL**, S22-05 (277 testes em relatório) **HISTORICAL_NOT_RERUN**, S22-06/07 **PARTIAL**, S22-08 (PR de código) **TODO**. Gate produção **NO-GO**.

# Programa Mestre — Cânone (S22–S26)
**Versão:** 0.1.0 · **Corte:** 2026-11-19 · **Estado geral:** INTEGRATION_PENDING / NO-GO

## Objetivo e definição de pronto
Consolidar as entregas anteriores do Cânone Contabilidade em repositório independente, com trilha Git e banco isolado, confirmar o escopo dos 26 módulos, implantar um backend seguro e homologar normas, conteúdo e produto. **O repositório é criado, mas o código de origem S21 ainda não foi identificado e importado.**

**DoD global:** fontes recuperadas e reconciliadas; 30/30 migrations verificadas em banco descartável e staging aprovado; autenticação/RBAC/RLS validadas por identidades reais de teste; suíte CI e E2E verde; 26 módulos inventariados e avaliados por contrato; normativos oficiais com edição/data/rights rastreados; deploy preview auditado; backups/rollback comprovados; checkers técnico, normativo, jurídico e segurança independentes; aprovação explícita de produção.

## Indicadores — não confundir evidência e meta
| Indicador | Meta | Fotografia verificada | Interpretação |
|---|---:|---:|---|
| Código S21 integrado ao novo Git | 100% | 0% | Repositório inicialmente vazio; README de bootstrap não é código |
| Migrations catalogadas no Supabase | 30 | 30 `NOT_APPLIED` | Catálogo não indica migrations de domínio executadas |
| Migrations testadas em ensaio anterior | 30 | 16 (relato S21) | Sem artefato/sha ancorado no novo repo |
| Schemas canone reservados no Supabase | 14 | 14 | Apenas namespace, não backend |
| Tabelas canone no Supabase | — | 4 | Somente `canone_control`, RLS ligada, sem policies |
| 26 módulos homologados | 26 | 0 comprovados | Preview de UI ≠ homologação |
| Produção | GO com todos os gates | NO-GO | Sem migração remota/autorização |

O percentual global de entrega **não é calculável** até concluir a recuperação do inventário e definir denominadores por frente.

## S22 — Recover, compare, deduplicate (prioridade P0)
| ID | Microtarefa | Evidência exigida | Estado |
|---|---|---|---|
| S22-01 | Formalizar repositório e estado inicial | README + commit | PASS |
| S22-02 | Localizar origem oficial do código S21 (Git/arquivos/exports) | URL, ref, SHA256 e data | TODO |
| S22-03 | Inventariar os 30 arquivos SQL + dependencies | Manifesto por arquivo, ordem, impacto | TODO |
| S22-04 | Localizar implementação dos 26 módulos e motor | Matriz módulo→rota→API→tabelas→testes | TODO |
| S22-05 | Recuperar evidência primária dos 261 testes | Workflow/run/artefato/commit | TODO |
| S22-06 | Comparar código, Vercel, Supabase e relatórios | Crosswalk, divergências e decisão | TODO |
| S22-07 | Deduplicar preservando licenças/proveniência | Hashes e equivalência demonstrada | TODO |
| S22-08 | Abrir PR de integração isolada, sem deploy | Diff, testes, riscos, rollback | TODO |

## S23 — Banco e contratos
- S23-01: criar ambiente PostgreSQL 17 descartável e seed exclusivamente sintética.
- S23-02: reescrever/validar as referências genéricas e dependências SQL com schemas `canone_*`, **sem tocar schemas CE/CKO/NCOS**.
- S23-03: conferir ownership, grants mínimos, RLS, views com `security_invoker`, search_path e funções privilegiadas.
- S23-04: matriz migração→objetos→testes→rollback; executar 30/30 no ambiente isolado, comparar schema diff e restaurar backup.
- S23-05: somente após aceite independente, preparar plano separado de staging; nenhum SQL de domínio em produção nesta fase.

## S24 — Backend e motor central
- S24-01: definir identidade, perfis e permissões (RBAC/ABAC) com testes de abuso e isolamento.
- S24-02: implementar APIs versionadas, motor de avaliação, persistência, auditoria e idempotência.
- S24-03: corrigir erros de ownership/roles herdados e confirmar fronteiras de dados.
- S24-04: validação de segurança (authn/authz, exposição de segredos, endpoints, rate limiting), observabilidade e desempenho.

## S25 — Módulos e normativos
- S25-01: inventariar 26 módulos com escopo funcional e critérios individualizados.
- S25-02: testar casos positivos/negativos, mobile/acessibilidade, persistência, exportação e E2E.
- S25-03: referências CFC/Senado e outras normas somente com fonte oficial, versão, vigência, hash do documento quando licenciado e direitos de uso.
- S25-04: revisão técnica/contábil/editorial/jurídica por item; fontes sem autorização permanecem HOLD.

## S26 — Homologação e liberação
- S26-01: CI, testes de carga, pentest dirigido, backup/restauração e rollback.
- S26-02: preview externo homologado com autenticação, integrações e audit trails.
- S26-03: matriz final de riscos/gates; aceite maker/checker/auditor independente.
- S26-04: produção **somente por ordem específica após GO documentado**.

## Governança de execução
Cada tarefa possui `id/status/owner/fonte/hash/commit/teste/bloqueio/data`. Estados: `TODO`, `IN_PROGRESS`, `PASS`, `FAIL`, `HOLD_SOURCE`, `HOLD_RIGHTS`, `HOLD_SECURITY`, `HOLD_HUMAN`. HOLD não bloqueia pesquisa ou implementação segura, mas **impede promoção do item ao uso operacional**. Não forçar gate verde sem evidência.

## Dependências e fontes
- GitHub: repositório atual `auditeduca/canone`; artefatos legados S21 ainda a localizar.
- Supabase: Calculadoras-Smart, schemas reservados `canone_*`, só READ_ONLY até staging autorizado.
- Vercel: `canone-contabilidade-preview`, preview candidato READY, sem aceite funcional.
- Normativas externas: CFC, legislação oficial e órgãos competentes; validar versão/vigência e direitos.
- Fontes do usuário: arquivos ZIP, backups ou exportações a localizar antes de afirmar completude.

**Decisão vigente:** manter `NO-GO` e executar S22 de forma rastreável.