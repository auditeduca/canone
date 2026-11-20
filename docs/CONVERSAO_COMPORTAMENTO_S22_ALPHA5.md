# Cânone — camada de comportamento S22 → Supabase (v0.23.0-alpha.5)

**Situação:** engenharia de staging, SQL candidato não implantável. **Base exclusiva Supabase ainda não provisionada.** Nenhum SQL rodou no Supabase compartilhado, nenhum deploy na Vercel e nenhuma branch criada.

## Alcance e origem

O gerador `tools/convert_canone_behaviour.py`, somente com bibliotecas Python padrão, valida SHA-256 das 30 migrations S22 e das saídas 002/003 da conversão física, extrai instruções SQL respeitando comentários e blocos `$$`, e produz versões determinísticas dos artefatos de revisão:

| Família | Instruções `CREATE` históricas | Adaptadas nesta rodada | Tratamento restante |
|---|---:|---:|---|
| Views | 18 | 16 com `security_invoker=true` | 2 pendentes de substituição da API de identidade e da função `due_items` |
| Funções | 58 | 1 substituição segura `canone_ops.current_user_id()` → `auth.uid()` | 57 instruções de função aguardam auditoria das chamadas e semântica |
| Triggers | 26 | 0 | 26, incluindo `CONSTRAINT TRIGGER`, exigem revisão individual de funções e ordem de execução |
| Políticas RLS | 80 | 18 políticas de menor privilégio sobre 12 tabelas próprias | 67 instruções históricas sem conversão automática (as 13 selecionadas geram 18 políticas por operação) |

> Esses são **contadores de instruções SQL históricas**, não necessariamente objetos únicos no estado final do banco. Uma função pode ser redefinida e um trigger removido em migrations posteriores. O inventário preserva arquivo, linha, nome e hash de cada instrução.

## Estratégia de segurança

1. **Views** são criadas em `canone_public`, `canone_subscriber` e `canone_admin` com `WITH (security_invoker = true)`, não pertencem a um papel que ignore RLS e **não recebem `GRANT SELECT` automaticamente**. Uma view que depende de tabela com gabarito continua inacessível ao navegador; essa é uma condição de segurança, não falha do conversor. As views `subscriber.v_my_due` e `admin.v_user_overview` não são emitidas, porque dependem respectivamente da função de agendamento ainda não portada e da tabela legada `identity.account` removida.
2. **Autorização de aluno:** apenas 12 tabelas com `user_id` têm SELECT autenticado, sempre `user_id = (select auth.uid())`. Escrita direta: notas (INSERT/UPDATE/DELETE), favoritos (INSERT/DELETE) e solicitações LGPD (INSERT), com política própria, nunca herança automática de `FOR ALL`.
3. **Operações sensíveis** (resultado de prova, revisão SRS, assinatura, pagamento, gabaritos, administração e autenticação) não recebem `INSERT/UPDATE/DELETE` para o navegador. Permanecem reservadas à API de domínio autorizada e auditada.
4. **Função de identidade** substitui `ops.current_user_id` por `canone_ops.current_user_id()` com `SECURITY INVOKER` e `SELECT auth.uid()`; nenhum uso de `app.current_user_id` ou `app.current_area` determina identidade ou privilégio.
5. **Sem copiar funções privilegiadas**: `SECURITY DEFINER`, SQL dinâmico, `SET ROLE`, triggers de nota/gabarito e papéis administrativos históricos ficam no inventário de revisão. O código nunca converte automaticamente um `canone_staff` para `authenticated`.

## Arquivos

- [`004_invoker_views.candidate.sql.txt`](../staging/supabase/004_invoker_views.candidate.sql.txt) — 16 views, **sem grants**;
- [`005_owner_policies.candidate.sql.txt`](../staging/supabase/005_owner_policies.candidate.sql.txt) — 18 políticas de propriedade e seus grants estritos;
- [`006_auth_user_id_compat.candidate.sql.txt`](../staging/supabase/006_auth_user_id_compat.candidate.sql.txt) — função de compatibilidade sem GUC legada;
- [`CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json`](../staging/supabase/CANONE_BEHAVIOUR_INVENTORY_MANIFEST.json) — 182 instruções de origem, hashes, status e mapeamento 1:1;
- [`convert_canone_behaviour.py`](../tools/convert_canone_behaviour.py) — regeneração e verificação;
- [`test_canone_behaviour_conversion.py`](../tests/test_canone_behaviour_conversion.py) — testes estáticos e de regressão;
- [`canone_behavior_pglite.mjs`](../tests/canone_behavior_pglite.mjs) — simulação PostgreSQL em memória com usuários A/B.

## Comandos

Na raiz do repositório, depois da preparação das dependências Node já prevista no CI:

```bash
python3 tools/convert_canone_schema.py --root . --check
python3 tools/convert_canone_constraints.py --root . --check
python3 tools/convert_canone_behaviour.py --root . --check
python3 -m unittest discover -s tests -p 'test_canone_behaviour_conversion.py' -v
node tests/canone_behavior_pglite.mjs
```

A execução JavaScript cria Auth sintético e aplica **apenas 001 → 006** a PGlite descartável; confirma que A consegue criar e ler a própria nota e B não consegue ler, alterar ou apagar a nota de A. Verifica também se não houve grant indevido em views de gabarito. **Não substitui PostgreSQL 17 gerenciado, JWT real ou teste E2E do produto.**

## Critérios para próximas conversões

- Mapear funções com dependências de tabela/FK, `SECURITY DEFINER`, `search_path`, revogação de `EXECUTE` de `PUBLIC`, permissões e semântica de Auth. Não promover um nome de função sem validar seu comportamento e invocação por perfis reais.
- Criar uma matriz de triggers de integridade com dependências explícitas e testes de casos adversariais (imutabilidade do gabarito, concorrência na prova, fechamento de tentativa, auditoria append-only).
- Separar políticas públicas de leitura apenas para acervo comprovadamente publicável; não permitir `true` genérico em tabelas que exponham conteúdo sem direitos.
- Executar 001–006 em PostgreSQL 17 isolado **com extensões e funções reais Supabase**, depois em Supabase individual de staging com approvals de RLS e revogação de grants antes da homologação.

O gate **NO_GO** impede exclusivamente promoção operacional. Não impede o avanço dos lotes de engenharia sobre a `main`.
