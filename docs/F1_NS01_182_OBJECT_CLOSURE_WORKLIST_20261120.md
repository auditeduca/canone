# F1-NS01 — Fila de fechamento sem perda de 182 declarações SQL

**Data:** 20/11/2026. **Local:** `auditeduca/canone`, branch `main`. **Estado:** rastreabilidade do trabalho / **não** encerramento de paridade / `NO_GO`.

A base S22 dispõe de **58 declarações de funções**, **26 triggers**, **18 views** e **80 policies**. O inventário anterior registrou a presença nominal de candidatos e gaps, mas não provou equivalência semântica. A nova fila `inventories/s22/CANONE_NS01_CLOSURE_QUEUE.json` contém **uma entrada por declaração (182/182)** e cruza localização, hash da fonte, status original, riscos, alvos candidatos, prioridade e as evidências necessárias antes da decisão.

**Duas dependências específicas continuam em P0:**

- `subscriber.v_my_due`: função `learning.due_items` não portada; avaliar alternativa de consulta com isolamento por proprietário e sem invocação de função privilegiada pelo navegador.
- `admin.v_user_overview`: dependência do modelo de contas de identidade gerenciada; **não** recriar nem copiar uma conta de Auth no projeto S22, nem expor dados do aluno em view administrativa sem RBAC.

Cada item está em `OPEN_EVIDENCE_REQUIRED` com `decision=null`, `reviewer_signoff=null` e `ci_evidence_url=null`. Nomes iguais, arquivos históricos e proxies não recebem `SEALED` por presunção. Opções futuras: `PORT_WITH_PARITY`, `REPLACE_WITH_VERIFIED_CONTRACT`, `EXCLUDE_WITH_JUSTIFICATION`, `HOLD_DEPENDENCY`. Todas exigem revisão independente e CI PostgreSQL 17, autorização, regressões e provas específicas por categoria.

A fila privilegia **RLS, autenticação, gabarito e views adiadas** como P0. O resto é P1/P2 conforme migração pendente, risco e contrato substituto; prioridade não significa direito de publicação ou decisão de implementação. Para atualizar a base-fonte, é obrigatório reconciliar o hash Git do inventário e repetir o validador.

**Testes:** `python3 tools/ns01_closure_queue.py`, `python3 -m unittest discover -s tests -p 'test_ns01_closure_queue.py' -v`. Não existe migração ou escrita no Supabase. F8 apenas após F1–F7 aprovadas.

**Próxima ação funcional F1:** selecionar os itens P0 por risco, revisar SQL origem, decidir contrato de substituição e adicionar provas comportamentais no PG17 para cada lote; registrar o resultado na fila quando as evidências existirem, nunca eliminar pendências por simples ocorrência do nome.
