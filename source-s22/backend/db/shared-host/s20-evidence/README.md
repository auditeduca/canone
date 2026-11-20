# S20: evidence of RLS semantics (NOT full migration homologation)

The real disposable PostgreSQL 18.6 test was executed within an isolated, no-production Vercel Sandbox. The `canone_s20_disposable` database contained two synthetic users and exactly one fixture table under `canone_identity`; the original Cânone 001–030 migrations were **not** executed.

Observed as role `canone_subscriber`:
- With `app.current_user_id=A`, a SELECT returned A alone; an UPDATE targeting B affected 0 rows.
- With `app.current_user_id=B`, a SELECT returned B alone.
- The same role could invoke `set_config('app.current_user_id', B, true)` and then read B in the same transaction. This is a trust-boundary finding for *any* RLS model driven only by a mutable custom GUC, **not** proof of exploitability via Cânone's HTTP API. It requires direct SQL or an equivalent injection path.
- `FORCE ROW LEVEL SECURITY` denied access to a non-superuser table owner with no matching policy.
- The `foreign_sentinel` row outside the tested namespace was untouched.

Original PostgreSQL 17 behavior and full canonical migration applicability remain NO-GO until isolated testing with the exact revised migrations, role grants, the authenticated HTTP backend, concurrent transactions, restore and teardown. PG18 testing does not replace PG17.

PostgreSQL documentation: https://www.postgresql.org/docs/17/ddl-rowsecurity.html and https://www.postgresql.org/docs/current/sql-set.html.
