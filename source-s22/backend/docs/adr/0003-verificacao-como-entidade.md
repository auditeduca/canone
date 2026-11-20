# ADR 0003 · A verificação é entidade de primeira classe

**Status:** aceito · **Data:** 2026-10-24

## Contexto

O Cânone promete integridade editorial: nada é publicado sem estar
verificado contra a fonte. A pergunta é onde essa promessa mora.

A resposta óbvia — um boolean `is_verified` em `content_item` — é exatamente
o que não serve: não diz **quem** verificou, **contra o quê**, **quando**,
**por quanto tempo vale**, nem **por que foi recusada**.

## Decisão

`editorial.verification` é uma entidade, com:

- `state` (`nao_verificada`, `em_revisao`, `verificada`, `expirada`,
  `necessita_atualizacao`, `rejeitada`)
- `method` (`manual`, `automatizada`, `importacao`, `conferencia_dupla`)
- `source_id` — a fonte
- `source_quote` — **obrigatório** quando `state='verificada'`
- `valid_until` — norma técnica expira
- `refusal_reason` — a recusa é conteúdo do produto

E a publicação é bloqueada por trigger, não por aplicação.

## Consequências

**Boas.** A página pública de integridade sai do banco
(`admin.v_refused_claims`). "A norma mudou" tem efeito mecânico: nova
`norm_version` expira as verificações que a citam e abre a moderação. O
`source_quote` permite a um terceiro auditar sem refazer o trabalho. A
recusa não é um erro: é um registro.

**Ruins.** Verificação é um segundo objeto para o editor manter, ao lado
do conteúdo. A expiração exige um processo de renovação.

**A armadilha evitada.** A trigger que busca a verificação fazia
`SELECT ... WHERE content_item_id = $1` **sem `ORDER BY`**, com
`IN (...)` sobre vários estados. Com mais de uma verificação, o banco
pegava uma linha arbitrária. Agora a regra é "existe ao menos uma
verificação verificada e vigente", e a mensagem de erro mostra a decisão
mais recente. Determinismo não é detalhe em uma regra de publicação.
