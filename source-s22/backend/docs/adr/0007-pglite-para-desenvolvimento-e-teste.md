# ADR 0007 · PGlite para desenvolvimento e teste

**Status:** aceito · **Data:** 2026-10-24

## Contexto

O projeto precisa de um Postgres para rodar as migrations e provar as
regras. O ambiente não tem Docker nem servidor Postgres. E as regras que
importam — RLS, CHECK, trigger, índice parcial, `SECURITY DEFINER` — não
têm equivalente confiável em SQLite.

## Decisão

Usar **PGlite** (`@electric-sql/pglite` 0.2.17) — PostgreSQL 16.4
compilado para WebAssembly. As mesmas migrations rodam nele e em
produção; o `Db` é uma interface com dois adaptadores (PGlite e
node-postgres).

## Consequências

**Boas.** A suíte roda sem infraestrutura: `npm test` sobe um banco
inteiro, aplica 17 migrations e executa 82 provas de recusa. **Não há
mock** — o que importa é justamente que o teste问我 o banco de verdade.
Nenhuma divergência entre "o que o teste provou" e "o que roda em
produção", porque é o mesmo engine.

**Ruins.** Uma conexão só (a serialização é explícita). `CREATE ROLE`/
`GRANT` funcionam, mas o superusuário ignora RLS — os testes de área
precisam de `SET ROLE` para exercitar a policy. Mais lento que um
Postgres nativo para aplicar 17 migrations do zero.

**Por que não SQLite.** SQLite não tem RLS, nem `SECURITY DEFINER`, nem
índice parcial com predicado, nem `citext`. A decisão seria trocar o
banco testado pelo banco que não é o de produção — e as 82 provas ficariam
sem sentido.

**Lição de instrumentação.** O PGlite expõe `db.exec()` para múltiplos
statements e `db.query()` para parâmetros. Usar `exec` com `$1` produz
`there is no parameter $1`; e o `exec` do PGlite embaralha blocos
`$$ ... $$`, passando parte do corpo da função como parâmetro. O runner
faz o **split** dos statements ele mesmo, respeitando `$$`, strings e
comentários.
