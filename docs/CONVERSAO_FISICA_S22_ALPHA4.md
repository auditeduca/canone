# Conversão do banco Cânone S22 → Supabase — v0.23.0-alpha.4

**Projeto:** Cânone CFC · **branch única:** `main` · **estado:** SQL físico gerado, ainda em teste isolado · **produção:** `NO_GO`.

## Objetivo e entrega

A ferramenta `tools/convert_canone_schema.py` transforma automaticamente o DDL físico das 30 migrations S22 **sem executar SQL nem se conectar ao banco de origem**. Verifica os 30 hashes SHA-256 de autoridade, lê o crosswalk S22/Supabase e gera dois arquivos determinísticos: `staging/supabase/002_domain_tables_82.candidate.sql.txt` e `staging/supabase/CANONE_DOMAIN_TABLES_CONVERSION_MANIFEST.json`.

| Destino de cada uma das 90 tabelas de origem | Quantidade | Técnica |
|---|---:|---|
| Tabelas de domínio S22 convertidas nesta etapa | **82** | `CREATE TABLE`, PK, UNIQUE, CHECK e FK **inline** remapeados para `canone_*` |
| Tabelas já recriadas no piloto de identidade v0.23.0-alpha.3 | **5** | Reaproveita `user_profile`, `role`, `user_role`, `consent_purpose`, `consent` |
| Tabelas de login que passam ao Supabase Auth | **3** | `identity.account`, `identity.session` e `identity.magic_link` deixam de ser tabelas da aplicação |
| **Total de origem reconciliado** | **90/90** | Nenhuma tabela original desapareceu do inventário |

O piloto de identidade também adiciona duas tabelas novas (`private_profile`, `source_binding`), sem equivalente físico 1:1 no S22. **Assim o estágio esperado possui 89 tabelas próprias (82 + 7), não 87.** O número 87 continua sendo a quantidade de tabelas de domínio S22 (82 geradas + 5 recuperadas pelo piloto).

## Transformação concreta

1. Projeta cada referência qualificada `identity.*`, `learning.*`, etc. no respectivo schema `canone_*` definido no manifesto. O parser separa sentenças em Python, respeitando strings, comentários e corpos `$tag$ ... $tag$` — não faz substituição global em texto normativo.
2. Converte também **3 tipos ENUM** usados pelo modelo de aprendizagem (`review_grade`, `review_basis` e `session_kind`), criando-os antes das tabelas que os referenciam.
3. Transforma as FKs inline `REFERENCES identity.account(id)` em `REFERENCES auth.users(id)`, preservando tipo UUID e cascatas do S22. Foram identificadas **38 referências a Auth dentro das 82 tabelas geradas**; as restantes do total de 43 do inventário S22 encontram-se em tabelas substituídas pelo piloto gerenciado.
4. Não reintroduz armazenamento de senha, token de login ou sessão de autenticação.
5. Cria namespaces Cânone próprios e inclui verificações contra execução no Supabase compartilhado (`canone_control.migration_catalog`) e pré-requisitos `auth.users`/piloto.
6. Aplica **RLS habilitada e forçada** e revoga `PUBLIC`, `anon` e `authenticated` para as 82 tabelas. **Não cria políticas, grants, funções de privilégio ou interfaces públicas.** Esta estratégia é deliberadamente *deny by default* para prevenir exposição de gabaritos e dados de alunos.

## Verificação e reprodutibilidade

```bash
python3 tools/convert_canone_schema.py --root . --check
python3 -m unittest discover -s tests -p 'test_canone_domain_conversion.py' -v
node tests/canone_domain_tables_pglite.mjs
```

A terceira linha usa o pacote `@electric-sql/pglite` **instalado nas dependências do backend**, roda somente em memória, com `auth.users` e `auth.uid()` sintéticos. Não utiliza conexão externa. A validação CI verifica a contagem de tabelas, RLS+FORCE, FKs gerenciadas, negação de leitura de gabarito e de escrita em domínio alheio. **Os testes não tornam o SQL automaticamente implantável.**

Para recalcular após futuras mudanças no S22 ou crosswalk: executar `--write` em ambiente de desenvolvimento e versionar o diff, o novo manifesto e os testes. Qualquer mudança nos hashes S22 causa falha antes da geração. Não utilizar `--write` no workflow CI.

## Trabalho ainda necessário para concluir o banco (sem bloquear esta conversão)

O extrator gera **somente `CREATE TABLE`**. Cerca de **454 instruções não `CREATE TABLE`** foram catalogadas por migration (heurística que inclui DDL, comentários, funções, grants, seeds, triggers e índices; **não é contagem de requisitos pendentes únicos**). Converter nas próximas etapas:

- **ALTER TABLE / FKs tardias / índices:** preservar dependências e desempenho, gerar diffs estruturais e ensaiar PG17.
- **Views:** converter com `security_invoker=true`, sem vazar chave/gabarito. Nenhuma view publicada até auditoria.
- **Funções e triggers PL/pgSQL:** portar todas as referências de schema também dentro de corpos procedurais, remover `ops.current_user_id()` controlada pelo cliente, fixar `search_path` e controlar `SECURITY DEFINER`.
- **RLS/roles:** políticas específicas por operação/usuário, `USING` e `WITH CHECK` para updates, `auth.uid()` e RBAC no servidor. Política `TO authenticated USING (true)` é insuficiente para dados pessoais.
- **Seeds e documentos:** copiar apenas metadados e conteúdos com direito/proveniência comprovados; nunca copiar indiscriminadamente corpus de enfermagem, dados pessoais, provas nem gabaritos.
- **Homologação:** repetir scripts em PostgreSQL 17 descartável, comparar chaves/constraints, realizar restore, executar duas identidades reais com JWT e revisar alertas de segurança antes de qualquer staging remoto.

## Separação de ambientes e operação

Não cria nem altera projeto Supabase, Vercel, `public`, `auth` ou `storage` de outro serviço. O projeto Supabase **independente do Cânone ainda não está confirmado**. A ferramenta gera um `.candidate.sql.txt` propositalmente não aceito por runners de migrations automáticos. O desenvolvedor continua a conversão na `main` sem depender de permissão de deploy, enquanto o gate operacional permanece `NO_GO`.

Fontes técnicas: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) e [Supabase Data API — Securing](https://supabase.com/docs/guides/api/securing-your-api).
