# Cânone S7 — continuidade sem duplicar funcionalidades

Esta entrega preserva a linha S1–S6, os 26 módulos, o Design System e o Supabase S5. Inclui nova fronteira de questões em React, conteúdo editorial isolado e portabilidade SQL candidata. **Não habilita operação real**.

- Leia `docs/pmo/MARCO_S7_PORTABILIDADE_JORNADA_CANONICA_2026-11-14.md`.
- Verifique o catálogo: `node backend/contracts/product/generate.mjs --check`.
- Verifique migrations candidatas: `node backend/db/shared-host/port-sql.mjs --check`.
- Teste SQL e UI: `node --test backend/db/shared-host/tests/*.test.mjs app/tests/*.test.mjs`.
- Teste todas integrações offline: consultar CI `.github/workflows/canone-metadata-gate.yml`.
- A release estrita DEVE ser recusada: `node backend/integrations/canonical-knowledge/generate.mjs --check --strict-release`.
- 002–007 em `backend/db/shared-host/generated/REVIEW_ONLY_*` são apenas projeções. **NÃO aplicar no Supabase**.
- Todo o banco de questões editorial S6 ainda não homologado está em `extras/editorial-review/`. O frontend só exibe duas fixtures sintéticas, jamais corrigir questões normativas reais no navegador.
- Preview Vercel S7 protegida: `https://canone-contabilidade-preview-oj49ktmc8-leivisml-7739s-projects.vercel.app`.
- Supabase `pgsybzggewhinaniybiy`: sem alteração S7, 14 schemas reservados S5, 4 tabelas de controle S5, 30 migrations operacionais pendentes.

A próxima S8 precisa de **PostgreSQL isolado real** para migrações/RLS e homologação humana do corpus, antes de conectar o backend. Não conectar o aplicativo ao banco compartilhado por chave de serviço/secret no browser.
