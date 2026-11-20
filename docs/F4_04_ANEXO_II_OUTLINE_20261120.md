# F4-04 — Reconciliação estrutural do Anexo II

**20/11/2026 — controle de planejamento, NÃO homologação editorial nem jurídica. Produção `NO_GO`.**

O manifesto `governance/f4_annex02_outline_v1.json` registra **13 seções e 82 grupos alfabéticos** do Anexo II da Suficiência 3/2026, além das **seis modalidades EQT** com **30 clusters temáticos candidatos**. As etiquetas são paráfrases curtas. Não foram copiados enunciados, provas, textos normativos ou parágrafos extensos dos anexos.

Há duplicidade de letras **M e N** em Contabilidade Aplicada ao Setor Público na fonte; os IDs canônicos preservam as duas ocorrências. O código impede sobreposição silenciosa, troca de sequência, exclusão de grupos, módulo incorreto e contagens falsas.

**42 códigos normativos candidatos** foram identificados pelo mapeamento temático, todos ainda com `HOLD` para versão, data de vigência e direitos. Não se infere que a versão atualmente exibida no CFC seja a aplicável a 14/09/2026 ou à publicação do EQT de julho/agosto. Especial atenção às revisões de 2026, incluindo normas de auditoria e demonstrações contábeis.

A granularidade comprovada é **grupo por letra (Suficiência)** e **cluster de planejamento (EQT)**. Não equivale à atomização de todas as expressões e subdivisões dentro dos grupos, nem à verificação primária de cada NBC/CPC. `approved_deep_paragraph_subtopics=0`; `approved_lessons=0`; `approved_questions=0`.

Fontes oficiais consultadas e verificadas por página: [FGV — edital Suficiência 3/2026, Anexo II](https://conhecimento.fgv.br/sites/default/files/concursos/cfc-edital-2026.3-05.10.2026.pdf), páginas PDF 22–30; [FGV — edital EQT 2/2026 retificado, Anexo II](https://conhecimento.fgv.br/sites/default/files/concursos/cfc-eqt-edital-2026.2-12.08.2026.pdf), páginas PDF 24–33; [índice NBC do CFC](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/) e [normas completas](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/normas-completas/).

Validação determinística: `python3 tools/f4_atomization_gate.py` e `python3 -m unittest discover -s tests -p 'test_f4_atomization_gate.py' -v`. Esses testes devem ser executados em CI junto às verificações F4-01/02.

Próximo lote **F4-04-B**: decompor cada grupo em objetivos próprios, identificar e verificar *cada norma/versionamento* com publicação, data de eficácia, corte da edição, URL primária e hash; registrar apenas então o estado `NORM_VERIFIED` de forma independente. Material externo sem licença permanece `HOLD_RIGHTS`; textos didáticos inéditos passam por revisão humana antes de publicação. Supabase fica na F8.
