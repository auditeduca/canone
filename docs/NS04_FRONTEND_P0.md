# Cânone — NS-04 frontend P0: primeira fatia funcional (20/11/2026)

## Estado de entrega
**IMPLEMENTADO PARA DEMONSTRAÇÃO LOCAL; NÃO HOMOLOGADO PARA PRODUÇÃO.**
Componentes: `frontend/student/index.html`, `styles.css`, `app.mjs`, `model.mjs`. Testes Node e navegador Chromium desktop/mobile.

## Execução sem dependências externas
```sh
python3 -m http.server 8090 --bind 127.0.0.1
# Abrir http://127.0.0.1:8090/frontend/student/index.html?demo=1
node --test tests/ns04_student_frontend.test.mjs
# E2E opcional em máquina com Playwright Python + Chromium:
python3 tests/ns04_student_browser.py
```

A UI oferece menu responsivo, catálogo ilustrativo, tentativa, respostas, encerramento,
revelação posterior, revisão SRS e métricas na sessão. Nenhum item de conteúdo é oficial:
duas questões **originais/sintéticas** implementam a amostra. Sem chamadas ao Supabase.

## Limites de segurança
- A fixture e seu gabarito estão **embutidos no JavaScript cliente**. O fluxo UI não revela a resposta antes de concluir, mas o código da demonstração **não oferece sigilo real**. Somente NS-03 no backend impõe a regra contra inspeção antecipada.
- A fixture opera só em localhost/127.0.0.1 com `?demo=1`. Não é um serviço de autenticação; não representa identidade, licença, assinatura ou permissão real.
- `createHttpGateway` contém o contrato de cinco POSTs same-origin com Bearer em memória. Ligação a servidor local de catálogo/token gerenciado e integração real do browser ainda NÃO estão concluídas.
- O histórico, progresso e recibos exibidos são apenas **em memória da aba**. A repetição de SRS é idempotente na fixture, mas persistência exige backend e validação.
- O workflow conserva `NO_GO`, nenhum deploy e nenhuma migration remota.

## Evidência e próximos passos
- `tests/ns04_student_frontend.test.mjs`: invariantes e estados/contrato de gateway.
- `tests/ns04_student_browser.py`: navegação completa no Chromium, largura 390px, teclado, ausência de gabarito antes de encerrar e revisão local.
- Próximos itens NS-04: endpoint de catálogo/conteúdo autorizado sem gabarito; sessão Auth local segura, E2E **browser → gateway → PG17**, persistência de histórico/progresso, estados de erro/rate limit, WCAG 2.2 AA auditável e testes de concorrência de navegação.
- Supabase exclusivo permanece em F8. `0.23.0-alpha.9` e gate `NO_GO` inalterados.

## CI confirmado — 20/11/2026

- Commit de implementação: [e7dc0044](https://github.com/auditeduca/canone/commit/e7dc0044100951fa252c3f0358d15ce55fd1692f).
- Correção de progresso e sincronismo E2E: [24e6e8ae](https://github.com/auditeduca/canone/commit/24e6e8ae936ceac233fd1a1ab7f6d83391c099a3).
- [GitHub Actions #44692128299](https://github.com/auditeduca/canone/actions/runs/44692128299): **3/3 jobs SUCCESS** (regressão offline, PG17 efêmero, Chromium desktop/mobile local).
- **7 testes Node NS-04 aprovados**; o teste de navegador percorreu o formulário, confirmou a indisponibilidade do botão de gabarito antes de concluir, salvou revisões e verificou viewport móvel 390px e skip link por teclado.
- CI anterior [#44691925544](https://github.com/auditeduca/canone/actions/runs/44691925544) falhou em contador de resposta final; causa corrigida pelo commit acima. Evidência negativa preservada.
- Aprovação **restrita à demonstração local**. Browser→PG17, Supabase Auth real, catálogo/licenças, histórico de aluno e implantação permanecem sem aceite.
