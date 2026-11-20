# Cânone — Backend

> **Ecossistema de Provas para Contadores** · modelo de dados estrutural e
> metamodelo.

O schema do Cânone não é um esquema de tabelas: é a **implementação de uma
tese**. O conteúdo é o produto, e o produto só vale se for verdadeiro —
então a verificação é uma entidade de primeira classe, o gabarito é
inacessível ao cliente, e a regra que impede publicação sem verificação
mora no banco, não na aplicação.

```
30 migrations · 90 tabelas base + 18 views · 157 provas de recusa · todas verdes
```

## Rodar

```bash
cd backend
npm install
npm run migrate:reset    # PGlite em memória, 30 migrations
npm test                 # compila o TS e roda as 157 provas
npm run comander:e2e     # prova de navegador (precisa do ../app)
npm run erd              # regera o diagrama entidade-relacionamento
npm run erd              # regera o ERD a partir do catálogo do banco
node scripts/prova-forma-acervo.mjs   # monta o acervo real inteiro e confere
node scripts/prova-comander-e2e.mjs   # o admin age sobre o banco, no navegador
```

Não é preciso Docker, nem Postgres instalado, nem `.env`. O PGlite **é**
o PostgreSQL 16.4, compilado em WASM.

## A área do administrador: Comander + Governança

A área do administrador não é um painel de leitura com botões. É um
**console de comandos**: cada ação privilegiada é um comando nomeado, com
contrato explícito, **prévia** e rastro.

A prévia é a peça central: ela não é uma simulação do navegador, é **a
mesma execução em transação desfeita** (`Db.dryRun`). O que a prévia diz
é o que o **banco** faria — inclusive a recusa, com a mensagem do banco. A
execução é a mesma função, confirmada.

| | |
|---|---|
| `src/areas/admin/comander.ts` | os 8 comandos, com a regra que o banco impõe |
| `src/areas/admin/estado.ts` | a governança: fila, concessões, auditoria, cadeia |
| `src/http/server.ts` | a superfície HTTP (`node:http`, sem framework) |
| `app/src/api/contrato-comander.ts` | o contrato **gerado** do backend (não se edita) |
| `app/src/screens/Comander.tsx` | a tela: Comander + Governança |

O plano completo, com o que ficou de fora e por quê, está em
[`docs/10-area-comander-governanca.md`](docs/10-area-comander-governanca.md).

## A regra de ouro

> **O banco é a fronteira. A aplicação não é.**

Toda regra estrutural é uma constraint, um trigger ou uma view — e tem um
teste que prova que **recusa**. Se a regra morasse no backend, um
importador, um job ou um `psql` a burariam.

## As três áreas

| Área | Papel | Vê |
|---|---|---|
| Pública | `canone_public` | conteúdo publicado, taxonomia, normas, planos |
| Assinante | `canone_subscriber` | o próprio progresso e histórico |
| Administrativa | `canone_staff` / `canone_admin` | conteúdo, governança, auditoria |

E a **visão de usuário** — o staff lendo o dado de um aluno — não é uma
quarta área: é uma concessão com motivo, prazo máximo de 72h, expiração
automática e registro de cada leitura, com porta única
(`admin.read_user_progress_as`).

## As doze regras que o banco impõe

1. **Publicar exige verificação vigente** — e o trecho literal da fonte é
   obrigatório numa verificação.
2. **Item de avaliação tem exatamente 1 alternativa correta** — a regra é
   do *tipo*, não da projeção.
3. **Transição fora da tabela é proibida** — o workflow é dado, não código.
4. **Verificação verificada exige `source_quote`.**
5. **Nova versão de norma caduca a verificação** e abre a moderação.
6. **`review_event` e `audit_log` são append-only** — e o log de auditoria
   tem cadeia de hash que detecta adulteração.
7. **O gabarito não é alcançável** pelo assinante: sem privilégio na
   tabela, sem policy, e a correção é do servidor.
8. **Gabarito definitivo exige a prova inteira** e todas as posições, sem
   buraco — a verificação é deferida para o `COMMIT`, porque regra que só
   vale na entrada é regra morta.
9. **A letra do gabarito tem que existir entre as alternativas** — é o que
   torna impossível importar uma prova desalinhada em silêncio.
10. **O gabarito oficial tem precedência sobre o payload** — o que o CFC
    imprimiu vale mais do que a letra que o redator deixou no enunciado.
11. **Questão anulada não tem resposta**, e o veredito distingue `anulada`
    de `errada`: ninguém pode errar uma questão que o CFC anulou.
12. **O gabarito de uma prova real só é revelado depois de a tentativa
    terminar** — antes disso, revelar é dar a resposta.

## Documentação

| Doc | O que tem |
|---|---|
| [`01-arquitetura.md`](docs/01-arquitetura.md) | as três áreas, os schemas, o fluxo da requisição |
| [`02-metamodelo.md`](docs/02-metamodelo.md) | content_type, payload canônico, verificação, transições |
| [`03-erd.md`](docs/03-erd.md) · [`03-erd.mmd`](docs/03-erd.mmd) | **gerado do banco** — 90 tabelas, 85 FKs |
| [`04-areas-acesso.md`](docs/04-areas-acesso.md) | as três fronteiras e a visão de usuário |
| [`05-srs.md`](docs/05-srs.md) | o grade de 4 estados, o fundimento, o log como verdade |
| [`06-lgpd.md`](docs/06-lgpd.md) | consentimento versionado, CPF cifrado, retenção |
| [`07-integridade.md`](docs/07-integridade.md) | as doze regras e os catorze bugs que as burlavam |
| [`08-conexao-backend.md`](docs/08-conexao-backend.md) | pool, transação, `SET LOCAL`, cofre |
| [`09-provas-gabarito.md`](docs/09-provas-gabarito.md) | a prova aplicada, o gabarito com ciclo de vida, a ingestão do acervo |
| [`adr/`](docs/adr/) | 7 decisões de arquitetura, com o que foi rejeitado |

## Estrutura

```
backend/
├── db/migrations/      30 migrations, em ordem, com checksum
├── scripts/migrate.mjs runner (aborta se migration aplicada for editada)
├── scripts/gerar-erd.mjs  gera o ERD do catálogo real
├── scripts/prova-forma-acervo.mjs  monta o acervo real (56 variantes) e confere
├── src/db/             driver, pool, transação, contexto de RLS, papéis
├── src/config/         env validado na subida, cofre de segredos
├── src/areas/          repositórios: public, subscriber, admin
├── tests/              157 provas de recusa
└── docs/               9 documentos + 7 ADRs
```

## O que este schema NÃO é

- Não é um mock. As 157 provas rodam contra um Postgres real.
- **Este pacote é o backend.** A prova de navegador (`npm run comander:e2e`) e a
  conferência do drift do contrato do app (`11-comander`) precisam da pasta
  `../app` — fora deste pacote. Elas **PULAM, declaradas**, quando o app não
  está presente (nunca passam em silêncio). No repositório completo, rodam.

## O papel de sistema (`canone_system`)

As funções `SECURITY DEFINER` pertencem a `canone_system`: `NOLOGIN`, **sem**
`BYPASSRLS` (só o superusuário concede o atributo — e num Postgres gerenciado
o dono da base raramente é superusuário), com `GRANT` de tabela e policy
permissiva explícitos nas tabelas de domínio.

Sem isso, em produção, o dono comum das funções está sujeito ao
`FORCE ROW LEVEL SECURITY` e não enxerga linha nenhuma: o veredito devolvia
`'errada'` **para a alternativa correta**, sem erro e sem log. No PGlite a
suíte não pegou nada disso, porque `postgres` é superusuário e ignora RLS
mesmo com `FORCE`.

O alcance do sistema **não anula as regras**: RLS é visibilidade de linha, não
é trigger. Publicar sem verificação continua recusado, e o log de auditoria
continua append-only — com o papel de sistema executando.

`ops.system_reach()` audita: dono de cada função, se é superusuário, se tem
`BYPASSRLS` e se o papel alcança as tabelas.
- Não é um "MVP de banco". As regras que importam já estão aqui — e
  nenhuma delas depende de disciplina da equipe.
- Não é um esquema de CMS genérico. É o modelo do Cânone: verificação como
  entidade, o gabarito como segredo, a visão de usuário como concessão
  auditada.
- Não é um catálogo de provas estático. A prova aplicada, a variante, o
  gabarito com ciclo de vida, a anulação e a tentativa de prova estão no
  schema — e `scripts/prova-forma-acervo.mjs` monta o acervo real inteiro
  para provar que ele cabe.

## Uma nota honesta

Sete das regras acima estavam **escritas, documentadas e comentadas** — e
**nenhuma funcionava**. A projeção por trigger nunca rodou; o log de
revisão nunca era gravado; a expiração por nova versão de norma nunca
disparou; o `review_event` era mutável; o verificador de cadeia não
conferia a prova.

Nenhum desses apareceria numa revisão de código que lê o SQL. Todos
apareceram quando se **perguntou ao banco o que ele faz**. A lista
completa está em [`07-integridade.md`](docs/07-integridade.md#a-lição-que-vale-mais-que-as-regras).
