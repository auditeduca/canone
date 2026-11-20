# NS-02 — Identidade sintética isolada e E2E HTTP do gateway

**Data:** 20/11/2026 | **Projeto:** Cânone | **Banco definitivo:** Supabase somente na F8 | **Gate operacional:** `NO_GO`

## Objetivo e arquitetura

Validar as fronteiras HTTP do backend `gateway/alpha9-core.mjs` e do servidor de loopback `gateway/alpha9-server.mjs` **sem** conectar ao Supabase e **sem** dados pessoais. O teste executa um servidor HTTP real em `127.0.0.1` com porta efêmera, mas **substitui deliberadamente** duas dependências por dublês explícitos: a resposta do endpoint `/auth/v1/user` e o executor SQL/entitlements.

A fixture de autenticação em `tests/fixtures/ns02-local-auth.mjs` só responde se `CANONE_SYNTHETIC_TEST_ONLY=1` e a URL tiver o host fictício **`ns02-test-project.supabase.co`**. Tokens HS256 de teste usam uma chave aleatória efêmera gerada a cada processo; assinatura e expiração são verificadas na fixture. Nenhum segredo, JWT ou usuário real é necessário. A fixture **não é usada ou importada pelo gateway de produção**, sendo carregada apenas por testes.

O gateway continua validando os campos de cada rota, consultando a identidade pelo verificador de Auth e delegando autorização e comportamento ao executor. O dublê da camada DB mantém dois usuários sintéticos com assinaturas independentes e tentativas pertencentes ao usuário. Ele **não substitui** PostgreSQL, RLS ou verificação real de benefícios, já testados em lotes anteriores de PG17.

## Aceite executado no processo Node

| Cenário | Resultado esperado |
|---|---|
| JWT ausente, expirado ou assinatura forjada | HTTP 401 |
| `user_metadata` anuncia administrador/assinatura, mas DB nega | HTTP 403 |
| Cliente envia `userId` para assumir identidade de outro aluno | HTTP 400 |
| JSON malformado ou método incorreto | HTTP 400/405 |
| Tentativa do aluno A consultada pelo aluno B (mesmo B assinante) | HTTP 403 |
| Gabarito solicitado antes da conclusão | HTTP 409 |
| Jornada início→resposta→finalização→revelação→SRS | HTTP 200 por ação válida, sem revelação antecipada |
| Duas revisões SRS idênticas | Um único evento no dublê |
| Assinatura revogada após iniciar tentativa | HTTP 403 em nova operação |
| Rota SQL/admin não catalogada | HTTP 404 |

## Como executar

```bash
CANONE_SYNTHETIC_TEST_ONLY=1 node --test tests/ns02_local_identity_http.test.mjs
```

**Não criar chave ou URL real no teste.** Esse comando serve apenas em CI/local, não em produção. O CI o executa antes da suíte histórica. Nenhum projeto Supabase é criado, consultado ou modificado.

## Limites e próximo aceite

- **NS-02:** teste E2E HTTP local, sem banco real, atende ao contrato de identidade sintética e falhas negativas das rotas. **Não afirma JWT real Supabase.**
- **NS-03:** integrar o mesmo HTTP a um PostgreSQL 17 efêmero com SQL 001–010 e autorização transacional, além de testes de carga e isolamento de usuários A/B.
- **NS-04:** criar primeira tela navegável da jornada CFC P0 e executar testes em navegador desktop/mobile.
- **F8:** somente depois de F1–F7, executar JWT real com Supabase exclusivo e E2E homologado antes do GO operacional.

O teste usa dados inteiramente sintéticos, não contém credenciais e mantém `NO_GO` de produção.
