# F4-04-D + F1 NS01 — checkpoint de completude controlada

**Data:** 20/11/2026. **Repositório:** `auditeduca/canone`, `main`. **Regressão:** [CI #44804761678](https://github.com/auditeduca/canone/actions/runs/44804761678), **4/4 jobs PASS** no commit [`b7581da4`](https://github.com/auditeduca/canone/commit/b7581da496ab296208ce16353a1eeed981486503). Sem banco remoto ou deploy.

## Avanço demonstrado

| Frente | Resultado técnico | Homologação ainda faltante |
|---|---|---|
| F4-04-D | **64 grupos novos, 192 objetivos próprios**, somados aos 18 grupos e 63 objetivos anteriores | Parecer contábil, revisão das subdivisões internas, versões normativas e direitos |
| Suficiência 2026.3 | **82/82 grupos** e **255 objetivos candidatos** distribuídos em 13 áreas | 0 objetivos com aprovação editorial, 0 aulas e 0 questões aprovadas |
| EQT 2026.2 | 6 modalidades / 30 clusters candidatos registrados anteriormente | Objetivos detalhados por modalidade e rubricas discursivas |
| F1 NS01 | **182/182 declarações de origem** em fila individual de fechamento | 0/182 formalmente encerradas; paridade comportamental e RLS não homologadas |
| Prioridades F1 | **118 P0, 34 P1, 30 P2** | Documentar decisões e executar testes por objeto |
| F1 dependências críticas | 2 views adiadas com motivo individual | Resolver `learning.due_items` e modelo de identidade sem expor dados |
| Normas | 42 códigos candidatos identificados; seis afetados por revisões oficiais de 2026 | 0/42 versões por edição homologadas |

## Integridade e critérios aplicados

O arquivo `governance/f4_learning_objectives_remaining_64_v1.json` contém os novos objetivos por grupo, níveis básico/intermediário/avançado, referência ao Anexo II, hash Git do manifesto e do piloto anterior. Os validadores falham em caso de substituição, perda ou duplicidade dos 82 grupos, adulteração de origem, ausência de nível, promoção indevida de norma, direito ou conteúdo. **Os 63 objetivos originais foram preservados**.

A fila `inventories/s22/CANONE_NS01_CLOSURE_QUEUE.json` contém cada declaração histórica, arquivo e linha, SHA da origem, categoria, status, candidatos de destino, prioridade, evidências necessárias e decisão ainda em aberto. O validador falha ao apagar objetos, fabricar revisão ou marcar uma declaração como encerrada. Igualdade de nome ou existência de uma migration candidata **não** é prova de paridade semântica.

**P0 F1 inclui controle de papéis, acesso ao gabarito e políticas legadas**; o planejamento deve priorizar cenários `anon`, `authenticated`, `service_role`, usuários distintos, funções `SECURITY DEFINER`, rollback, conflitos de sessão e licenciamento antes de homologar. A view `subscriber.v_my_due` depende da função de SRS não portada; `admin.v_user_overview` do modelo de identidade gerenciada ainda não aprovado.

## O que não foi concluído

- Não foi atomizado integralmente o corpo de todos os programas oficiais, especialmente EQT.
- Os **255 objetivos são candidatos**, não 255 aulas, provas ou itens homologados.
- Nenhuma das 42 normas foi atestada com a versão e a data de eficácia por edição.
- Nenhum dos 182 objetos SQL recebeu decisão final de portar, substituir, rejeitar ou manter em dependência com evidência e assinatura.
- Não houve homologação global de F1–F7, nem Supabase gerenciado, JWT real, cobrança real, deploy ou publicação.

**Próxima fila de execução:** F1 P0 — revisão semântica e provas no PG17 por lote, começando pelas duas views e pelas regras com acesso privilegiado; F4-04-E — normativos por edição; F4-05 — aulas e questões originais em `CANDIDATE_REVIEW`; F5–F7 em trilhas independentes. **F8 Supabase exclusivo é a última etapa** após os gates. Produção `NO_GO`.
