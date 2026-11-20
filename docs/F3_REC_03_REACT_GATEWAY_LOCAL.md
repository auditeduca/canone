# F3-REC-03 — React histórico reutilizado com adaptador HTTP P0 (primeira fatia)

**Data:** 20/11/2026. **Estado:** implementação candidata à validação CI, `NO_GO` produção.

## Reuso sem sobrescrever S22

Mantidos **todos os arquivos históricos existentes**, inclusive `src/main.tsx`, `src/App.tsx`, `ExamQuestion`, CSS, o catálogo e as 26 rotas montadas. Foram **adicionados** uma nova entrada de integração `source-s22/app/jornada-servidor.html`, `src/secure-p0/` e `vite.p0.config.ts`. A página usa `Nav`, `Footer`, `Disclaimer` e `ExamQuestion` do mesmo design system React S22; não é um terceiro design.

O fluxo: provedor local restrito informa `getForm()` com **somente** `id, questions:[ordinal,stem,options:[code,text]]` sem gabarito. O validador rejeita qualquer atributo adicional, inclusive `correct_option`. Com `getToken()` in-memory, o navegador chama `POST /api/v1/exam/start`, `answer`, `finish`, `reveal` e `review` com a estrutura de gateway NS-03. Só solicita o gabarito **após** a confirmação de conclusão. Gabarito, regras e assinatura continuam no backend.

**Bloqueio intencional:** sem as duas funções explícitas `window.__CANONE_P0_TEST_ONLY__.getForm/getToken` e hostname loopback, a UI recusa a operação. Mesmo em localhost **não existe autenticação gerenciada**, catálogo autenticado, renovação de JWT ou direitos editoriais; essa injeção é **exclusivamente fixture CI**, jamais interface de login pública. Sem localStorage, sessionStorage ou chaves de banco. A UI não gera resultado oficial, nem utiliza gabarito sintético empacotado na NS-04.

## Testes e próximos gates

- `node --experimental-strip-types --test tests/f3_react_gateway_contract.test.mjs` verifica contrato público sem chave, rejeição de campos indevidos, JWT ausente, 403 e chamadas same-origin.
- `npm run build` da aplicação original e `./node_modules/.bin/vite build --config vite.p0.config.ts` verificam TypeScript, design e multipágina preservada.
- Próximo: teste real Chromium na página integrada; depois acoplar um *servidor de catálogo autorizado* de testes e unir browser→gateway→PG17 (ainda não comprovado).
- Supabase Auth verdadeiro e produção permanecem F8. `NO_GO`, sem qualquer alteração remota.

**Endereço local para verificação:** `http://127.0.0.1:5173/jornada-servidor.html` servido por Vite no workspace de teste. É um artefato de integração, não endereço publicado.
