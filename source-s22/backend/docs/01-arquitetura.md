# 01 · ARQUITETURA DO BACKEND CÂNONE

> Ecossistema de Provas para Contadores — modelo de dados estrutural e metamodelo.

## A tese, em uma frase

**O conteúdo é o produto, e o produto só vale se for verdadeiro.** Tudo que
segue é a consequência mechanically verificável dessa frase: o banco guarda
a fonte ao lado do número, a verificação é uma entidade de primeira classe,
e a regra que impede a publicação sem verificação mora no banco — não na
aplicação.

## Três áreas, três contratos

O Cânone tem três áreas de produto. Cada uma é um **contrato de leitura**,
implementado por views, e cada uma tem um **papel de banco**:

| Área | Quem é | Papel | Le o quê |
|---|---|---|---|
| Pública | qualquer pessoa | `canone_public` | conteúdo publicado, taxonomia, normas, planos |
| Assinante | quem tem conta e assinatura | `canone_subscriber` | o próprio progresso, o próprio histórico |
| Administrativa | staff e admin | `canone_staff` / `canone_admin` | conteúdo, governança, auditoria |

A **visão de usuário** (o staff lendo o dado de um aluno) não é uma quarta
área: é uma concessão auditada dentro da área administrativa, e tem porta
única (`admin.read_user_progress_as`).

## O banco é a fronteira

Três camadas, independentes:

```
   PRIVILÉGIO  (017)  →  o papel pode sequer tocar na tabela?
   RLS        (014)  →  o papel pode ver ESTA LINHA?
   VIEW       (013)  →  o papel enxerga a ATRAVÉS de qual contrato?
```

Uma falha de autorização no backend vaza, no máximo, entre áreas — e a
suíte de testes existe para provar que nem isso acontece.

## Schemas por domínio, não por camada

```
identity     credencial, perfil, consentimento, solicitação de dados
editorial    metamodelo, conteúdo versionado, verificação, fonte, auditoria editorial
taxonomy     áreas, assuntos, subtopics, módulos, blueprint do edital
norms        issuers, normas, versões, itens normativos
learning     itens de avaliação, SRS, progresso, notas, favoritos, offline
commerce     planos, assinaturas, pagamentos, elegibilidade
admin        concessão de visão de usuário, moderação, feature flags
ops          settings, integrações, webhooks, jobs
audit        log append-only com encadeamento de hash
```

Um módulo do produto (flashcards, simulados) atravessa várias tabelas; um
domínio (editorial, learning) pertence a vários módulos. Organizar por
camada obrigaria a mesma informação a mudar de lugar a cada feature nova.

## O fluxo de uma requisição

```
  HTTP
   │
   ├─ 1. Autenticação → userId (fora do escopo deste schema)
   ├─ 2. withArea(db, { area, userId, requestId }, fn)
   │       ├─ BEGIN
   │       ├─ SET LOCAL ROLE canone_<área>
   │       ├─ SET LOCAL app.current_area / app.current_user_id / app.request_id
   │       ├─ fn(tx)  ← o repositório lê de VIEW
   │       └─ COMMIT (ou ROLLBACK)
   │
   └─ 3. O banco devolve o que a ÁREA permite, não o que a área pediu.
```

`SET LOCAL` (e não `SET`) porque o contexto morre com a transação. Se
sobrasse papel na sessão, o próximo request herdaria a sessão de outro.

O papel técnico `canone_app` é o trampolim: conecta, troca de papel, nunca
é o papel de uma requisição de usuário. Ele é `NOINHERIT` — não herda as
permissões dos papéis de área automaticamente; a troca é sempre explícita.

## O que este repositório entrega

| Peça | Onde | Estado |
|---|---|---|
| 27 migrations | `db/migrations/` | aplicam em ordem, com checksum |
| Runner com checksum | `scripts/migrate.mjs` | aborta se migration aplicada for editada |
| Provas de recusa | `tests/` | 82 testes, todos verdes |
| Camada de conexão | `src/db/` | pool, transação, contexto de RLS |
| Repositórios por área | `src/areas/` | público, assinante, admin |
| Configuração e segredos | `src/config/` | validação na subida, cofre plugável |
| Documentação | `docs/` | este conjunto |

## Como rodar

```bash
cd backend
npm install
npm run migrate:reset   # sobe um PGlite em memória com as 27 migrations
npm test                # 148 provas de recusa (compila o TS antes)
```

Variáveis de ambiente:

| Variável | Quando | Default |
|---|---|---|
| `DATABASE_URL` | produção | — (obrigatória em produção) |
| `PGLITE_DATA_DIR` | dev/teste | `:memory:` |
| `APP_ENV` | sempre | `desenvolvimento` |
| `POOL_MAX` | sempre | `10` |
| `STATEMENT_TIMEOUT_MS` | sempre | `5000` |
| `CANONE_SECRET_<NOME>` | quando houver segredo | — |

## O que NÃO está aqui (e por quê)

| Fora | Por quê |
|---|---|
| Autenticação (senha, OAuth, MFA) | É a porta da porta; o schema já a trata como `identity.account` + consentimento |
| Cobrança (checkout, baixa de boleto, conciliação) | `commerce.subscription` e `commerce.payment` modelam o estado; o provedor entra por `ops.integration` |
| E-mail transacional | Idem — `ops.integration` com `kind='email'` |
| Worker de jobs | `ops.job_run` e `ops.webhook` modelam o estado; o agendador é externo |
| Frontend | Em `../app` |

Cada um desses é uma **porta de entrada** que o schema já espera. Nenhum
deles altera a forma do dado.
