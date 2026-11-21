# F1 NS01-02 — contrato privado candidato para SRS vencido

**20/11/2026 — banco de testes PostgreSQL 17 descartável, produção `NO_GO`.**

A função histórica `learning.due_items` e a view `subscriber.v_my_due` ficaram em `DEFERRED_DEPENDENCY`. A candidata `canone_ops.srs_due_private_ci(subject,limit)` é intencionalmente instalada **apenas em CI** (não nas migrations 001–010). Filtra estados `user_item_state` por `auth.uid()`, exige benefício `cfc.exam`, valida limite 1–100 e devolve apenas itens SRS vencidos, assunto, estado, estabilidade, fragilidade e última classificação. Não devolve enunciados, opções ou gabarito.

`SECURITY DEFINER` usa `search_path=pg_catalog` e somente `service_role` recebe `EXECUTE`. O gateway deve validar JWT antes de definir o sujeito do request. Cliente browser (`authenticated`, `anon`) não pode chamar essa função diretamente.

**Desvio de contrato deliberado:** o legado aceitava `p_user_id` explícito, enquanto o candidato sempre usa o usuário autenticado e exige benefício válido. Portanto, o teste de isolamento **não equivale a paridade integral** e não conclui a view, cuja linha na fila NS01 permanece aberta. A view administrativa `admin.v_user_overview` também fica em HOLD por dependência de Auth gerenciado.

Evidência automatizada: `tests/sql/f1_ns01_due_private_ephemeral.sql` + `tests/sql/f1_ns01_due_owner_tests_ephemeral.sql` + `tests/pg17_f1_ns01_due.sh`. Dois usuários, dois assuntos, itens novos, futuros e vencidos, limite e filtro, revogação de benefício, ausência de JWT, negativa de roles browser e rollback da fixture. Passar nesses testes não substitui revisão independente de permissões, API, Auth gerenciado e conteúdo.

F8 Supabase por último; nenhum banco remoto alterado.

## F1 NS01-03 — integração do endpoint no CI

A versão isolada `gateway/alpha12-core.mjs` preserva `alpha11` e adiciona `POST /api/v1/srs/due`, com payload **exato** `{subjectId: uuid|null, limit: 1..100}`. A verificação do Bearer ocorre no servidor, com usuário autenticado por componente de Auth do teste; `makePgExecutor` define o sujeito numa transação local, comprova benefício e chama a função privada. Não recebe `userId` do navegador nem retorna chaves de respostas.

A suíte `tests/f1_ns01_srs_gateway.test.mjs` cobre contrato de entrada/saída, formato, campos extras, limites, método e autorização. O teste integrado `tests/f1_ns01_srs_http_pg17.mjs` envia requisições HTTP ao gateway alpha12 somente no PG17 efêmero, incluindo usuário licenciado, usuário sem licença e ausência de Bearer. São **Auth e direitos sintéticos**, não homologação produtiva. `subscriber.v_my_due` e sua semântica continuam pendentes de revisão independente; código não foi colocado no app produtivo.
