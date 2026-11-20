# 05 · MOTOR DE REPETIÇÃO ESPAÇADA

> Grade de 4 estados, não binário. E o log é a verdade.

## O problema do binário

"Acertou" e "errou" não são o mesmo que "sabe" e "está decorando". Um
aluno que acerta em 2 segundos e um que acerta em 40 segundos precisam de
intervalos diferentes. O modelo binário trata os dois como o mesmo aluno.

O Cânone usa quatro estados:

| Grade | Significado | Efeito no agendamento |
|---|---|---|
| `facil` | sabe, rápido | intervalo longo (estabilidade × 2,4 + 1,5) |
| `esforco` | sabe, mas custou | intervalo curto (1 dia), item **frágil** |
| `errei` | não sabe | intervalo 0, entra em reaprendizado, conta lapse |
| `naosei` | nunca viu | **não entra no agendamento** |

## O fundimento

O ponto que evita o erro mais comum em SRS: **estado derivado e estado
declarado não se misturam**.

| `basis` | Quando | De onde vem o estado |
|---|---|---|
| `sistema` | simulado, gabarito conhecido | **derivado**: `correct=true` → `facil`; `correct=false` → `errei` |
| `autodeclarado` | flashcard, autoavaliação | **declarado**: o aluno diz (`facil`/`esforco`/`naosei`) |

O banco recusa as combinações impossíveis:

- `basis='sistema'` sem `correct` → erro
- `basis='autodeclarado'` sem `grade` → erro
- `basis='sistema'` com `correct` NULL gravado direto → CHECK constraint

E o motor nunca "melhora" um estado declarado: `esforco` em base
autodeclarada vira `esforco`, não `facil`. Porque do simulado não se pode
saber se a pessoa decorou.

## `naosei` não é revisão

Conteúdo nunca visto não é revisão. `naosei` deixa o item em estado
`nova`, com `due_at = NULL`, e ele **não** aparece em `learning.due_items()`.

Revisar o que nunca foi ensinado é desperdício: o aluno gastaria o dia de
revisão em conteúdo que ainda vai ser ensinado. `naosei` alimenta a trilha
de estudo, não a de revisão.

## O log é a verdade; o estado é cache

```
learning.review_event      ← append-only, com algorithm_version
learning.user_item_state   ← cache, reconstruível
```

`review_event` é append-only por trigger (`trg_review_event_immutable`):
`UPDATE` e `DELETE` são recusados. Corrigir resposta errada de usuário é
evento novo, não edição.

> **Bug histórico (achado pelo teste):** a função `apply_review_event`
> atualizava o estado e **não gravava nada** em `review_event`. O log
> ficava vazio, `rebuild_user_state` não tinha o que reconstruir, e a
> propriedade "o log é a verdade" era só uma frase no comentário. A
> migration aplicava sem erro — o que não é prova de que a regra funciona.

Por isso a escrita é dividida em duas:

```sql
learning.apply_review_event(user, item, grade, basis, correct, ms, algver)
  → grava o EVENTO (append-only)
  → chama replay_event

learning.replay_event(event_id)
  → aplica o evento ao estado, sem gravar nada
```

E `learning.rebuild_user_state(user)` apaga o cache e reprocessa o log
inteiro com `replay_event` — **nunca** com `apply_review_event`, senão o
log cresceria a cada reconstrução.

### Por que `algorithm_version`

```sql
review_event.algorithm_version  -- 'srs-v1'
```

Sem isso, mudar o motor de repetição destruiria o histórico: o estado
atual deixaria de ser reconstruível, porque ninguém saberia qual algoritmo
produziu cada transição. Com o rótulo, dá para reprocessar o log antigo
com a versão antiga.

## O algoritmo

Modelo simplificado (SM-2 com as adaptações do produto):

```sql
facil   → estabilidade = min(estabilidade × 2,4 + 1,5, 365)   intervalo = dias
esforco → estabilidade = min(estabilidade × 1,05 + 0,4, 14)   intervalo = 1 dia
errei   → estabilidade = max(0,4, estabilidade × 0,35)         intervalo = 0
```

Estado resultante:

| Grade | Estado |
|---|---|
| `facil` | `revisao` (ou `aprendendo` na primeira vez) |
| `esforco` | `revisao` / `aprendendo`, com `fragile_streak` +1 |
| `errei` | `reaprendendo`, com `lapses` +1 |
| `naosei` | `nova`, `due_at = NULL` |

`fragile_streak` é o que o dashboard destaca: "acertou, mas frágil".

## A maestria é por assunto

`learning.mastery` é `(user_id, subject_id)` — **por assunto**, não por
item.

> **Bug histórico:** a função agregava com `GROUP BY i.id`, produzindo uma
> linha por item, e o `ON CONFLICT` sobrescrevia a linha do assunto com o
> último item lido. A maestria virava "quantos itens o último item tem".
> Além disso, o `LEFT JOIN` com `review_event` multiplicava as linhas
> (item × evento), inflando as contagens.

A versão correta consolida **por item** primeiro e soma no assunto depois.

```
items_seen      itens com state <> 'nova'
items_mastered  state='revisao' E stability_days >= 21
items_fragile   is_fragile
items_unseen    state='nova'
accuracy        correct_answers / total_answers   (NULL sem resposta)
confidence      0,6 × (maduros / vistos) + 0,4 × (acertos / respostas)
```

A confiança **não** tem número mágico ("40 itens"): ela cresce com a
evidência do aluno, não com o relógio.

`accuracy` é NULL sem resposta — nunca 0. Zero é "errou tudo"; NULL é
"ainda não respondeu". A diferença importa.

## Idempotência

`apply_review_event` é a única porta de escrita. Reprocessar o **mesmo
evento** (`replay_event` com o mesmo id) não muda o estado. Isso importa
quando o job de agendamento roda duas vezes.

## O que a suíte prova

| Prova | Arquivo |
|---|---|
| `naosei` não gera `due_at` e não entra nos devidos | `02-srs.test.mjs` |
| base `sistema` deriva `facil`/`errei`; sem `correct` é recusado | `02-srs.test.mjs` |
| base `autodeclarado` preserva `esforco` | `02-srs.test.mjs` |
| `review_event` recusa UPDATE e DELETE | `02-srs.test.mjs` |
| `rebuild_user_state` reproduz o estado | `02-srs.test.mjs` |
| a maestria agrega por assunto (2 itens → `items_seen = 2`) | `02-srs.test.mjs` |
| a constraint base × correct é do banco | `02-srs.test.mjs` |
