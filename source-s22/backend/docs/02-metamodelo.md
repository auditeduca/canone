# 02 · METAMODELO

> A pergunta que o metamodelo responde: **como se adiciona um módulo novo
> sem escrever DDL?**

Resposta: inserindo linha. O esquema de conteúdo é dado.

## As sete tabelas que definem o metamodelo

```
editorial.content_type              o que é uma coisa ("questão", "aula", "norma")
editorial.content_type_version      a definição do tipo, versionada
editorial.field_definition           os campos de uma versão de tipo
editorial.enumeration                catálogo de valores (nível, fase, formato)
editorial.enumeration_value          os valores do catálogo
editorial.state_definition           os estados e as transições possíveis
editorial.state_transition           quais caminhos entre estados são permitidos
```

### `content_type` — a família carrega o workflow

```sql
content_type(key, label, family, requires_verification, is_relation_type)
```

A **família** é o que define o workflow:

| Família | Estados | Quem produz |
|---|---|---|
| `avaliacao` | rascunho → em_revisao → verificado → publicado | o editor, com verificação obrigatória |
| `estudo` | rascunho → em_revisao → publicado | o editor, sem verificação |
| `referencia` | rascunho → verificado → publicado | norma técnica |
| `editorial` | rascunho → publicado | blog |

### `field_definition` — os campos, com tipo

```sql
field_definition(content_type_version_id, key, label, data_kind,
                 required, ref_content_type_key, enumeration_key, validations)
```

`data_kind` ∈ texto, texto_longo, inteiro, decimal, booleano, data,
data_hora, enumeracao, referencia, json, slug.

`enumeration_key` tem **FK real** para `editorial.enumeration(key)`: um
campo que aponta para um catálogo inexistente é erro de digitação e o banco
recusa.

## As três tabelas de instância

```
editorial.content_item             a instância (o "questão 42")
editorial.content_item_version     a versão, com o PAYLOAD canônico
```

### O payload é a verdade

`content_item_version.payload` (jsonb) é o documento estruturado do
conteúdo: blocos tipados, ordem preservada. Tudo que é relacional é
**projeção** do payload, mantida por trigger.

```
content_item_version.payload          ← verdade
        │
        │  trigger editorial.sync_learning_projection
        ▼
learning.item                         ← projeção
learning.item_option                  ← projeção
learning.explanation                  ← projeção
```

**Por que isso importa:** dual-write manual é estruturalmente impossível de
manter. Se alguém escreve em `learning.item_option` direto, o estado real
e a projeção divergem, e ninguém sabe qual dos dois o app vai ler. Aqui só
existe um lugar onde se escreve.

O trigger também é onde a regra do edital é imposta: **um payload com duas
alternativas corretas é recusado na projeção**, no momento da escrita.

### `content_relation` — o grafo tipado

```sql
content_relation(relation_type, from_item_id, to_item_id, attributes)
```

Tipos: `cita_norma`, `cobre_assunto`, `explica`, `variante_de`,
`pre-requisito_de`, `derivado_de`, `revisao_de`.

E `editorial.content_norm_citation` — a aresta específica de citação de
norma, cujo alvo é um `norms.norm_item` (art. 4º, item 6, Anexo II), e não
um `content_item`. Ela guarda também o `norm_id`, para que "quando a norma X
ganhar versão nova" seja uma consulta direta.

> A separação existe porque `content_relation.to_item_id` referencia
> `content_item`. Uma citação de norma apontar para `norm_item` era
> impossível por FK — e o trigger que expira verificações quando a norma
> muda fazia exatamente essa junção. **O mecanismo nunca disparou.** Foi o
> teste de comportamento que achou (ver `tests/05-normas.test.mjs`).

## A verificação é entidade de primeira classe

```sql
editorial.verification(
  content_item_id, state, method, source_id, source_quote,
  verified_by, verified_at, valid_until, refusal_reason
)
```

Estados: `nao_verificada`, `em_revisao`, `verificada`, `expirada`,
`necessita_atualizacao`, `rejeitada`.

Três regras que o banco impõe:

1. **`source_quote` é obrigatório** quando o estado é `verificada`
   (constraint `ck_verification_quote`). Uma verificação sem o trecho da
   fonte é opinião com carimbo.
2. **`valid_until` existe** porque norma técnica expira. Sem essa coluna,
   uma verificação de 2019 continua parecendo atual.
3. **Publicar exige verificação vigente** — e a verificação é o que prova a
   transição para `verificado`, não o contrário.

## `state_transition` — o workflow é dado, não código

```sql
state_transition(family, from_state, to_state, requires, label)
```

O caminho feliz de `avaliacao` é:

```
rascunho → em_revisao → verificado → publicado
                              ↑           ↑
                    exige verificação   exige verificação vigente
```

O que **não** está na tabela é proibido: o trigger
`editorial.enforce_state_transition` recusa qualquer caminho fora dela.

Uma função que sabe os caminhos válidos só consegue mudá-la com DDL. Uma
tabela muda com um INSERT — e o gate pode conferir a tabela inteira.

## A fonte é parte do dado

```sql
editorial.source(key, kind, title, publisher, url, version_label,
                 published_at, content_sha256, source_quote, consulted_at)
```

`source_quote` guarda o **trecho literal** do documento que sustenta os
números derivados dele. É o que permite a um terceiro conferir sem
confiar em nós.

`kind` distingue `legislacao` (lei/decreto) de `norma` (norma técnica do
CFC) — confundir os dois é o que faz uma citação parecer certa e estar
errada.

## `editorial.content_revision` — histórico

Toda mudança de estado gera uma linha: `from_state`, `to_state`, `actor_id`,
`reason`. É written pelo trigger de transição, sempre.

## Como se adiciona um módulo novo

1. `INSERT INTO editorial.content_type (key, label, family) VALUES (...)`
2. `INSERT INTO editorial.content_type_version (...)` com a `definition`
3. `INSERT INTO editorial.field_definition (...)` para cada campo
4. Se precisar de estados novos: `INSERT INTO editorial.state_definition`
   e `INSERT INTO editorial.state_transition`
5. Se precisar de enumeração: `INSERT INTO editorial.enumeration` +
   `enumeration_value`
6. `INSERT INTO taxonomy.module (key, name, content_type_key, ...)`

**Nenhuma linha de DDL.** E o gate de integridade continua valendo sem
conhecer o módulo novo.

## O que a projeção NÃO faz (e por quê)

| Não projetado | Por quê |
|---|---|
| `learning.item_subject` | depende do vínculo com o assunto, que vem de `content_relation` — a aresta é mantida pelo editor, não pelo payload |
| `learning.explanation` | o texto do distrator é editorial; a projeção cobre só o que é estrutural |
| `editorial.content_norm_citation` | a citação aponta para uma versão de norma, que é um dado com vigência própria |

A regra: **projeta-se o que é estrutural e determinístico**. O que depende
de decisão editorial fica na tabela, escrito por mão — e auditado.
