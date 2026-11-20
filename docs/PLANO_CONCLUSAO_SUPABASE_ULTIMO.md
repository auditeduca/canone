# Cânone — plano de conclusão com Supabase por último

**Decisão de produto:** 20/11/2026 • **Base técnica:** `0.23.0-alpha.9` • **Repositório:** `auditeduca/canone`, somente `main`.

## Regra de execução

1. **Não criar novo projeto ou aplicar migrations no Supabase enquanto os lotes F1–F7 não tiverem critérios de aceite satisfeitos.** A exceção só pode ocorrer por nova decisão explícita do proprietário, com justificativa e registro de revisão.
2. Fazer engenharia e QA utilizando PostgreSQL 17 descartável, PGlite, Node.js, Python, navegador automatizado e GitHub Actions. **Nunca usar o Supabase compartilhado `pgsybzggewhinaniybiy` como ambiente de staging.** Testes podem simular o serviço Auth, desde que a evidência diga expressamente que não são tokens reais gerenciados.
3. Trabalhar **somente na `main`**, com commits pequenos, código/testes/evidência/rollback associados; sem criar branches ou PRs. Cada lote deve preservar o gate `NO_GO` de produção.
4. Não promover material editorial de licença incerta, gabaritos oficiais não homologados nem dados pessoais; usar dados de teste inventados. HOLD de direitos/normativo impede publicação do item, não desenvolvimento dos componentes independentes.
5. Uma aprovação de CI comprova apenas o comportamento que o teste executou, não 100% de cobertura. A conclusão global permanece **estimativa**, não porcentagem auditada até haver denominadores homologados por frente.

## Ordem obrigatória de conclusão pré-Supabase

| Frente | Entregas executáveis sem Supabase | Critério objetivo de aceite | Evidência |
|---|---|---|---|
| **F1 — Paridade física e comportamental do banco** | Fechar catálogo de funções/triggers remanescentes e duas views; revisão de RLS, ownership, `SECURITY DEFINER`, grants, índices, consistência das 30 migrations e reconciliação de objetos | Inventário origem→destino 100% classificado em PORTADO / SUBSTITUÍDO / DESCARTADO JUSTIFICADO / HOLD DIREITOS; SQL 001–N executa no PG17 limpo; testes de privilégios A/B, locks e rollback | Manifestos SHA-256, `pg_catalog` diffs, pg17 CI, relatório por objeto |
| **F2 — Gateway e serviços locais** | Integrar motor de provas, permissões, assinaturas simuladas, auditoria e SRS ao backend; autenticação local/test-double estritamente controlada; validação de entrada, idempotência, erros e observabilidade | Fluxos API ponta a ponta com duas identidades simuladas; inexistência de chamada de função privada no navegador; transação e contexto limpos; testes adversariais de replay/IDOR/impersonação | Testes Node, integração PG17, matriz endpoint→permissão→SQL |
| **F3 — Frontend funcional CFC** | Telas e experiência completa de entrada→catálogo/aula→questão→tentativa→correção posterior→SRS→progresso→histórico; responsivo/mobile e estados de carregamento/erro | Jornada P0 demonstrável com dados sintéticos e backend local; testes E2E no navegador, navegação por teclado, acessibilidade e layouts móveis | Capturas E2E, vídeo ou artefatos CI, checklist WCAG 2.2 AA |
| **F4 — Conteúdo e curricular** | Matriz CFC e EQT versionada, mapeamento dos 26 módulos do plano, fontes oficiais, vigência, licença, questões inéditas autorizadas, explicações, tags, aulas e SRS | Matriz módulo→objetivo→fonte→licença→questão→revisão→teste; conteúdo sem licença não entra na entrega pública; revisão contábil e editorial por item | Dicionário de conteúdos, hashes, autorização, testes de amostras |
| **F5 — Assinaturas e administração simuladas** | Planos, benefícios, billing sandbox/fixtures, webhooks assinados e idempotentes, cancelamento, upgrade, concessões revogáveis, relatórios e painel administrativo | Casos de pagamento duplicado/atrasado/forjado, benefício vencido e revogação cobertos em PG17; sem cobrança real ou segredos em Git | Matriz de eventos, logs redigidos, testes e relatórios |
| **F6 — Segurança, UX e qualidade** | Revisão de todas as rotas e 26 módulos, testes de carga, RLS/roles, brute force/rate limit, CSRF/CORS conforme arquitetura, injeções, privacidade/LGPD, acessibilidade e desempenho | Sem falha alta/crítica aberta nas áreas lançáveis; rastreabilidade de exceções; regressões, recuperação, backup/restore local e gates de conteúdo aprovados | CI, SAST/dep scan, testes E2E e stress, matriz de risco |
| **F7 — Pacote de implantação independente** | `Docker`/scripts de PG17 efêmero, migrations candidatas promovidas só após revisão, seeds sintéticos, manifests, configuração `.env.example`, observabilidade, rollback, runbook e checklist de deploy | Ambiente limpo sobe por procedimento reproduzível; schema diff esperado, backup/restore e rollback testados; documentação do segredo e variáveis sem credenciais reais | Pipeline reproducível e pacote de homologação versionado |

## F8 — Supabase exclusivo: **última etapa**

**Pré-requisito:** F1–F7 aprovadas no escopo mínimo de lançamento CFC; exceções de conteúdo licenciado não publicadas; relatório de riscos e autorização registrada.

Só então:
1. Criar ou selecionar projeto **exclusivo do Cânone** (nenhum reaproveitamento do Supabase CE); guardar projeto, região, Postgres, backups e políticas de secrets.
2. Promover migrations revisadas, aplicar em staging dedicado com `supabase` CLI ou ferramenta oficial e verificar diff, RLS e grants. Não aplicar diretamente os arquivos `.candidate.sql.txt`.
3. Integrar **Auth real do Supabase**, autenticação, JWT válido, rotação/revogação de sessão, gateway seguro e TLS; repetir casos positivos, negativos e de concorrência com identidade real de teste.
4. Reconciliar importações efetivamente autorizadas, validar contratos de assinatura/webhooks, executar E2E web/mobile, testes de carga e recuperação.
5. Gerar evidências e pedir decisão `GO/NO_GO` para publicação; **não fazer deploy de produção automaticamente**.

## Próxima rodada de implementação (F1 + F2)

| ID | Microtarefa | Aceite verificável |
|---|---|---|
| **NS-01** | Inventariar funções/triggers restantes e dois motivos de view não portada, cruzando a origem S22 com os candidatos 001–010 | Matriz gerada automaticamente por Python, sem objetos silenciosamente omitidos — **PASS inventário 182/182**, F1 segue em execução; [matriz de objetos](../inventories/s22/CANONE_NS01_OBJECT_RECONCILIATION.json), [relatório](NS01_INVENTARIO_FUNCOES_TRIGGERS_VIEWS_POLICIES.md) |
| **NS-02** | Criar fixture de identidade local que reproduza entradas seguras do gateway, mantendo separação explícita entre mock e Auth gerenciado | **PASS contrato HTTP sintético 12/12**: token forjado/expirado, usuário B, assinatura revogada e gabarito antecipado; [provas e limites](NS02_IDENTIDADE_SINTETICA_GATEWAY.md) |
| **NS-03** | Unir gateway, PG17 e jornada de prova em testes de integração REST | **PASS 13/13** — HTTP→PG17 descartável, Auth sintético, RBAC, assinatura, tentativa, feedback posterior e SRS; [CI](https://github.com/auditeduca/canone/actions/runs/44689056599) e [relatório](NS03_HTTP_PG17_E2E_LOCAL.md) |
| **NS-04** | Frontend P0 local com catálogo sintético, prova, correção e revisão | **PASS primeira fatia (Chromium + Node) no [CI #44692128299](https://github.com/auditeduca/canone/actions/runs/44692128299)**; **F3 não concluída**: browser→gateway→PG17 **PASS F3-REC-04 com Auth sintético e questões inventadas**; falta catálogo autorizado, recuperação/histórico e identidade gerenciada |
| **NS-05** | Fechar o inventário de fontes oficiais/licenciamento e as limitações de amostra | Fonte, vigência e licença em cada item de demonstração/produção |

## Critérios de reporte e continuidade

- Publicar, a cada rodada, `ID | fonte | arquivo | ação | commit | testes CI | PASS/FAIL/HOLD | próximo passo`.
- Usar porcentagens **somente** quando o denominador for documentado (por exemplo, 16/18 views); para o produto global, conservar a estimativa gerencial com aviso explícito.
- Um `FAIL` no CI é achado de engenharia para correção; `HOLD_RIGHTS` e `NO_GO` são barreiras **apenas à promoção operacional**.
- Atualizar este plano se o proprietário alterar a prioridade. A decisão de 20/11/2026 é inequívoca: **Supabase exclusivo é o último passo técnico de integração e homologação, antes de eventual produção.**

## Evidências existentes aproveitadas

- [Marco alpha.8 — serviço de provas e SRS, CI](https://github.com/auditeduca/canone/actions/runs/44680711933)
- [Marco alpha.9 — Auth/gateway e benefício, CI](https://github.com/auditeduca/canone/actions/runs/44683142037)
- [Arquivos candidatos SQL](../staging/supabase/) · [Geradores Python](../tools/) · [Testes](../tests/)


## F3-REC-04 — alcance real (20/11/2026)

[CI #44699825988](https://github.com/auditeduca/canone/actions/runs/44699825988) executou a nova página React reaproveitando `ExamQuestion` do histórico via HTTP gateway e PostgreSQL 17 real descartável, incluindo negativas de IDOR, ausência de autorização e gabarito prematuro. **O critério técnico de integração local passou; não é F3 liberada nem Auth Supabase.** Próxima F3-REC-05: catálogo sem chave, recuperação de sessão/histórico multi-dispositivo, controles editoriais e WCAG.

## F3-REC-05 — controle de leitura e retomada (20/11/2026)

[CI #44702274617](https://github.com/auditeduca/canone/actions/runs/44702274617): **4/4 PASS**, browser real, React S22, gateway alpha.10 e PostgreSQL 17 efêmero com Auth sintético. Catalogação restrita a ID/rótulo/quantidade; histórico próprio e retomada com escolhas após recarregar página; sem chave antecipada. `SECURITY DEFINER` owner-scoped, somente `service_role` pode executar. Mantidas dez candidatas 001–010 (o SQL de testes não é migration), alpha.9 intacta.

F3 **ainda aberta**: questão/enunciado e alternativa licenciados via endpoint seguro; auth real, recuperação após restart, multi-dispositivo, WCAG, auditoria editorial e qualidade final. Supabase por último na F8.

## F3-REC-06 — conteúdo de avaliação seguro no teste (20/11/2026)

[CI #44707383292](https://github.com/auditeduca/canone/actions/runs/44707383292): **4/4 PASS**. Enunciado e alternativas de questões sintéticas foram entregues via gateway alpha.11, com controle server-side de proveniência e licença **apenas de CI**; retomada após reinício do processo Node/rotação de token sintético; negativa de conteúdo após expiração do direito; viewport touch 390×844 comprovado. Os cinco métodos originais da alpha.9 e as 10 migrations candidatas históricas permanecem intactos; SQL novo é exclusivamente de teste, não migration de produção.

**Ainda sem conclusão F3:** leitura/aprovação de licenças reais F4, itens validados, Auth gerenciado F8, sessões reais e segurança F6, acessibilidade WCAG 2.2 AA completa, administração e pacote de implantação. Não criar Supabase antes dos gates F1–F7.

## F3-REC-07 — direitos editoriais rastreáveis e veto integral (20/11/2026)

[CI #44715445719](https://github.com/auditeduca/canone/actions/runs/44715445719): **4/4 PASS**. Registro `governance/editorial_rights_registry_v1.json` distingue `TEST_ONLY` original (2) de `HOLD_RIGHTS` externo/quarentena (3); 0 materiais autorizados para publicação, sem presumir licença por disponibilidade na internet. `APPROVED_FOR_PUBLICATION` não está habilitado na política v1. Validador independente e teste em PostgreSQL 17 efêmero negam prova inteira se um item estiver HOLD, se o hash/versão divergir ou se a decisão de direitos vencer. Nenhum código de release, conteúdo oficial ou Supabase modificado.

**F4 próximo gate:** matriz humana de titularidade, fonte primária, autorização específica de publicação/reprodução digital/comercial, contrato/prazo/território, atribuição, validação normativa, revisão editorial e jurídica, hashes/rollback. **F6:** WCAG 2.2 AA, abuso/autorização, observabilidade, carga. **F8:** projeto Supabase dedicado por último, após gates F1–F7. Produção `NO_GO`.
