# ADR 0006 · Auditoria append-only com encadeamento de hash

**Status:** aceito · **Data:** 2026-10-24

## Contexto

"Registre tudo" é fácil de dizer. Um log que alguém possa reescrever sem
deixar rastro não é auditoria, é decoração.

## Decisão

`audit.audit_log` é append-only (`audit.forbid_mutation` recusa UPDATE e
DELETE) e **encadeado**: cada linha guarda `prev_hash` (o `row_hash` da
linha anterior) e o próprio `row_hash`.

`audit.verify_chain(p_from)` devolve as linhas quebradas.

Duas decisões de detalhe que importam:

- o hash usa **epoch** do timestamp, não `timestamptz::text` — texto
  depende do `TimeZone` da sessão, e o mesmo dado geraria hash diferente
  conforme quem verificava;
- o verificador **recalcula** o hash de cada linha a partir do conteúdo,
  em vez de só conferir o ligamento.

## Consequências

**Boas.** A adulteração é detectada e *localizada*. O `seq` é monotônico
(`bigserial`), então requisições simultâneas não colidem na ordem. O
schema `audit` é isolado, e o admin não tem `UPDATE`/`DELETE` nem
privilégio.

**Ruins.** A cadeia não sobrevive a uma restauração parcial do banco sem
re-verificação. O custo de escrever é um SHA-256 por linha — irrelevante
ao volume esperado.

**Os dois bugs que debilitaram a garantia.** A primeira versão do
verificador só comparava `prev_hash` com o `row_hash` anterior: quem
reescrevesse o conteúdo **sem recalcular o hash** deixava a cadeia
"íntegra" — a prova não era conferida. E a versão com `p_from` calculava
o `lag()` sobre o recorte, então a primeira linha do recorte acusava
cadeia quebrada: **o verificador mentia** em toda verificação parcial.
