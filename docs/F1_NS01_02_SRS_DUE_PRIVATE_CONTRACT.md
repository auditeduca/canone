# F1 NS01-02 — contrato privado candidato para SRS vencido

**20/11/2026 — banco de testes PostgreSQL 17 descartável, produção `NO_GO`.**

A função histórica `learning.due_items` e a view `subscriber.v_my_due` ficaram em `DEFERRED_DEPENDENCY`. A candidata `canone_ops.srs_due_private_ci(subject,limit)` é intencionalmente instalada **apenas em CI** (não nas migrations 001–010). Filtra estados `user_item_state` por `auth.uid()`, exige benefício `cfc.exam`, valida limite 1–100 e devolve apenas itens SRS vencidos, assunto, estado, estabilidade, fragilidade e última classificação. Não devolve enunciados, opções ou gabarito.

`SECURITY DEFINER` usa `search_path=pg_catalog` e somente `service_role` recebe `EXECUTE`. O gateway deve validar JWT antes de definir o sujeito do request. Cliente browser (`authenticated`, `anon`) não pode chamar essa função diretamente.

**Desvio de contrato deliberado:** o legado aceitava `p_user_id` explícito, enquanto o candidato sempre usa o usuário autenticado e exige benefício válido. Portanto, o teste de isolamento **não equivale a paridade integral** e não conclui a view, cuja linha na fila NS01 permanece aberta. A view administrativa `admin.v_user_overview` também fica em HOLD por dependência de Auth gerenciado.

Evidência automatizada: `tests/sql/f1_ns01_due_private_ephemeral.sql` + `tests/sql/f1_ns01_due_owner_tests_ephemeral.sql` + `tests/pg17_f1_ns01_due.sh`. Dois usuários, dois assuntos, itens novos, futuros e vencidos, limite e filtro, revogação de benefício, ausência de JWT, negativa de roles browser e rollback da fixture. Passar nesses testes não substitui revisão independente de permissões, API, Auth gerenciado e conteúdo.

F8 Supabase por último; nenhum banco remoto alterado.
