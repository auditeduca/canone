# ADR 0002 · O payload é canônico; o relacional é projeção

**Status:** aceito · **Data:** 2026-10-24

## Contexto

Um item de avaliação precisa guardar: enunciado, alternativas, explicações,
vinculação com assunto, com norma, com módulo. A forma obviousemente
relacional seria `content_item` + `item_option` + `explanation` + … — e
aí nasce o problema do **dual-write**: duas representações do mesmo fato,
mantidas por código, que divergem.

## Decisão

`editorial.content_item_version.payload` (jsonb) é o documento estruturado
canônico. As tabelas relacionais são **projeção**, mantidas por trigger
(`editorial.sync_learning_projection`).

```
payload (verdade)  ──trigger──▶  learning.item, learning.item_option
```

## Consequências

**Boas.** Dual-write manual é estruturalmente impossível. A regra "exatamente
uma alternativa correta" é verificável no payload **e** na projeção,
porque a projeção *é* o payload projetado. O editor salva um documento;
o banco faz o relacional.

**Ruins.** Consultar conteúdo por campo é mais caro (jsonb). A migração de
um item antigo para o novo formato exige reprocessar a projeção. Payload
malformado só aparece no trigger, não na escrita.

**O bug que consolidou a decisão.** A primeira versão do trigger usava
`WITH ORDINALITY AS opt(n, n_ord)` — que liga o nome `opt` à *coluna* `n`,
não ao valor. `opt->>'ordinal'` sobre um bigint é erro de tipo, e **toda**
criação de item com alternativas caía. A migration aplicava sem erro.
Nenhuma revisão de código teria pego. O teste de comportamento pego.
