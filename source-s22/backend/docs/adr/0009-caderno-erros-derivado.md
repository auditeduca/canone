# ADR-0009 — Caderno de erros como projeção da tentativa concluída (S10)

**Decisão:** o Caderno de Erros reutiliza `learning.reveal_exam_key(uuid)` e `provas.revelar`. Não há outro motor de avaliação, coluna de resposta correta duplicada, tabela de erros adicional ou recálculo de nota no frontend. O GET `/api/subscriber/tentativas/{uuid}/caderno-erros` passa pelo mesmo `comAssinante`, no contexto `canone_subscriber`.

**Critérios de recusa:** sem sessão, sem entitlement, conta suspensa (middleware S9), tentativa inexistente, tentativa de outro usuário, tentativa aberta. O motor existente recusa pela transação e pelo contexto RLS. Apenas `verdict='errada' AND is_annulled=false` compõe o caderno; alternativas anuladas e corretas são excluídas. Respostas não registradas não são inventadas como erros.

**Limite de publicação:** o backend compilado é QA e não API pública. O frontend S8 permanece com questões sintéticas e sem persistência real. As 30 migrations não foram migradas para `canone_*` no Supabase compartilhado. Não configurar `/api/subscriber` no frontend antes do gate de banco, sessões seguras e aprovação normativa.

**Evidência:** `tests/14-acesso-api.test.mjs` exercita o PostgreSQL temporário; `tests/17-s10-caderno-erros.test.mjs` cobre recusas, filtro e ausência de segunda autoridade. Lançamento comercial `NO_GO`.
