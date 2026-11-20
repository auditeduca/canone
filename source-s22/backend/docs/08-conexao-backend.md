# 08 · CONEXÃO COM O BACKEND

> Como a aplicação fala com o banco, e por que a troca de papel é a parte
> mais importante do arquivo.

## O contrato do driver

```ts
interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

Dois adaptadores:

| Adaptador | Onde | Por quê |
|---|---|---|
| `PGliteDb` | dev e testes | PostgreSQL 16.4 de verdade, compilado em WASM |
| `PgDb` | produção | node-postgres, pool de verdade |

> **Não é abstração por gosto.** É o que permite rodar a suíte inteira
> contra um Postgres real — sem mock. Um mock de banco não prova nada
> sobre RLS, constraints e triggers, que é justamente o que este projeto
> precisa provar.

O `PGlite` tem **uma** conexão, então a serialização é explícita: as
transações rodam em fila. Não é otimização — `SET LOCAL ROLE` depende que
ninguém troque o papel entre o `BEGIN` e o `COMMIT`.

## O contexto da requisição

```ts
await withArea(db, { area: 'assinante', userId, requestId }, async (tx) => {
  // aqui tx já está no papel canone_subscriber, com o usuário definido
});
```

O que `withArea` faz, sempre nesta ordem:

```
BEGIN
SET LOCAL ROLE canone_subscriber
SET LOCAL app.current_area      = 'assinante'
SET LOCAL app.current_user_id   = '<uuid>'   (ou '' para anônimo)
SET LOCAL app.request_id        = '<uuid>'
... a função do repositório ...
COMMIT   (ou ROLLBACK)
```

### Por que `SET LOCAL` e não `SET`

`SET LOCAL` vale só até o fim da transação. `SET` é de sessão: se a
conexão volta para o pool com o papel trocado, o **próximo** request herda
a sessão de outro — vazamento silencioso entre usuários.

O teste `04-rls.test.mjs` cobre isso: depois de uma requisição de
assinante, uma requisição anônima da área pública não vê nada daquele
aluno, e `current_setting('app.current_user_id')` volta a NULL.

### Por que o contexto vai por GUC e não por parâmetro

Porque o **RLS do banco** precisa saber quem é o usuário. Uma policy
`USING (user_id = ops.current_user_id())` lê o GUC da sessão. Se a
identidade viesse por parâmetro, cada consulta precisaria repetir o filtro
— e uma consulta que esquecesse o filtro vazaria.

Por isso **nenhum repositório aceita `userId` como argumento**. A
identidade vem do contexto. Se viesse do argumento, bastaria o chamador
passar o id de outra pessoa.

## As funções do contexto

```sql
ops.current_user_id()   uuid    -- o usuário da requisição (NULL = anônimo)
ops.current_area()      text    -- 'publica' | 'assinante' | 'staff' | 'admin'
ops.current_request_id() text   -- para correlacionar a auditoria
ops.is_staff()          boolean
```

São `STABLE` e leem `current_setting('app.current_user_id', true)`.

## O fluxo por área

### Pública — sem login

```ts
const planos = await canone.publico.planos();
```

```sql
BEGIN
SET LOCAL ROLE canone_public
SET LOCAL app.current_area = 'publica'
SELECT ... FROM public.v_public_plan
COMMIT
```

O papel público não tem `SELECT` em `learning.item_option` — o gabarito
não é alcançável nem por engano.

### Assinante — com login

```ts
const prog = await canone.assinante({ userId }).porAssunto();
await canone.assinante({ userId }).registrar({ itemId, grade, basis, correct });
```

O repositório **não** passa `userId` para a query: usa
`ops.current_user_id()`. É o RLS que filtra, e o RLS lê o GUC.

### Administrativa — staff

```ts
const g = await canone.admin({ userId: staff }).conceder({...});
const prog = await canone.admin({ userId: staff }).lerProgresso({...});
```

A leitura de dado de aluno passa por `admin.read_user_progress_as`, que
exige concessão e registra o acesso.

## Configuração

```ts
const env = readEnv();
```

A configuração é validada **na subida**. Se `APP_ENV=producao` e
`DATABASE_URL` faltar, o processo não sobe:

> Um backend que sobe com a configuração errada e só falha quando alguém
> usa a área do assinante é um backend que vai falhar em produção na hora
> mais cara.

| Variável | Quando | Default |
|---|---|---|
| `DATABASE_URL` | produção | — (obrigatória) |
| `PGLITE_DATA_DIR` | dev/teste | `:memory:` |
| `APP_ENV` | sempre | `desenvolvimento` |
| `POOL_MAX` | sempre | `10` |
| `STATEMENT_TIMEOUT_MS` | sempre | `5000` |

## Segredos

```ts
const vault = new Vault(new EnvSecretProvider());
const apiKey = await vault.resolve(integration.secret_ref);
```

O banco guarda `secret_ref` — o **nome** do segredo no cofre, nunca o
valor. Se o valor entrasse no banco, um dump seria um vazamento de
credenciais.

Três garantias:

1. **Falha fechada.** Segredo ausente é erro explícito, não valor vazio.
2. **Cache com TTL** de 60s — resolver por requisição seria caro, cachear
   para sempre seria segredo obsoleto depois de uma rotação.
3. **Redação por chave** (`redigir()`): nenhum log do Cânone carrega
   credencial, e a máscara é por **chave**, não por valor — porque o valor
   é justamente o que não se pode saber sem resolver.

Trocar o cofre (Vault, AWS, GCP) é escrever **um** `SecretProvider`.

## O PAPEL DE SISTEMA — e o furo que o PGlite escondia

As funções `SECURITY DEFINER` do Cânone pertencem a um papel de sistema
(`canone_system`): `NOLOGIN`, **sem** `BYPASSRLS`, com privilégio de tabela
e policy permissiva explícitos nas tabelas de domínio.

Isso não é detalhe de implementação — é uma condição de **produção**:

> O dono comum das funções está sujeito ao `FORCE ROW LEVEL SECURITY`. Sem
> alcance, a função não enxerga linha nenhuma, e `learning.grade_answer`
> devolvia **`'errada'` para a alternativa correta**. O aluno que acertou
> era reprovado, sem erro e sem log.

E a suíte não pegou nada disso, porque o PGlite roda com `postgres`
**superusuário** — e superusuário ignora RLS mesmo com `FORCE`. O teste
media uma condição que produção não tem.

| | PGlite (desenvolvimento e teste) | Produção |
|---|---|---|
| Dono das funções | `postgres`, superusuário | papel comum, migrations aplicadas |
| RLS para o dono | ignorado (superusuário) | **aplicado** (`FORCE`) |
| O que a função enxerga | tudo | só o que o papel de sistema alcança |
| A suíte prova | que a regra existe | que a regra **fecha** |

**O que a implantação precisa.** O papel de sistema é criado pela migration
(027). Se o papel que roda a migration não puder criar papéis, ela falha
com a instrução exata — `CREATE ROLE canone_system NOLOGIN NOINHERIT;` — e
não com um erro genérico.

**O portão.** `ops.system_reach()` lista, função por função, quem é o dono,
se esse dono é superusuário, se tem `BYPASSRLS` e se o papel de sistema
alcança as tabelas. O teste `12-sistema` exige que a resposta seja
"nenhum superusuário, nenhum `BYPASSRLS`, todas alcançadas" — e prova que
esse portão **pode falhar**, devolvendo uma função a um papel comum e
conferindo que o veredito vira `'errada'`.

## Onde a aplicação poderia furar a regra

| Tentativa | Resultado |
|---|---|
| `SELECT` direto em `learning.mastery` como staff | `permission denied` — não há privilégio |
| Ler `learning.item_option` como assinante | `permission denied` — o gabarito é bloqueado nas duas camadas |
| `UPDATE` em `learning.review_event` | `append-only` |
| `DELETE` em `audit.audit_log` | `append-only` |
| Concessão sem motivo | CHECK |
| Concessão com 73h | `ck_grant_max_duration` |
| Publicar item sem verificação | `23514` + hint |
| Payload com 2 alternativas corretas | `23514` |
| Gravar review_event em nome de outro | RLS |
| Assinante reescrever a letra do gabarito | a letra é derivada — o banco recusa |
| Função do sistema publicar sem verificação | trigger — recusado (o alcance não anula a regra) |

Cada linha dessa tabela tem um teste.
