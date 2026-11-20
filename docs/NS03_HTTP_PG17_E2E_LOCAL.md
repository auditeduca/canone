# NS-03 — contrato HTTP com PostgreSQL 17 descartável

**Data:** 20/11/2026  
**Projeto:** Cânone · F2 pré-Supabase · execução somente `main`  
**Status:** candidato a validação em GitHub Actions; não usar como selo operacional de produção.

## Objetivo e limite

Trocar o executor de banco simulado da NS-02 por **PostgreSQL 17 real em contêiner descartável**, sem modificar Supabase e sem Auth gerenciado. As chamadas HTTP são feitas por `fetch` ao servidor local `makeServer()`, passam por `createGateway()`, verificam a identidade no `syntheticAuthFetch()` estritamente de teste e executam o `makePgExecutor()` com o driver `pg@8.23.1` instalado pelo `package-lock.json` histórico do S22.

Os scripts são `tests/ns03_http_pg17.test.mjs` e `tests/pg17_ns03_http_real_pg.sh`. O job só aceita `GITHUB_ACTIONS=true`, `CANONE_SYNTHETIC_TEST_ONLY=1`, `CANONE_CI_PG17_ONLY=yes` e ID do contêiner do job. O SQL real utiliza apenas `127.0.0.1` na porta efêmera publicada pelo contêiner de CI. São recusadas variáveis que possam apontar a bancos remotos e credenciais Supabase.

## Isolamento de identidade e de privilégios

- Identidades A e B são UUIDs sintéticos. Seus JWTs são produzidos por HMAC efêmero na fixture; nunca equivalem a JWTs emitidos pelo Supabase real.
- O login PostgreSQL `canone_gateway_ci` tem `NOSUPERUSER`, `NOINHERIT` e associação explícita ao papel `service_role` do ambiente sintético. Ele é diferente do `postgres` reservado exclusivamente à preparação e inspeção das fixtures.
- O `makePgExecutor()` inicia uma transação, faz `SET LOCAL ROLE service_role`, propaga `request.jwt.claim.sub` **da resposta do verificador de identidade**, confere `canone_ops.can_use_feature` e executa **uma operação SQL previamente permitida**. Em erro, faz rollback.
- `gatewayPool` usa `max:1` para provar que a conexão reutilizada retorna com `current_user=canone_gateway_ci` e sem `request.jwt.claim.sub`, tanto após sucesso quanto após erro.
- O navegador nunca recebe URL, usuário, senha ou papel do banco. Uma consulta direta ao gabarito com o login de serviço sem `SET ROLE` é negada (código PostgreSQL `42501`).

## Cenários do teste (subtestes de aceitação)

1. Token ausente recusado.
2. Token forjado recusado por Auth sintético, antes de tocar no banco.
3. Assinatura cancelada impede início da prova no PG17.
4. Assinatura ativa autoriza `exam_start` e cria registro real com proprietário correto.
5. Gabarito não é revelado enquanto a prova está aberta.
6. Usuário B com concessão válida não altera a tentativa do usuário A.
7. Reenvio/alteração de resposta atualiza contagens de forma idempotente sem expor correção precoce.
8. Operação SQL inválida aciona rollback, preserva as contagens e limpa o contexto da conexão.
9. Cancelamento da assinatura impede ações posteriores na mesma tentativa.
10. Conclusão idempotente, revelação posterior permitida e nova resposta recusada após finalização.
11. Duas requisições HTTP concorrentes para revisão SRS criam um único recibo real.
12. Revogação de concessão B é aplicada na próxima requisição.
13. Pool retorna ao papel limitado; consulta direta ao gabarito é negada.

**Critério de aceite:** todos os subtestes, incluindo asserts sobre linhas reais do banco, precisam passar no job PostgreSQL 17, juntamente com os testes anteriores de concorrência S22–alpha.9 e gate `NO_GO`. A documentação será atualizada com o ID exato do CI após o resultado.

## Limitações honestas

- A validação de identidade continua sintética e não comprova autenticação, revogação, rotação de chaves nem expiração reais do Supabase Auth.
- O ambiente usa PostgreSQL 17 efêmero via Docker e `pg` do lockfile; não é uma instalação Supabase com configuração de produção.
- A fixture contém exclusivamente questões inventadas e não pode ser publicada como prova oficial do CFC.
- O teste de duas requisições HTTP SRS ocorre com pool de uma conexão; a corrida real de **duas conexões** já foi exercitada separadamente na alpha.8. NS-03 confirma a integração HTTP→transação→banco.
- Segurança de rede de produção, segredo de serviço, rate limit, revisão editorial e E2E no navegador permanecem pendentes. **Supabase exclusivo será instalado por último, na F8.**

## Próximo passo

**NS-04:** primeira jornada frontend P0 de aluno com dados sintéticos e testes de navegador desktop/mobile, seguida por conteúdo, billing de teste, segurança, operação local e somente depois F8.
