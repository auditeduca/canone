# Cânone — piloto SQL de identidade e proveniência para Supabase

**Versão:** `0.23.0-alpha.3` · **Destino:** projeto Supabase **exclusivo do Cânone** (ainda não criado) · **Estado:** candidato de staging, **NÃO aplicado em projeto remoto**.

## Entrega real

Em vez de limitar o crosswalk a um inventário, o piloto materializa um primeiro **recorte SQL operacional** baseado nas migrations S22 `001` e `002`, sem modificá-las. Os arquivos `staging/supabase/*.candidate.sql.txt` são **candidatos de avaliação**, e não migrations aptas a execução automática. Mantemos os 30 originais e seus checksums.

A proposta cria sete tabelas em dois schemas privados:

| Schema | Tabelas | Regra |
| --- | --- | --- |
| `canone_identity` | `user_profile` | Perfil não sensível; RLS com três políticas do próprio usuário, por `auth.uid()` |
| `canone_identity` | `private_profile` | Dados potencialmente sensíveis; sem acesso direto do navegador |
| `canone_identity` | `role`, `user_role` | Papéis e concessões protegidos; sem autoatribuição de administrador |
| `canone_identity` | `consent_purpose`, `consent` | Evidência de consentimento; escrita administrativa deliberadamente não exposta |
| `canone_bridge` | `source_binding` | Referência externa por ID, versão, hash e direitos; sem cópia do corpus compartilhado |

Os três componentes de credenciais S22 (`identity.account`, `identity.session` e `identity.magic_link`) **não** são recriados: Supabase Auth mantém usuários, sessões e tokens de login. Cada FK de perfil e papel aponta para `auth.users(id)` — não para uma segunda tabela de credenciais. Esta é a implementação **do subconjunto de identidade**, não a adaptação completa das 43 FKs do sistema. As demais FKs seguem catalogadas em `crosswalk/supabase/CANONE_PLATFORM_CROSSWALK_0_23_0_ALPHA2.json`.

A DDL executa em transação, verifica presença de `auth.users` e recusa por segurança um projeto que já tenha `canone_control.migration_catalog` — característica do Supabase compartilhado de origem. Essa verificação **não substitui a confirmação operacional do ID do projeto de destino**. Não cria roles nem extensões globais, não altera `public`/`auth`/`storage`, e não gera seeds, dados de exames, conteúdo protegido ou credenciais.

## Testes e evidência

- `python3 tools/verify_supabase_stage_pilot.py --root . --check`: confirma SHA-256 dos 30 SQL originais, SHA do candidato, 7 tabelas, RLS+FORCE para todas, três policies com autenticação, ausência de grants administrativos ao cliente e integridade do manifesto.
- `python3 -m unittest discover -s tests -p 'test_supabase_stage_pilot.py' -v`: 11 testes, incluindo mutação adversarial de RLS.
- `node tests/supabase_stage_pilot_pglite.mjs`: em **PGlite descartável** com fixture sintética de `auth.users` e `auth.uid()`, aplica apenas o candidato no banco em memória, confere FKs/RLS/roles e tenta ler/escrever dados cruzados. **Não é PG17 gerenciado nem uma homologação Supabase**. Dependências de teste vêm de `source-s22/backend/node_modules` após `npm ci` no CI; nenhuma chave ou serviço externo é utilizado.

Os testes não cobrem ainda exclusão com política de retenção, fluxo de staff, cadastro via Auth real, cronologia de consentimentos, payloads de provas, MFA, grants entre tenants em SQL remoto ou execução das 30 migrations originais. Todos exigem a próxima etapa.

## Caminho de implantação — sem bloqueio genérico à engenharia

1. Manter o SQL de candidato inalterado até a execução de testes de PostgreSQL 17 com `auth.users` **simulado** e checagem de `anon`/`authenticated` sob diferentes JWTs.
2. Em projeto Supabase **novo, exclusivo e revisado**, converter o recorte aprovado em migration oficial usando a CLI correspondente (`supabase migration new` após conferir `--help` da versão instalada), sem tocar o banco compartilhado.
3. Testar RLS real com dois usuários sintéticos, claims não editáveis pelo cliente, RPCs de staff e privilégios mínimos. Configurar corretamente os schemas expostos na Data API, se aplicável.
4. Avançar domínio por domínio: editorial, aprendizagem, questões/provas, SRS, consentimento integral, revisão normativa e segurança dos gabaritos. Manter o catálogo de 30 migrations e FKs como trilha de reconciliação.
5. Registrar migrações, backup, rollback, evidências normativas e aceite antes de ativar endpoints e produção.

## Governança

**Somente `main`, sem branches novas.** Versionar mudanças de contrato em `VERSION`/`CHANGELOG.md`. O candidato não executa automaticamente por CI; o workflow apenas valida em ambiente efêmero. **NO-GO continua sendo um gate de produção e não impede novas correções técnicas.**

Fontes oficiais de orientação técnica:
- [Supabase — User management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Data API security](https://supabase.com/docs/guides/api/securing-your-api)
