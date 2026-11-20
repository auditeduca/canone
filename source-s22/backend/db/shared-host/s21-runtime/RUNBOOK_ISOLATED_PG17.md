# S21 — PostgreSQL 17 reproduzível (SOMENTE DESCARTÁVEL)

**Não execute em Supabase, produção, banco compartilhado ou qualquer banco sem
sentinela local.** A aplicação real fica em `NO-GO`.

A origem do PostgreSQL 17.12 foi o repositório oficial PGDG para Ubuntu resolute
(https://wiki.postgresql.org/wiki/Apt). A imagem de Vercel Sandbox universal,
isolada, foi limitada a acesso aos domínios Ubuntu e PGDG apenas para instalação.
Não expor portas de PostgreSQL nem reutilizar credenciais do Supabase.

1. Preparar migrations candidatas (checa 30 originais e 10 revisões):

   ```bash
   python3 backend/db/shared-host/s13-isolated/prepare.py --check
   mkdir -p /tmp/canone-s21-stage
   python3 backend/db/shared-host/s13-isolated/prepare.py --stage-disposable /tmp/canone-s21-stage
   ```

2. Em cluster *descartável* PostgreSQL 17: criar DB exato
   `canone_s13_disposable`, criar schema `s13_sentinel`, tabela
   `disposable_marker` e linha `s13-verified`, mais `foreign_sentinel.untouched`.
   Aplique **somente** SQL staged 001 bootstrap, 002–017 em ordem com
   `psql -X -v ON_ERROR_STOP=1`. Cada script contém guarda de banco exato e
   sentinela. Guardar STDOUT, STDERR, hash do pacote, versão e exit codes.

3. Executar `assertions.sql` e `assertions_two_users.sql`. **Não retirar
   asserções que falharem.** No primeiro ensaio S21, a primeira falhou em
   proprietário de 2 funções privilegiadas, e A/B falhou por falta de
   `USAGE canone_identity`.

4. Para isolar só o bloqueio de schema-USAGE, aplicar no **mesmo banco de teste**
   a concessão de USAGE a canone_subscriber, limpar **apenas** usuários
   sintéticos A/B e repetir `assertions_two_users.sql`. S21 observou PASS.
   **Não autoriza aplicação da concessão em banco operacional.**

5. Exercitar `pg_dump -Fc` e `pg_restore -e` em um segundo DB **do mesmo
   cluster isolado**. Validar 14 schemas canônicos, 83 tabelas e A/B.

6. Executar `audit_contracts.py --strict` localmente: o exit-code **41**
   é esperado enquanto houver incompatibilidades de papel, namespace e GRANT.
   Este é um gate complementar e não substitui o teste real de API.

7. Antes de GO: rever o owner (não superusuário/BYPASSRLS) de SECURITY
   DEFINER, funções/GRANT/RLS/contratos, porta de autenticação, arquivo
   018–030, concorrência, retenção de gabaritos, segurança de API e UAT.
