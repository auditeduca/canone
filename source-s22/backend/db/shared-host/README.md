# Cânone no Supabase compartilhado — provisório

- **Projeto alvo somente:** `pgsybzggewhinaniybiy` (`Calculadoras-Smart`).
- Migração S5 aplicada de fato: `canone_shared_host_namespace_v1`.
- Reserve os 14 schemas `canone_*` (domínios originais e suporte) e use `canone_control` para registro de checksum, gates e fontes externas.
- NÃO aplique `backend/db/migrations/001-030` como estão: foram desenhadas para um Postgres exclusivo e usam `public` e nomes genéricos.
- Sem `GRANT` nem permissões para `anon`, `authenticated`, `service_role` nos novos schemas; sem criação de claims normativos, contas ou pagamentos.
- A verificação de migração é somente leitura em `VERIFICACAO_S5_READONLY.sql`.
- Detalhes e pendências em `docs/pmo/MARCO_S5_SUPABASE_COMPARTILHADO_2026-11-14.md`.
- Futuro: portar schemas/roles/triggers para este namespace, testar transação e configurar um backend autenticado com menor privilégio.
