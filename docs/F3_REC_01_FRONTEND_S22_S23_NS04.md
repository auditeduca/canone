# F3-REC-01 — crosswalk de preservação S22 → S23 → NS-04

Corte: 20/11/2026. **Inventário, não homologação.** Gate de produção: **NO_GO**.

O catálogo S22 React contém 26 IDs reconciliados com S23 (prioridade e fase). A aplicação `source-s22/app/src/App.tsx` apresenta os módulos pela rota genérica `#/modulo/:id`, usando `ModuloPage`. Os arquivos de telas especializadas preservados não estão montados nessa rota. Identificamos **19 módulos com referência a componentes específicos** e **7 sem referência nos cinco arquivos analisados**. Referência textual não prova implementação nem interface operacional.

A experiência `#/jornada` no React S22 já utiliza `ExamQuestion` sem gabarito; a nova NS-04 `frontend/student/` demonstra estados e teste de navegador, mas não foi integrada ao React. O backend NS-03 provou fluxo HTTP→PG17 com autenticação **sintética**, não instalação do Supabase. O catálogo público S22 consulta views sem gabarito.

## Módulos P0: preservar antes de recriar

| ID | Módulo | Código histórico candidato | Condição |
|---|---|---|---|
| simulados | Simulados | `PersonalPractice.tsx` | Prévia ou não montado; requer validação |
| flashcards | Flashcards | `LocalModules.tsx` | Prévia ou não montado; requer validação |
| plano-de-estudos | Plano de Estudos | `LocalModules.tsx` | Prévia ou não montado; requer validação |
| reposicao | Banco de Dados de Questões | `PersonalPractice.tsx` | Prévia ou não montado; requer validação |
| caderno-erros | Caderno de Erros | `LocalModules.tsx` | Prévia ou não montado; requer validação |
| dashboard | Dashboard de Aprovação | `LocalModules.tsx` | Prévia ou não montado; requer validação |

O [manifesto JSON](../inventories/frontend/CANONE_F3_S22_S23_NS04_CROSSWALK.json) contém os 26 módulos, releases, prioridade, referências e hashes Git das fontes. O validador Python detecta deriva de conteúdo e declarações incorretas de integração.

## Execução controlada

1. F3-REC-02: rodar `npm ci`, TypeScript/Vite e regressões React S22 em job isolado do GitHub Actions, sem editar `source-s22/` (389 hashes permanecem imutáveis).
2. F3-REC-03: reaproveitar design system, navegação e `ExamQuestion`; migrar com rastreio o fluxo NS-04 para a aplicação React canônica.
3. F3-REC-04: criar contratos seguros de catálogo, itens e progresso; browser→gateway→PG17 com controle de acesso e gabarito no servidor.
4. F3-REC-05: E2E desktop/mobile, A/B, WCAG, segurança, licenciamento editorial e persistência real.

Nenhum projeto Supabase foi alterado. Supabase permanece F8; conteúdo jurídico/editorial exige liberação individual. A estimativa genérica de 30% não representa avanço acumulado auditado.
