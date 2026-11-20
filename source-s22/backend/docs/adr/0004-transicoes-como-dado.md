# ADR 0004 · Transições de estado são dado, não código

**Status:** aceito · **Data:** 2026-10-24

## Contexto

O conteúdo editorial tem um workflow: rascunho → em revisão → verificado →
publicado. Uma regra de transição implementada em trigger só muda com DDL,
e o gate de integridade não consegue conferi-la.

## Decisão

`editorial.state_transition(family, from_state, to_state, requires, label)`
é uma **tabela**. O que não está nela é proibido, e o trigger
`editorial.enforce_state_transition` recusa.

A coluna `requires` permite condicionar: `requires='verificacao_vigente'`
só passa se houver verificação de fonte em dia.

## Consequências

**Boas.** Mudar o workflow é `INSERT`/`UPDATE` em dado. O gate pode ler a
tabela inteira e conferir a cobertura. O caminho feliz da família
`avaliacao` fica visível numa consulta.

**Ruins.** Uma transição precisa ser cadastrada antes de ser usada — e
falta é um erro de runtime, não de deploy. Mitigação: a família `avaliacao`
é semeada com o caminho completo, e o gate confere.

**O bug que consolidou a decisão.** A função se chamava
`enforce_state_transition` e **não exigia transição nenhuma** — só
validava que o estado destino existia. O nome prometia uma coisa que o
código não fazia. Pior: o `JOIN` que buscava a família usava
`ctv.id = ct.id`, chaves de tabelas diferentes, então nem filtrava.
