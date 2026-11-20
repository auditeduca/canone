# ADR 0001 · Schemas por domínio, não por camada

**Status:** aceito · **Data:** 2026-10-24

## Contexto

O Ecossistema Cânone tem módulos de produto (flashcards, simulados, plano de
estudos) que atravessam várias entidades, e entidades (editorial, learning)
que participam de vários módulos. A primeira tentativa foi organizar por
camada: `core`, `modules`, `users`, `analytics`.

## Decisão

Nove schemas, por **domínio de dado**:
`identity`, `editorial`, `taxonomy`, `norms`, `learning`, `commerce`,
`admin`, `ops`, `audit`.

## Consequências

**Boas.** Um módulo novo não exige tocar schema nenhum: usa os que já
existem. Uma feature nova não cria "a pasta dela". A movimentação de dados
entre domínios é visível na fronteira (FK entre schemas). O schema `audit`
isolado impede que o admin edite o log por engano — a separação é
estrutural, não por convenção.

**Ruins.** O mesmo dado conceitual pode aparecer em dois domínios (ex.:
`taxonomy.subject.content_type_key` e `learning.item.content_type_key`).
Aceitamos: cada um tem propósito diferente, e as duas colunas têm FK
real, então a divergência é detectada no momento da escrita.

**Alternativas rejeitadas.** Por camada (o problema acima); schema único
(sem isolamento do audit); schema por módulo (multiplicaria schemas sem
ganho).
