# F3-REC-01 — **correção da auditoria de rotas (20/11/2026)**

## Achado crítico: 26/26 módulos já possuem rota especializada S22

A análise inicial havia inspecionado `src/App.tsx` isoladamente e informado, incorretamente, que as páginas especializadas não estavam montadas. **O roteador efetivo é `source-s22/app/src/main.tsx`**, que intercepta `#/modulo/:id` e monta os motores locais das telas antes do `App` genérico. Foram identificados:

| Roteador | Módulos | Componente React |
|---|---:|---|
| LOCAL_IDS | 8 | LocalModules |
| KNOWLEDGE_IDS | 4 | KnowledgeModules |
| WORKBENCH_IDS | 5 | StudyWorkbenches |
| LAB_IDS | 5 | PreviewLabs |
| Simulados/Banco de Questões | 2 | PersonalPractice |
| Calculadoras/Matemática | 2 | FerramentasFinanceiras |
| **Total** | **26/26** | **Rotas de código existentes** |

A existência de rota e código **não** equivale a conteúdo oficial, persistência entre dispositivos, autenticação, gabarito protegido para a experiência completa, pagamento ou homologação de produção.

Essa correção substitui os números anteriores "19 candidatos / 7 catálogo apenas / 0 rotas" **como caracterização de rotas**. Preserva-se a matriz original de prioridade S23 e os hashes dos arquivos. A prova de compilação e **195/195 testes** continua válida em [CI #44697112319](https://github.com/auditeduca/canone/actions/runs/44697112319).

O [JSON de crosswalk v2](../inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json) identifica para cada módulo o roteador e componente real. O validador compara `main.tsx`, listas de IDs dos motores, catálogo S23, hashes Git e impede alegar homologação.

## Próxima integração P0

Reutilizar o `ExamQuestion` e design system S22, sem alterar os arquivos recuperados. A NS-04 poderá oferecer um adaptador de jornada React autenticada **somente em serviço local de teste**, com gabarito exclusivamente no servidor. A porta atual `#/jornada` é demonstração sem backend; não confundir com o novo contrato integrado. O catálogo real/questões autorizadas ainda requer endpoint protegido.

Gate **NO_GO**; Supabase exclusivo F8.
