# ADR 0010 — Portabilidade SQL revisável no Supabase compartilhado (S11)

**Decisão:** preservar `backend/db/migrations/001…030` como autoridade única. O gerador
`backend/db/shared-host/s11-review-all.mjs` gera 30 artefatos de revisão, NUNCA scripts
de deploy, todos com hashes de fonte e saída e estado `HOLD_HUMAN_NO_GO`.

## Limite de segurança

- O schema `public` global **não** é a área pública do Cânone; esta usa `canone_public`.
- A migration 001 possui extensões, criação de papéis e funções que precisam ser projetadas
  por DBA; não foi transposta para produção.
- As migrations 002–005 podem passar por **QA estrutural exclusivamente em PGlite descartável**,
  com `citext` habilitado nesse ambiente, sem qualquer acesso ao Supabase real.
- Nomes qualificados são reescritos pelo lexer existente de S7, que não reescreve strings,
  comentários ou corpos `$$`. Isso exige revisão semântica específica de PL/pgSQL,
  funções `SECURITY DEFINER`, grants, owners, search_path, RLS e SQL dinâmico.
- Nunca usar o QA PGlite para promover `migration_catalog.status` no Supabase. O catálogo
  remoto permanece com todas as 30 em `NOT_APPLIED`.
- Não habilitar API, login, assinatura, cobrança ou correção com dados reais antes de RLS
  e entitlement auditados no PostgreSQL da implantação.

## Critérios para homologação futura

1. Reconstruir bootstrap de papéis, funções e extensões sem alterar objetos de outros sistemas.
2. Adaptar e executar 001–030 integralmente em banco PostgreSQL real descartável.
3. Confirmar ownership e `SECURITY DEFINER` não pertencentes a superusuário/BYPASSRLS.
4. Adicionar e provar RLS por usuário, grant por área e revogação de sessão.
5. Fazer diff de todos os objetos fora de `canone_*`; zero mudanças permitidas.
6. Realizar backup/rollback testado, aprovação humana e auditoria normativa antes de promoção.

**Resultado S11:** revisão de 30/30, QA PGlite 002–005 apenas, sem RLS operacional,
sem mudança no banco compartilhado, produção `NO-GO`.
