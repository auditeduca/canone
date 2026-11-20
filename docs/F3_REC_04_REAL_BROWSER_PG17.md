# F3-REC-04 — navegador real → React S22 → gateway → PostgreSQL 17

**Estado:** teste adicionado ao CI, resultado da execução em avaliação. **NO_GO** para produção.

O novo ensaio executa Chromium no job PostgreSQL 17 efêmero: a página aditiva `jornada-servidor.html` usa `Nav`, `Footer`, `ExamQuestion` e CSS S22, conecta-se por proxy local ao gateway NS-03 e executa as operações privadas de prova no PG17 real (não PGlite).

A identidade é **sintética** (HMAC gerado em processo do servidor fake Auth), os usuários são inventados e o formulário é uma fixture sem gabarito. O banco usa conexão `canone_gateway_ci` sem privilégio de superusuário; sessão associada ao usuário verificado, `SET LOCAL ROLE service_role` dentro de transação.

**Critérios de teste:** abertura da tentativa; negativa de benefício para usuário sem assinatura, negativa IDOR da tentativa de A para B, gabarito prematuro recusado, respostas persistidas, conclusão, revelação posterior, revisão SRS e consulta SQL independente ao contêiner descartável.

O guard recusa executar fora de GitHub Actions, sem identificação de contêiner ou com variáveis usuais de banco remoto. Os tokens sintéticos existem somente no `/tmp` do runner com permissão 0600, removidos ao fim. **Não há Supabase/Auth real, questões oficiais licenciadas, catálogo autorizado, sessão multi-dispositivo ou deploy.** Supabase permanece F8.

Arquivos `tests/f3_pg17_real_server.mjs`, `tests/f3_pg17_real_browser.py`, `tests/pg17_f3_react_browser.sh` e `source-s22/app/vite.p0.config.ts`.
