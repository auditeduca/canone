# F4-02 — EQT 2/2026: seis modalidades, edital retificado e contratos separados

**Referência oficial:** https://conhecimento.fgv.br/sites/default/files/concursos/cfc-eqt-edital-2026.2-12.08.2026.pdf, edital EQT nº 2/2026 retificado em 12/08/2026. A página https://conhecimento.fgv.br/exames/cfceqt/2026.2 informa gabarito objetivo definitivo de **03/11/2026**. A publicação do resultado final discursivo é prevista para **18/12/2026**, segundo o cronograma do edital; em 20/11/2026 não é correto classificá-lo como definitivamente publicado.

| Modalidade | Data oficial | Escopo |
|---|---|---|
| QTG — Auditoria Geral | 28/09/2026 | CNAI |
| QTG — Perícia | 29/09/2026 | CNPC |
| CVM | 30/09/2026 | Auditoria regulada |
| BCB | 01/10/2026 | Auditoria regulada |
| Susep | 02/10/2026 | Auditoria regulada |
| Previc | 03/10/2026 | Auditoria regulada |

**Formato oficial por modalidade:** 25 objetivas × 2 pontos + 2 discursivas × 25 pontos = 100 pontos; **cinco alternativas (A–E)** por objetiva (edital itens 5.10 e 5.19). Isso **difere** da Suficiência (50 objetivas × quatro alternativas, sem discursiva). A F3 existente não possui prova validada de editor/correção discursiva EQT, e não pode ser anunciada como homologada para as seis modalidades.

**Vigência normativa:** edital EQT item 5.12 considera normas vigentes **na data de publicação do edital**, com regras específicas para jurisprudência (5.17); não aplicar a regra de **90 dias antes da prova** usada no Exame de Suficiência. A data de publicação original 13/07/2026 aparece no rodapé; a versão retificada 12/08/2026 exige rastreabilidade separada e confirmação por edição para eventuais mudanças normativas. Nenhuma NBC/regra individual foi homologada neste lote.

O registro `governance/f4_eqt_modalities_2026_2_v1.json` reconcilia os seis IDs de trilha do S23 e marca todos como `HOLD_RIGHTS`, `HOLD_VERSIONED_CFC_NBC_OR_REGULATOR` e `NOT_E2E_HOMOLOGATED` para discursivas; **0 questões autorizadas para publicação**. O validador impede empréstimo silencioso do formato e do corte normativo do Exame de Suficiência.

**Gate de release:** somente com autorização de conteúdo, inventário de normas com datas, revisão por especialista, correção discursiva validada, acessibilidade, segurança e aprovação jurídica humana. Plataforma **NO_GO**.

## Completação de direitos — F4-03

O registro canônico `governance/editorial_rights_registry_v1.json` passou de cinco referências históricas para **11 ativos**: **2 TEST_ONLY + 9 HOLD_RIGHTS + 0 publicáveis**. Os seis novos HOLDs são exatamente `fgv:eqt:2026.2:{qtg,per,cvm,bcb,susep,previc}`, vinculados à página oficial FGV. São referências de origem, **não cópias das provas**. A validação `tools/f4_eqt_modalities.py` agora falha se qualquer trilha EQT não constar do registro de direitos ou possuir indevidamente licença/permissão.

A fotografia histórica F3-REC-07 de cinco itens permanece preservada em seu relatório de execução anterior. A cobertura expandida é um **incremento F4**, não revisão retroativa de resultado.
