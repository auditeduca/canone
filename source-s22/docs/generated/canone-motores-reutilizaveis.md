# Cânone — motores compartilhados e autoridade única

Gerado de `backend/contracts/product/catalog.v1.json`. **Não constitui implementação dos motores nem GO de produto.**

| Motor único | Módulos consumidores | Autoridade de código | Evidência de implementação |
|---|---:|---|---|
| content-projection | 10 | `backend/integrations/canonical-knowledge/engine.mjs` | `PARTIAL_INFRASTRUCTURE` |
| evidence-lineage | 0 | `backend/integrations/canonical-knowledge/engine.mjs` | `PARTIAL_INFRASTRUCTURE` |
| item-bank | 7 | `backend/src/areas/subscriber/provas.ts` | `PARTIAL_BACKEND` |
| exam-attempt | 4 | `backend/src/areas/subscriber/provas.ts` | `PARTIAL_BACKEND` |
| srs-review | 2 | `backend/db/migrations/012_srs_engine.sql` | `DDL_NOT_APPLIED` |
| learning-plan | 1 | `backend/db/migrations/006_learning_items.sql` | `DDL_NOT_APPLIED` |
| progress-analytics | 4 | `backend/src/areas/subscriber/progresso.ts` | `PARTIAL_BACKEND` |
| concept-graph | 10 | `backend/integrations/canonical-knowledge/engine.mjs` | `EMPTY_CORPUS` |
| accounting-simulation | 4 | `A definir` | `PLANNED` |
| calculation-core | 2 | `A definir` | `PLANNED` |
| case-workflow | 4 | `A definir` | `PLANNED` |
| media-player | 2 | `A definir` | `PLANNED` |
| social-challenge | 1 | `A definir` | `PLANNED` |
| adaptive-selector | 1 | `A definir` | `PLANNED` |
| offline-sync | 1 | `A definir` | `PLANNED` |

**Regra de não concorrência:** um serviço por capacidade; módulos compõem o mesmo motor através de contratos. O pacote editorial/normativo tem autoridade separada do catálogo de produto; o DB ainda não recebeu as 30 migrations.

**Gates globais obrigatórios:** evidence-lineage, identity/authorization, entitlements, audit/logging, accessibility.

**Aliases pendentes:** reposicao → banco-questoes (sem renomeação automática); videodulas → videoaulas (sem renomeação automática).

**Status:** `HOLD_HUMAN_NO_GO`.
