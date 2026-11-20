# F4-03 — checkpoint de fontes, modalidades, direitos e completude

**Repositório:** `auditeduca/canone`, somente `main`. **Data:** 20/11/2026. **Evidência:** [CI #44719200458](https://github.com/auditeduca/canone/actions/runs/44719200458), quatro jobs aprovados no commit `a4b5d2cfc4ee6b17b634b25ebd8c6b2d19463c47`.

## O que foi confirmado

| Domínio | Denominador | Resultado comprovado | Limite |
|---|---:|---|---|
| Editais Suficiência 2026 | 2 | 2 fontes de edição mapeadas | Sem licença para reusar caderno |
| Modalidades EQT 2026.2 | 6 | 6 datas, tipos, referência ao edital e regras mapeados | Sem homologação discursiva |
| Áreas oficiais Suficiência | 13 | 13 associadas aos módulos como planejamento | 0 áreas com conteúdo homologado |
| Trilhas planejadas S23 | 7 | 7 IDs reconciliados | Edital de cada modalidade não equivale a aulas |
| Módulos S23 | 26 | 26 inventariados, 19 candidatos de disciplinas e 7 transversais | Não significa que 26 módulos estejam publicáveis |
| Direitos e proveniência | 11 ativos | 2 TEST_ONLY, 9 HOLD_RIGHTS | 0 direitos reais de publicação |
| Jobs CI desta rodada | 4 | 4 aprovados | Apenas código e testes existentes |

A expressão **19 módulos candidatos** descreve a associação editorial preliminar de módulos a disciplinas, **não** sua maturidade funcional. Os sete demais módulos são transversais/não associados diretamente à grade de áreas; continuam inventariados.

## Decisões normativas não intercambiáveis

- Suficiência 3/2026: itens 6.8/6.11, **50 objetivas de 4 opções**, norma aplicável até 90 dias antes da prova de 13/12/2026 (corte 14/09/2026).
- Suficiência 2/2026: prova 27/09/2026, corte 29/06/2026.
- EQT 2/2026 (edital retificado 12/08/2026): **seis modalidades**, cada uma com **25 objetivas de 5 opções e 2 dissertativas**, 100 pontos máximos, regra normativa do item 5.12 **na publicação do edital**. Publicação original indicada em 13/07/2026; eventual efeito normativo da retificação e vigência individual continuam sob verificação `HOLD_PER_NORM_AND_RETIFICATION`. O gabarito objetivo definitivo consta no site FGV em 03/11/2026, mas o resultado discursivo final era previsto para 18/12/2026.

## Próximas entregas em sequência

**F4-04** atomizar a integralidade dos anexos programáticos por disciplina/subtema e modalidade EQT, sem replicar a redação protegida além das informações necessárias à referência. Identificar normativa primária, versão, alteração, eficácia, corte correto, fonte e hash para cada átomo.

**F4-05** gerar conteúdo **original do Cânone** (aula, caso, questão, alternativas, solução e explicação), sempre em `CANDIDATE_REVIEW` até avaliação técnica independente e prova de direitos; criar progressão básico→intermediário→avançado por área, com cobertura por objetivo e item.

**F4-06** recolher documentos jurídicos dos detentores de direitos de qualquer obra externa que se queira publicar, auditar os 87 arquivos S22 não importados para identificar riscos sem reproduzir conteúdo, formalizar aprovadores humanos e publicar/retirar versões com logs e rollback.

**F5/F6/F7** controles de assinaturas sandbox, acessibilidade e segurança, empacotamento reprodutível e recuperação. **F8 Supabase dedicado por último**, sem antecipação.

## Fontes

FGV CFC Suficiência: https://conhecimento.fgv.br/exames/cfc/2026.3 e https://conhecimento.fgv.br/exames/cfc/2026.2; FGV EQT: https://conhecimento.fgv.br/exames/cfceqt/2026.2; CFC NBC: https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/; Lei 9.610/1998: https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html.

**Não houve aplicação de migrations no Supabase nem autorização de produção. Gate `NO_GO`.**
