# S7 · Portabilidade SQL sem concorrência nem autopromoção

## Fonte de verdade

- DDL original e imutável: `backend/db/migrations/001_...030_*.sql`.
- Mapa físico já implantado em S5: `S5_NAMESPACE_MANIFEST.json`, schemas `canone_*`.
- Gerador único de projeção: `backend/db/shared-host/port-sql.mjs`.
- Candidatos: `generated/REVIEW_ONLY_002_...007_*.sql` e `generated/port-review.generated.json`.

**Os candidatos NÃO são migrations executáveis.** Seu nome `REVIEW_ONLY_` e cabeçalho `DO NOT EXECUTE` explicitam o bloqueio, e não estão sob `backend/db/migrations/` nem devem entrar em qualquer runner.

## Segurança

- O lexer separa identificadores SQL de textos literais, comentários (inclusive aninhados), identificadores entre aspas e corpos `$$`.
- Só reescreve qualificadores de schema em trechos de código. Não faz busca/substituição cega de textos legais, comentários ou justificativas.
- Reconhece extensões `citext`, papéis, `SECURITY DEFINER`, `CREATE FUNCTION`, corpos dollar, GRANT/REVOKE, SQL dinâmico, DDL global e nomes `public` que requerem revisão.
- A dependência da migração 001 fica explicitamente bloqueada em todas as seis saídas.
- As seis saídas têm `executeAllowed: false`, `HOLD_PORT_REVIEW`; nenhum comando aplica SQL ao Supabase.
- `generate` não modifica `S5_NAMESPACE_MANIFEST.json` nem `S5_LIVE_VERIFICATION.json`.

## Execução

```bash
node backend/db/shared-host/port-sql.mjs --check
node backend/db/shared-host/port-sql.mjs --write
node --test backend/db/shared-host/tests/*.test.mjs
```

## Próximo gate de homologação

Resolver papel/owner, `citext`, `search_path`, funções privilegiadas e dependências; montar migration de teste transacional em PostgreSQL isolado; executar RLS adversarial; apenas depois considerar migração operacional em `canone_*` do compartilhado com revisão humana. Não modificar `public`, `contabilidade_cfc`, `ce_platform` ou Enfermagem.
