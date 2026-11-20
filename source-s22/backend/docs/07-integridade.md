# 07 · INTEGRIDADE

> O que o banco recusa — e por que a regra mora aqui, e não na aplicação.

## A regra de ouro

> **O banco é a fronteira. A aplicação não é.**

Se a regra "não publique sem verificação" mora no backend, um importador,
um job, um script de admin ou um `psql` buram a regra. Se ela mora no
banco, não há caminho.

Por isso toda regra estrutural é uma constraint, um trigger ou uma
view — e toda uma delas tem um teste que prova que recusa.

## As vinte e três regras que o banco impõe

### 1 · Publicar exige verificação vigente

```sql
editorial.enforce_verification_on_publish()
```

Publicar exige `editorial.verification` com `state='verificada'` e
`valid_until` no futuro (ou nulo).

> **Bug histórico:** o `SELECT` que buscava a verificação não tinha
> `ORDER BY`. Com várias verificações (tentativas recusadas, revisões), o
> banco pegava uma linha **arbitrária** — tanto podia bloquear um item
> legítimamente verificado quanto liberar um não verificado. A regra agora
> é "existe ao menos uma verificação verificada e vigente", e a mensagem
> de erro mostra a decisão **mais recente**.

### 2 · Item de avaliação tem exatamente uma alternativa correta

```sql
learning.enforce_single_correct_option()      -- no payload
learning.require_correct_option_to_publish()  -- na publicação
```

A regra é do **tipo**, não da projeção: se o item é da família
`avaliacao`, ele tem exatamente uma alternativa correta — mesmo que ainda
não tenha nenhuma versão de payload.

> **Bug histórico:** a trigger devolvia cedo quando não existia projeção
> (`IF v_item_id IS NULL THEN RETURN NEW`), e um item de avaliação sem
> payload era publicado com **zero** alternativas.

E o trigger de projeção recusa payload com duas corretas — na escrita, não
na publicação.

### 3 · Transição de estado fora da tabela é proibida

```sql
editorial.state_transition(family, from_state, to_state, requires)
editorial.enforce_state_transition()
```

O caminho não catalogado é recusado. E o caminho que exige verificação
(`requires='verificacao_vigente'`) só passa se a verificação existir.

> **Bug histórico:** a trigger fazia `JOIN editorial.content_type_version ctv
> ON ctv.id = ct.id` — chaves de tabelas diferentes. O JOIN não filtrava
> nada e podia devolver a família errada. A função se chamava
> `enforce_state_transition` e **não exigia transição nenhuma**.

### 4 · A verificação verificada exige o trecho literal

```sql
CHECK (state <> 'verificada' OR source_quote IS NOT NULL)
```

Uma verificação sem o trecho da fonte é opinião com carimbo.

### 5 · Nova versão de norma caduca a verificação e abre moderação

```sql
norms.expire_verifications_on_new_version()
```

> **Bug histórico:** o trigger fazia `JOIN norms.norm_item ni ON ni.id =
> cr.to_item_id`, mas `content_relation.to_item_id` referencia
> `content_item`. **A citação nunca casava** e o mecanismo central de
> integridade — "a norma mudou, a verificação caduca" — nunca disparou.
> A aresta certa é `editorial.content_norm_citation`.

### 6 · Log append-only, com cadeia de hash

```sql
audit.forbid_mutation()     → UPDATE e DELETE recusados
audit.set_row_hash()        → prev_hash + row_hash em cada linha
audit.verify_chain()        → onde a cadeia quebra
```

O verificador **recalcula** o hash de cada linha a partir do conteúdo.

> **Bug histórico:** a versão anterior só comparava `prev_hash` com o
> `row_hash` da linha anterior. Quem reescrevesse o conteúdo de uma linha
> **sem recalcular o hash** deixava a cadeia "íntegra" — a prova não era
> conferida. E o hash usava `p_occurred_at::text`, que depende do
> `TimeZone` da sessão: o mesmo dado gerava hash diferente conforme quem
> verificava. Hoje usa epoch.

### 7 · O log de revisão é a verdade, e é append-only

```sql
learning.review_event_is_immutable()  → UPDATE e DELETE recusados
```

> **Bug histórico:** a função existia, **o trigger não**. A tabela era
> mutável, e a propriedade central do SRS era decorativa.

### 8 · Gabarito definitivo exige a prova inteira e todas as posições

```sql
learning.assert_answer_key_complete()   -- CONSTRAINT TRIGGER DEFERRABLE
```

A verificação roda no **COMMIT**, quando as entradas já foram inseridas.
Uma validação immediate só valeria na entrada — e "regra que só vale na
entrada" é regra morta. É a mesma lição do `review_event` append-only.

### 9 · A letra do gabarito tem que existir entre as alternativas

```sql
learning.check_answer_key_entry()
```

É o detector de **prova desalinhada**: o defeito clássico da extração de
PDF de gabarito, em que o parser perde uma seção e a letra da questão 37
passa a ser a da 36. O acervo real já teve esse bug — corrigido no
pipeline de extração. No banco, a extração errada é **recusada**, com a
posição e a alternativa na mensagem.

### 10 · O gabarito oficial tem precedência sobre o payload

```sql
learning.set_item_correct()  +  learning.apply_answer_key()
```

O payload é o que o Cânone escreveu; o gabarito é o que o CFC publicou.
Quando divergem, quem está certo é o CFC — e a divergência tem que ser
resolvida, não silenciada.

> **Bug histórico (desta incrementação):** a projeção reescrevia
> `is_correct` a cada mudança de payload. Editar o enunciado de uma
> questão de prova **devolvia a letra antiga** e o gabarito oficial
> deixava de valer em silêncio. A projeção agora reaplica o gabarito
> vigente depois de reescrever as alternativas.

### 11 · Questão anulada não tem resposta, e o veredito a distingue

```sql
learning.clear_item_correct()   -- anulada remove a letra
learning.grade_answer()         -- devolve 'correta' | 'errada' | 'anulada'
```

Uma questão anulada pelo CFC **não pode ser "errada"** — o candidato não
tem como errá-la. E anular uma questão **já publicada** é recusado:
quem praticou precisa ver a retração.

### 12 · O gabarito de uma prova real só é revelado depois da tentativa

```sql
learning.reveal_exam_key()
```

O gabarito do CFC é documento público. Mas revelá-lo **antes** da
tentativa é dar a resposta de graça. A porta é o banco, não a interface.

### 13 · A letra do item é DERIVADA do gabarito — ninguém escreve por cima

```sql
learning.reconcile_item_correct()   -- AFTER UPDATE OF is_correct, SECURITY DEFINER
```

A precedência do gabarito oficial (regra 10) valia dentro do caminho da
projeção. Quem escreve a letra direto na tabela — o dono do schema, um
importador, um job — escrevia por cima da letra oficial em silêncio.

Duas camadas fecham a boca:

| Camada | O que faz |
|---|---|
| **Privilégio** (017) | `learning.item_option` não tem UPDATE para nenhum papel de aplicação — só SELECT para staff e admin. A aplicação não escreve a letra. |
| **Banco** (021) | Quem escreve por cima da letra oficial é **recusado** — e quem tenta marcar a correta numa questão **anulada** também. |

A regra é um **constraint trigger `DEFERRABLE INITIALLY DEFERRED`** e roda
no COMMIT — porque a aplicação do gabarito é uma escrita em dois passos
(limpa as alternativas, marca a oficial) e um trigger de linha veria o
estado **transitório** e brigaria com a aplicação legítima. A regra tem que
ver o estado final.

E ela é **fail-closed**: se a questão pertence a uma prova que tem
gabarito e o gabarito não pôde ser lido, a escrita é **recusada** — a
regra não se disfarça de "não há gabarito". Uma regra que só existe quando
o contexto ajuda é regra morta.

### 14 · A prova com gabarito definitivo é SELADA

```sql
learning.prova_selada_nao_muda()   -- BEFORE INSERT/UPDATE/DELETE em exam_form_item
```

Uma prova que já tem gabarito **definitivo** não aceita mais uma posição:
nem entrar, nem sair, nem trocar de questão. Sem essa regra, apagar uma
posição deixava o gabarito apontando para uma posição que não existia
mais — e a regra de completude (que é um trigger sobre o **gabarito**) nem
acordava, porque ela só é disparada quando o gabarito é tocado, não quando
a **prova** é mexida.

A reimportação da **mesma** prova continua idempotente: reposicionar a
mesma questão na mesma posição não é mudança, e a regra sabe disso.

### 15 · A ÁREA VEM DO PAPEL, NÃO DE UM GUC QUE QUALQUER UM ESCREVE

```sql
ops.current_role()   -- o GUC 'role' (só muda por SET ROLE) ou current_user
ops.is_staff()       -- canone_staff | canone_admin
```

`app.current_area` é um GUC de **texto livre**: qualquer sessão escreve
`SET app.current_area = 'staff'`. Quem é staff tem que ser o **PAPEL** — e
o papel só muda por `SET ROLE`, que exige **membro** do papel de destino
(`canone_subscriber` não é membro de `canone_staff`; só `canone_app` é, com
`NOINHERIT`).

O QA mediu o estrago antes do conserto: com a área forjada, o assinante
**revelava o gabarito antes de terminar a tentativa** — a regra "o gabarito
só aparece depois" era decorativa — e ainda **finalizava a tentativa
alheia**. O `app.current_area` continua existindo: como **diagnóstico**,
nunca como autorização.

### 16 · Uma alternativa correta — contada no estado DEPOIS da mudança

A regra é a mesma da 2, corrigida: a contagem olha o estado final da
mudança (as corretas do item, exceto a linha que muda, mais a linha nova).
A versão anterior contava o estado **antes** e recusava só se a contagem já
fosse maior que 1 — então um `INSERT` de uma alternativa `E` com
`is_correct = true` criava a **segunda** correta em silêncio, e a publicação
passava a recusar depois.

### 17 · O número de questões é fato da PROVA, não do gabarito

O conflito de número de questões é conferido contra a **TRILHA** (que é por
exame e por especialidade — é onde o número mora), e vale para **toda**
variante, preliminar ou definitiva. Antes, a comparação olhava só a rodada
e só existia para a Suficiência — e a rodada nasce `NULL` quando a
primeira variante que chega é de EQT, o que desligava a regra para sempre.
O QA furou a regra por ali: uma variante da Suficiência com 30 questões
numa trilha que declara 50 era aceita, e a visão de governança mostrava
`question_count=50, items_linked=30` na mesma linha.

### 18 · O gabarito DEFINITIVO é imutável

```sql
learning.answer_key_status_imutavel()      -- o selo não se desfaz
learning.answer_key_definitivo_imutavel()  -- a entrada não se apaga nem muda
```

O gabarito definitivo é um **documento oficial**: o status não volta a
preliminar, a fonte não troca, a entrada não se apaga nem muda de letra. A
transição preliminar → definitiva continua livre (é o caminho normal); o que
é proibido é **desfazer** o selo.

Reimportar o **mesmo** acervo continua idempotente: reescrever o mesmo
valor não é mudar.

### 19 · A régua não se rebaseia depois do selo

```sql
learning.exam_count_imutavel_apos_selo()
```

`exam_track.question_count` (e o da rodada) é a **régua** contra a qual a
completude do gabarito é conferida. Trocar a régua depois de selar a prova é
a mesma coisa que trocar o gabarito — só que por fora. Com a prova selada, o
número é imutável.

> A cadeia que o QA mediu: rebaixar o definitivo → destravar a prova →
> rebasear a régua → selar uma prova curta. Os quatro elos juntos deixavam
> o banco com uma prova de 3 posições valendo 2 — e a prova de forma do
> acervo real continuava **verde**. É a regra exata que este projeto já
> conhece: migration que aplica sem erro **não** é prova.

### 20 · Privilégio de tabela sem USAGE no schema não chega ao fim

```sql
GRANT USAGE ON SCHEMA identity TO ...;   -- 025
ops.schema_sem_usage(text)               -- auditoria de alcance
```

A 017 concede privilégio de **tabela** em `identity.user_profile`,
`identity.consent` e `identity.data_request`. As policies do 014 existem.
Mas **nenhum papel tinha USAGE no schema `identity`** — e sem USAGE a
consulta morre em `permission denied for schema identity` **antes** do RLS
ser avaliado.

O assinante não conseguia ler nem atualizar o **próprio perfil**, registrar
**consentimento** (LGPD) nem abrir **pedido de dados**. O admin não
conseguia ler as contas.

A lição do achado: ele não apareceu em nenhum teste, porque os testes medem
o que o banco **recusa** — e aqui o banco recusava, com a mensagem errada
(parecia falha de privilégio de tabela, não de schema). **A verificação tem
que ser positiva** — "o assinante lê o próprio perfil" — e não só "algo foi
recusado". `ops.schema_sem_usage()` transforms a lacuna em consulta
auditável.

### 21 · O caminho CONCEDIDO não pode estar morto

```sql
CREATE POLICY staff_read_item_option ON learning.item_option FOR SELECT TO canone_staff;
CREATE POLICY admin_read_item_option ON learning.item_option FOR SELECT TO canone_admin;
```

A 017 concede `SELECT` em `learning.item_option` ao staff e ao admin. A
018 cria a tabela com RLS `ENABLE` + `FORCE`. E a **014 — a varredura que
cria policy por papel — não criou policy para essa tabela**. Com RLS FORCE
e **zero policies**, o staff e o admin enxergavam **zero linhas**: o
privilégio concedido não chegava ao fim.

O caminho conferido para checar a extração do gabarito à mão estava morto —
e a falha se **disfarçava de erro de dado** ("a alternativa C que não
existe"), quando o problema era de **privilégio**. Pior: `check_answer_key_entry`
e `project_answer_key_entry` eram `SECURITY INVOKER` — conferiam o gabarito
com o direito de quem chama, e quem não enxerga a alternativa não consegue
conferi-la. As duas passam a ser `SECURITY DEFINER`.

### 22 · Número sem fonte não vira número por DEFAULT

```sql
ALTER TABLE taxonomy.exam_edition
  ALTER COLUMN question_count DROP DEFAULT,
  ALTER COLUMN passing_score  DROP DEFAULT;
```

A 019 tirou o `NOT NULL` de `question_count` e `passing_score` — porque o
número da prova é `NULL` enquanto não houver fonte conferida. Mas o
`DEFAULT 50/25` ficou: uma rodada criada sem número explícito recebia **50
questões e 25 de corte, silenciosamente, sem fonte nenhuma**. É o oposto da
tese do projeto. `DEFAULT NULL`: quem não tem fonte não escreve número.

### 23 · O papel de sistema: quem as funções do banco olham COM

```sql
CREATE ROLE canone_system NOLOGIN NOINHERIT;   -- dono das funções SECURITY DEFINER
CREATE POLICY system_full ON <tabela> FOR ALL TO canone_system USING (true) WITH CHECK (true);
```

As funções `SECURITY DEFINER` (o veredito, a revelação, a projeção, a
ingestão, a leitura do aluno) pertencem a quem as criou. Se esse dono é um
papel comum, e as tabelas têm RLS `FORCE`, **a função não enxerga linha
nenhuma** — e o defeito é SILENCIOSO:

> `learning.grade_answer(item, 'C')` devolvia **`'errada'`** para a
> alternativa **correta**. O aluno que acertou era reprovado, sem erro, sem
> log, sem exceção.

A suíte estava verde porque o PGlite roda com `postgres` **superusuário**, e
superusuário ignora RLS mesmo com `FORCE` — o teste media uma condição que
**produção não tem**.

A correção é um papel de sistema: `NOLOGIN`, **sem** `BYPASSRLS` (só o
superusuário concede esse atributo, e num Postgres gerenciado o dono da
base raramente é superusuário), com privilégio de tabela e policy
permissiva explícitos. As funções passam a pertencer a ele.

O alcance do sistema **não anula as regras**: RLS é visibilidade de linha,
não é trigger. Publicar sem verificação continua recusado, e o log de
auditoria continua append-only — com o papel de sistema executando.

## Provas de recusa

Toda regra acima tem um teste. A suíte tem **148 provas**, todas verdes:

| Suíte | Foco | Testes |
|---|---|---|
| `01-integridade-editorial` | publicação, verificação, transição, projeção | 13 |
| `02-srs` | grade, fundimento, `naosei`, log imutável, reconstrução, maestria | 12 |
| `03-visao-usuario` | concessão: motivo, prazo, escopo, expiração, registro | 11 |
| `04-rls` | três áreas, gabarito, isolamento, contexto | 11 |
| `05-normas` | vigência, expiração por nova versão, moderação | 6 |
| `06-auditoria` | append-only, cadeia, adulteração detectada | 9 |
| `07-contratos` | enumeração, preço NULL, segredo, fonte com trecho | 12 |
| `09-provas-gabarito` | prova, variante, gabarito, anulação, veredito, precedência | 18 |
| `10-tentativa-ingestao` | tentativa, revelação tardia, ingestão do acervo | 17 |
| `08-camada-conexao` | a camada de conexão entrega o mesmo isolamento | 8 |
| `11-comander` | prévia desfeita, recusa do banco, contrato gerado, HTTP | 10 |
| `12-sistema` | dono das funções, alcance do sistema, mutação que quebra o veredito | 8 |

### A regra do teste

```js
export async function recusa(db, fn) {
  try { await fn(); return null; }
  catch (e) {
    if (!e || (!e.code && !e.severity)) throw e;  // bug de JS ≠ recusa
    return e;
  }
}
```

Só conta como recusa o que veio do **Postgres** (tem `code`). Um
`TypeError` de JavaScript no próprio teste **propaga** — senão um teste
quebrado "passa" como se o banco tivesse recusado, e o falso verde
esconde exatamente o que a prova existe para achar.

Esse detalhe não é teórico: uma versão anterior do helper contava erro de
JavaScript como recusa, e um teste que quebrava por `null.id` passava
verde.

## A lição que vale mais que as regras

> **Migration que aplica sem erro não é prova de que a regra funciona.**

Sete das regras acima estavam escritas, documentadas e comentadas — e
**nenhuma** funcionava. Todas foram encontradas por testes de
comportamento, não por leitura.

E a lição voltou a aparecer nesta incrementação, com outra cara: o seed
criava o **tipo** de conteúdo sem criar a **versão**, e sem versão nenhum
item nasce. Os testes passavam — porque o *helper de teste* criava a
versão na hora. O teste media o harness, não o schema. Um gate que só
passa porque o teste fabrica o dado não é gate: é cenografia.

A lista éheterogênea de propósito:

| Bug | Como se manifestava |
|---|---|
| `WITH ORDINALITY AS opt(n, n_ord)` | `record ->> unknown` — a projeção nunca funcionou |
| `v_item` confundido com `content_item_id` | violação de FK em todo item |
| `chr(bigint)` | projeção caía em todo item com alternativas |
| `apply_review_event` sem `INSERT` | log vazio; a verdade não era gravada |
| `GROUP BY i.id` na maestria | contagem por item, não por assunto |
| JOIN de `content_relation` com `norm_item` | expiração por nova versão nunca disparava |
| `SET LOCAL ROLE` que não revertia | papel vazava entre requisições |
| `SELECT` de verificação sem `ORDER BY` | publicação decidida por acaso |
| trigger de `review_event` inexistente | log mutável |
| `now()` em predicado de índice | migration não aplicava |
| `verify_chain` sem recalcular | adulteração não detectada |
| trigger de expiração reentrante | stack overflow |
| projeção do payload reescrevendo `is_correct` | o gabarito oficial deixava de valer em silêncio |
| seed de tipo de conteúdo **sem versão** | nenhum item podia nascer — e o teste media o helper, não o schema |

Nenhum deles aparece numa revisão de código que lê o SQL. Todos aparecem
quando se **pergunta ao banco o que ele faz**.
