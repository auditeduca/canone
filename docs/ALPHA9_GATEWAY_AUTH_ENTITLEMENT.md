# Cânone — alpha.9 | Gateway Supabase Auth e autorização de prova

**Estado:** candidato técnico de staging, **NO_GO** produção. Nenhuma escrita no Supabase conectado. Tudo em `main` e todos os dados de teste sintéticos.

## Problema resolvido nesta etapa

A alpha.8 entrega cinco funções internas de tentativa/correção/SRS com `EXECUTE` restrito a `service_role`; isso **não** as transforma em uma API segura por si só. A alpha.9 acrescenta uma fronteira HTTP fechada, validação de identidade pelo Auth oficial e contrato de autorização comercial/temporária que o serviço consulta **em toda transação**.

### Sequência de confiança

1. O navegador manda `POST /api/v1/exam/{start|answer|finish|reveal|review}` com `Authorization: Bearer <JWT>` e JSON estritamente validado; nunca manda `userId`, `role`, veredito, nota ou conexão SQL. Sem CORS de terceiros ou cookies de sessão no protótipo.
2. O gateway encaminha o token **apenas** ao próprio servidor `GET https://<REF>.supabase.co/auth/v1/user` via HTTPS e chave *publishable*, não a `service_role`. A resposta verifica o UUID do usuário e recusa contas anônimas. Rejeita token inválido e falha de rede. Nunca confia em `user_metadata`, JWT decodificado manualmente ou em `getSession()` para autorizar.
3. A execução PostgreSQL usa **somente** uma conexão backend de confiança. Abre `BEGIN`, aplica `SET LOCAL ROLE service_role`, configura `request.jwt.claim.sub` **a partir do UUID verificado** (e nunca de input do cliente), verifica `canone_ops.can_use_feature(UUID,'cfc.exam')` e só então invoca uma dentre as cinco consultas parametrizadas e fixas. `COMMIT` ou `ROLLBACK` limpa o contexto.
4. A função `canone_ops.can_use_feature` (SQL candidato 010) exige `p_user_id = auth.uid()` no banco. Autoriza assinaturas ativas, plano ativo, feature habilitada e janela paga válida, sem trial pendente; ou concessões administrativas/promocionais/parceria/compensação ainda válidas e não revogadas. Uma linha `entitlement.source='assinatura'` **sozinha nunca é prova de cobrança ativa**. Falha por padrão.
5. Apenas o backend pode chamar funções 009. A resposta não revela a correção durante a prova e não calcula nota de corte ou aprovação não fundamentadas.

### Segurança do deploy

- `gateway/alpha9-server.mjs` tem bind apenas em `127.0.0.1`, é uma **entrada de desenvolvimento** e exige `CANONE_EXPECTED_PROJECT_REF`, `CANONE_SUPABASE_URL`, `CANONE_SUPABASE_PUBLISHABLE_KEY` e `CANONE_PG_DSN` (somente no servidor). A checagem recusa explicitamente o projeto compartilhado `Calculadoras-Smart`, outros refs de banco e DSN direto sem `sslmode=verify-full`. Supabase pooler/produção exigem revisão separada.
- Dependência `pg` vem do lock histórico em `source-s22/backend/package-lock.json`. Não inserir `service_role` keys, URL de banco ou senhas no código, repositório público, Vite ou app mobile.
- O papel de conexão deve ter permissão **limitada** para `SET LOCAL ROLE service_role` e conexão TLS; privilégios definitivos exigem revisão independente. Operações SQL usam placeholders e whitelist fixa de nomes de funções. A ferramenta de aplicação de migration deve permanecer segregada desse serviço.
- Supabase Auth é consultado por requisição. Rate limiting, WAF, logs redigidos, assinatura/webhooks de pagamento, atualização de planos, MFA/consentimento, revogação forte de sessões (quando exigida), isolamento de rede, manutenção de secrets e política de retenção ainda estão em **HOLD para produção**, não são alegados como concluídos.
- O candidato 010 recusa a origem compartilhada conhecida e pressupõe 001–009 no novo banco; não é migration pronta para aplicar. Nenhuma concessão é feita ao papel `authenticated` ou `anon`.

## Contratos API

| POST | Payload | Resposta (recurso ativo) |
|---|---|---|
| `/api/v1/exam/start` | `{ "formId": "<uuid>" }` | `{ "ok":true,"data":{"id":"<uuid>"} }` |
| `/api/v1/exam/answer` | `{ "attemptId":"<uuid>","ordinal":1,"option":"A" }` | `{ "ok":true,"data":{"accepted":true} }` |
| `/api/v1/exam/finish` | `{ "attemptId":"<uuid>" }` | Contagens factuais da prova |
| `/api/v1/exam/reveal` | `{ "attemptId":"<uuid>" }` | Vereditos somente após conclusão |
| `/api/v1/exam/review` | `{ "attemptId":"<uuid>","ordinal":1 }` | ID único do evento SRS ou `null` se anulada |

As respostas de falha incluem apenas código público (`AUTH_REQUIRED`, `FEATURE_NOT_AUTHORIZED`, `ACTION_NOT_ALLOWED`, `SERVICE_UNAVAILABLE` etc.), sem SQL, token, DSN ou mensagem de banco.

## Testes disponíveis

- Locais/CI: `node --test tests/alpha9-gateway.test.mjs`, cobrindo verificação Auth com HTTP sintético, validações da API, banco transacional e negativas de privilégio.
- Integração: `bash tests/pg17_alpha9_entitlement.sh`, **somente** quando o workflow disponibiliza um contêiner PG17 efêmero com os SQL candidatos 001–009 previamente carregados. Testa negação padrão, impersonação de subject, assinatura pendente, trial, ativa, expirada, cancelada, entitlement obsoleto, concessão válida e revogação; navegador proibido.
- Testes anteriores alpha.8: 12 testes Python, 32 verificações em PGlite, e concorrência `response/finish` e SRS em PG17.

## Próxima frente

Criar **Supabase exclusivo**, configurar ambiente de staging, homologar schema/migration formal, validar identidade de usuário com JWT emitido pelo Supabase real (não simulado), revisar billing/webhook e autorização por plano, integrar UI com gateway protegido e executar E2E com simulado de conteúdo sintético. Apenas então discutir `GO` operacional. Nenhuma alteração neste pacote significa aprovação para alunos ou acesso a questões editoriais protegidas.
