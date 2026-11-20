# F3-REC-04 — navegador real → React S22 → gateway → PostgreSQL 17

**Estado:** teste adicionado ao CI, resultado da execução em avaliação. **NO_GO** para produção.

O novo ensaio executa Chromium no job PostgreSQL 17 efêmero: a página aditiva `jornada-servidor.html` usa `Nav`, `Footer`, `ExamQuestion` e CSS S22, conecta-se por proxy local ao gateway NS-03 e executa as operações privadas de prova no PG17 real (não PGlite).

A identidade é **sintética** (HMAC gerado em processo do servidor fake Auth), os usuários são inventados e o formulário é uma fixture sem gabarito. O banco usa conexão `canone_gateway_ci` sem privilégio de superusuário; sessão associada ao usuário verificado, `SET LOCAL ROLE service_role` dentro de transação.

**Critérios de teste:** abertura da tentativa; negativa de benefício para usuário sem assinatura, negativa IDOR da tentativa de A para B, gabarito prematuro recusado, respostas persistidas, conclusão, revelação posterior, revisão SRS e consulta SQL independente ao contêiner descartável.

O guard recusa executar fora de GitHub Actions, sem identificação de contêiner ou com variáveis usuais de banco remoto. Os tokens sintéticos existem somente no `/tmp` do runner com permissão 0600, removidos ao fim. **Não há Supabase/Auth real, questões oficiais licenciadas, catálogo autorizado, sessão multi-dispositivo ou deploy.** Supabase permanece F8.

Arquivos `tests/f3_pg17_real_server.mjs`, `tests/f3_pg17_real_browser.py`, `tests/pg17_f3_react_browser.sh` e `source-s22/app/vite.p0.config.ts`.

## Homologação técnica da etapa — PASS controlado

- [GitHub Actions #44699825988](https://github.com/auditeduca/canone/actions/runs/44699825988): **4/4 jobs SUCCESS**, commit ensaiado `8017645e2063cbcb5488d836918d50bf2518b5bf`.
- O log do job PostgreSQL confirmou `PASS F3: Chromium -> React S22 -> real gateway -> ephemeral PG17; IDOR denied; early key denied; real SRS`, seguido de `PASS_F3_REAL_BROWSER_PG17`.
- Foram executados os testes históricos de PG17, inclusive 14 testes HTTP NS-03 (0 falhas), os testes de banco com concorrência/rollback e os dois testes visuais (mock de UI e PG17 real).
- SQL após o navegador confirmou uma tentativa finalizada do usuário fictício e ao menos um recibo SRS persistido no banco de teste.
- Negativos provocam erros esperados de SQL (ex.: `KEY_ONLY_AFTER_FINISH` e `NOT_OWNER`) no log do banco; isso é evidência dos bloqueios, não defeito do job.
- O teste ainda **não** cobre reinício de servidor, recuperação de sessão, catálogo autorizado, múltiplos dispositivos, Supabase Auth/JWT real ou licenciamento editorial. **F3 como frente continua aberta; F3-REC-04 passa no seu critério controlado**.

**Próxima atividade:** F3-REC-05 — catálogo com contratos de leitura seguros e recuperação da sessão/histórico, sem transportar gabaritos para cliente e sem Supabase.
