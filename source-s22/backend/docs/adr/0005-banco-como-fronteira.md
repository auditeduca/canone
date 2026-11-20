# ADR 0005 · O banco é a fronteira

**Status:** aceito · **Data:** 2026-10-24

## Contexto

Autorização em aplicação tem um problema estrutural: qualquer caminho que
não passe pelo código de autorização vaza. E "qualquer caminho" inclui
importadores, jobs, scripts de admin, `psql`, um segundo backend, uma
conta de suporte com acesso direto.

## Decisão

Três camadas independentes, todas no banco:

1. **PRIVILÉGIO** (`017_privileges.sql`) — o papel pode sequer tocar na
   tabela?
2. **RLS** (`014_rls.sql`) — o papel pode ver esta linha?
3. **VIEW** (`013_views.sql`) — o papel enxerga através de qual contrato?

O backend conecta como `canone_app` (papel técnico, `NOINHERIT`) e troca
para o papel da área por requisição, dentro de uma transação, com
`SET LOCAL`.

## Consequências

**Boas.** A visão de usuário do staff deixa de ser um `if` no código e
vira uma concessão auditada no banco. Um bug de autorização vira um erro
de teste, não um vazamento. O gabarito fica bloqueado nas duas camadas
(sem privilégio **e** sem policy).

**Ruins.** Mais ceremony: transação, troca de papel, GUCs. Consultas
precisam de privilégio explícito, senão "permission denied" em vez de
"zero linhas" — e isso diferencia depuração. Views exigem `GRANT` próprio.

**A armadilha do bypass.** `canone_app` é `NOINHERIT` de propósito: se
herdasse as permissões dos papéis de área, o backend leria tudo com o
próprio papel e o RLS não valeria nada. O papel técnico só pode
*trocar*, nunca *ser*.

**O que o schema garante e a aplicação não.** Nenhum repositório aceita
`userId` como argumento — a identidade vem do contexto, porque se viesse
do argumento bastaria o chamador passar o id de outra pessoa.
