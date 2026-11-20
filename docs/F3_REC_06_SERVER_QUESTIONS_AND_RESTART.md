# F3-REC-06 — entrega de questões sem gabarito (CI sintético)

A interface React S22 já possuía catálogo, histórico e recuperação via alpha.10. A nova operação `/api/v1/exam/questions` é isolada em `gateway/alpha11-core.mjs`, preservando íntegros `alpha9-core.mjs`, `alpha10-core.mjs` e as dez migrations candidatas 001–010.

O SQL `tests/sql/f3_rec06_question_delivery_ephemeral.sql` **não é migration de produção**. Ele insere apenas duas questões originais inventadas na modelagem S22 já existente: `content_item`, `content_item_version`, `item_option`, `verification` e `source`. Exige `verification.state=verificada`, verificação vigente, fonte rastreável com marcador de licença **exclusivamente sintética de CI**, texto/alternativas completos e forma com gabarito definitivo. A função privada `canone_ops.exam_questions(formId)` é **deny-all** se houver um único item sem autorização e só pode ser executada pelo `service_role`. A projeção inclui exclusivamente ID da prova, ordinal, enunciado e alternativas públicas; não retorna `answer_key`, `correct_option`, `is_correct` ou `verdict`.

A licença fictícia de CI **não equivale a autorização de qualquer material externo**. Para conteúdo real, F4 deverá definir schema de direitos, proveniência, texto autoral/licenciado e aprovação humana. Até então, produção `NO_GO`. O serviço de Auth continua sintético e as verificações correm somente em PG17 efêmero.

## Execução certificada e limites de conclusão

**CI [#44707383292](https://github.com/auditeduca/canone/actions/runs/44707383292): 4/4 jobs SUCCESS**, na `main`, SHA `5786cb83007bd901d5ff1e22f0034ebd9ce62525`.

- PostgreSQL 17 real e efêmero; serviço Auth inteiramente sintético. A nova função `exam_questions` usa `SECURITY DEFINER` e bloqueia qualquer formulário incompleto, sem verificação vigente ou sem a declaração sintética de direito. Browser `authenticated` não recebe EXECUTE.
- A aplicação React S22 foi carregada em Chromium. O conteúdo inventado foi entregue **via gateway alpha.11**, com enunciados e alternativas somente, e a prova continuou pelo gateway até a revisão SRS persistida.
- O script encerrou **todo o processo Node do gateway**, relançou o processo com novos tokens sintéticos (hash diferente) e executou outra sessão Chromium mobile no **mesmo PG17**. A tentativa e a correção posterior foram recuperadas do banco; a segunda sessão não reutilizou token antigo, localStorage ou sessionStorage.
- Revogação simulada: `valid_until` das verificações de direitos foi colocado no passado. Uma nova sessão obteve os metadados de catálogo, mas o endpoint de **questões negou o formulário integralmente**, sem vazamento de enunciado nem gabarito.
- Na viewport mobile real, a verificação registrou `innerWidth=390`, `innerHeight=844`, metadado de viewport válido e toque sem `force` no botão de histórico; o ajuste de navegação/rodapé foi isolado em `src/secure-p0/p0-mobile.css`. As 26 rotas S22 continuam preservadas.
- Regressão offline, TypeScript/Vite S22 e Chromium frontend também passaram. Os erros de tentativas intermediárias foram tratados sem apagar seus logs históricos.

**Critério F3-REC-06:** PASS **somente** no escopo de integração de testes. **Permanecem abertas:** direitos reais e licenças de fontes CFC/EQT, validação editorial e normativa F4, usuário autenticado real Supabase F8, carga/confiabilidade, acessibilidade WCAG 2.2 AA completa e assinatura/cobrança real. SQL adicional permanece em `tests/sql` e não pode ser aplicado ao Supabase como migration. **NO_GO**.
