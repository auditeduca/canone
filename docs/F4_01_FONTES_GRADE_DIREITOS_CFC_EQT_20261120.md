# F4-01 — Reconciliação oficial de fontes, trilhas e grade de estudos

**20/11/2026 — `NO_GO` — matriz documental de planejamento, sem questões oficiais reproduzidas.**

## Fontes primárias verificadas

- FGV, edital do Exame de Suficiência **2/2026**, edição 02, publicado em 09/07/2026: https://conhecimento.fgv.br/sites/default/files/concursos/cfc-edital-2026.2-08.07.2026.pdf
- FGV, edital do Exame de Suficiência **3/2026**, edição 03, publicado em 05/10/2026: https://conhecimento.fgv.br/sites/default/files/concursos/cfc-edital-2026.3-05.10.2026.pdf
- FGV, página da 2/2026 com prova e gabarito definitivo de 26/10/2026: https://conhecimento.fgv.br/exames/cfc/2026.2
- FGV, página da 3/2026, ainda com atos de inscrição em 19/11/2026: https://conhecimento.fgv.br/exames/cfc/2026.3
- CFC, lista oficial de normas NBC e revisões: https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/
- CFC, esclarecimento sobre recepção de pronunciamentos CPC nas NBC: https://cfc.org.br/tecnica/perguntas-frequentes/normas-brasileiras-de-contabilidade/
- Lei de Direitos Autorais, arts. 28, 29, 46, 49–50: https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html

**Limitação:** consulta dos documentos e de seus metadados não comprova direito de reprodução digital/comercial de enunciados, gabaritos, tabelas normativas ou PDFs. Não copiar textos oficiais para o Cânone sem licença ou fundamentação aprovada após avaliação jurídica. Citação/hiperlink de referência não são sinônimos de permissão editorial.

## Escopo por edição

| Edição | Prova | Corte da vigência normativa (item 6.11) | Formato | Estado da publicação oficial |
|---|---|---|---|---|
| CFC-SUF 2/2026 | 27/09/2026 | 29/06/2026 | 50 itens × 4 alternativas | Prova realizada; gabarito definitivo no portal FGV de 26/10/2026 |
| CFC-SUF 3/2026 | 13/12/2026 | 14/09/2026 | 50 itens × 4 alternativas | Prova ainda futura em 20/11/2026; nenhum gabarito pós-prova |

Ambas as edições declaram **13 grandes áreas do programa** no item 6.8; o Anexo II detalha seus subassuntos. O cutoff de 90 dias é específico da **prova**, não da publicação da norma; uma norma alterada depois do corte pode estar válida hoje e não ser aplicável àquela edição. O sistema ainda precisa provar vigência individual de cada NBC/CPC e leis antes de corrigir respostas.

## Reconciliação sem falsa conclusão

O S23 registra **7 trilhas** (CFC-SUF e seis modalidades EQT), mas **não** estão homologadas 7 ementas individuais. O S23 também possui **26 módulos** de produto, cuja existência técnica e navegação histórica não comprovam conteúdo final.

A matriz `governance/f4_official_source_curriculum_v1.json` cria um **crosswalk candidato** das 13 áreas oficiais para módulos plausíveis já existentes; o mapeamento é uma proposta editorial de navegação, não uma declaração de aula, questão, cobertura de 100% da ementa ou aprovação por especialista. Os módulos transversais sem vinculação direta permanecem contabilizados, não ocultos. **Cobertura curricular aprovada: 0/13; questões licenciadas: 0; matérias externas publicáveis: 0.**

## Processo de promoção futura

`SOURCE_DISCOVERED → SOURCE_PRIMARY_VERIFIED → EDITION_AND_CUTOFF_LOCKED → NORM_VERSION_VERIFIED → ORIGINAL_OR_LICENSED_CONTENT → RIGHTS_DOCUMENT_HASH → SUBJECT_MATTER_EDITORIAL_SIGNOFF → INDEPENDENT_LEGAL_SIGNOFF → BUILD_AND_ACCESSIBILITY_GATE → PUBLISH`.

Qualquer ausência deixa o **item** em HOLD, sem impedir a construção de componentes independentes. FGV/CFC e conteúdo histórico em quarentena continuam em `HOLD_RIGHTS`. Nenhum dado foi escrito no Supabase; F8 só depois do aceite de F1–F7.

## Validação

`python3 tools/f4_official_source_curriculum.py --check` e `python3 -m unittest discover -s tests -p 'test_f4_official_source_curriculum.py' -v`.

Checagens: duas edições exatas, contagem 50×4, corte normativo real (90 dias), 13 áreas e nomes, IDs dos 26 módulos do S23, sete trilhas, sem direitos inventados, sem gabarito da 3/2026 antes da prova, publicação indisponível e assinatura jurídica futura obrigatória.
