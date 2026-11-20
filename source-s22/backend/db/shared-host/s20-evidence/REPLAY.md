# S20 database replay — all data synthetic

This fixture reproduces a subset of the S20 PostgreSQL 18.6 experiment. The exact committed file has **not** been rerun against PostgreSQL; the observed execution used equivalent SQL in two commands (the first had an omitted owner schema grant, fixed in the second).

On an *isolated, disposable local PostgreSQL cluster only*, create database `canone_s20_disposable` and the markers as superuser before executing this fixture with `psql -X -v ON_ERROR_STOP=1`:

```sql
CREATE SCHEMA s20_sentinel;
CREATE TABLE s20_sentinel.disposable_marker(marker text PRIMARY KEY);
INSERT INTO s20_sentinel.disposable_marker VALUES('S20-ISOLATED-PG18');
CREATE SCHEMA foreign_sentinel;
CREATE TABLE foreign_sentinel.untouched(marker text NOT NULL);
INSERT INTO foreign_sentinel.untouched VALUES ('untouched');
```

Then run `S20_PG18_FIXTURE.sql` inside this new database. **Never** run any of this on a shared Supabase or production database. The fixture demonstrates RLS behavior, not the complete Cânone schema. For canonical migrations use the separate S13 guarded runner and PostgreSQL 17.
