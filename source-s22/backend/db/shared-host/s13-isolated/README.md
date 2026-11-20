# S13 — Homologação PostgreSQL **isolada**, não executada neste ambiente

Origem: S11 `716e01f`; S12 `b26cf09`, QA Vercel `9e0a0b9`. **Sem alterar** `backend/db/migrations/001..030`.

- `prepare.py --check`: audita hash das 30 migrations e 10 revisões candidatas. Não produz SQL executável.
- `run_disposable.sh`: funciona exclusivamente em Docker local com imagem `postgres:17` **previamente presente**; não faz pull, não expõe portas (`--network none`) e destrói o contêiner ao final, inclusive após erro. É um ensaio estrutural: aplica 002–017 como candidatos no banco `canone_s13_disposable`.
- `assertions.sql` e `assertions_two_users.sql`: gates de esquema, RLS+FORCE, privilégios anon/auth/service, ausência de auto-grant pelo staff, funções `SECURITY DEFINER` não pertencentes a SUPERUSER/BYPASSRLS e search_path.
- `test_s13_preflight.py`: testes locais de segurança do harness, sem conexão ao banco.

### Como rodar em ambiente isolado (Codespace ou computador com Docker)

```bash
python3 -m unittest discover -s backend/db/shared-host/s13-isolated -p 'test_s13_preflight.py' -v
bash backend/db/shared-host/s13-isolated/run_disposable.sh
```

O resultado pode falhar cedo em SQL, em permissões ou em dependências 018–030. **Uma falha é evidência legítima de bloqueio, não deve ser ignorada.** `NO-GO` permanece independentemente do resultado da fase estrutural: faltam ainda testes de RLS A/B completos, sessões autenticadas, concorrência, restore, jurídico/editorial e owner DBA.

**Nunca executar scripts de revisão no Supabase compartilhado.** O runner não aceita URLs externas. A geração de scripts SQL temporários existe estritamente para ensaios locais.

Os testes adicionais usam duas contas exclusivamente sintéticas A/B e verificam visibilidade/atualização cruzada. Se a estrutura chegar ao fim, o runner ainda ensaia `pg_dump`/`pg_restore` em outro banco descartável. Nenhum teste é executado se a imagem/engine Docker não estiver disponível.
