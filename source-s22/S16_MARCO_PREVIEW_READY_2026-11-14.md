# Cânone V9 — Marco S16 (prévia técnica)

Data da execução: 2026-11-14. Fonte anterior: `work/canone-s15-local-study-ledger` em `9dc444b432b66b718489a04d61a3b1cfe7d12d61`.

## Implementação efetiva

- Quatro novas ferramentas de conteúdo **autoral do usuário**: Mapas Mentais (`mapas-mentais`), Guia de Bolso (`guia-de-bolso`), Glossário (`glossario`) e Casos Práticos (`casos`).
- Motor local reutilizável de texto, hierarquia, validação, remoção recursiva e agrupamento de dados, em `app/src/tools/personal-knowledge.ts`.
- Editor reutilizável em `app/src/screens/KnowledgeModules.tsx`: inclusão, exclusão, organização, filtro por texto e exportação JSON local.
- Compartilhamento do estado de sessão S15 entre rotas no `app/src/main.tsx`, eliminando reinicialização das listas, tarefas e diário na simples navegação.
- Sem conteúdo normativo, gabarito oficial, pontuação de exame, dados reais, rede, cookies ou persistência. **Conteúdo da própria pessoa, não homologado**.
- Demais 22 rotas do catálogo permanecem; quatro rotas foram adicionadas funcionalmente sem alterar a fonte única do catálogo.

## Testes e integridade

- Comando: `node --experimental-strip-types --test app/tests/*.test.mjs backend/db/shared-host/tests/*.test.mjs`.
- **111 testes PASS**, **0 FAIL**, sendo 20 casos novos S16.
- As **30 migrations originais** de `backend/db/migrations/` não foram modificadas em relação à versão S15.
- Fonte do frontend Vercel **51/51 arquivos SHA-1 idênticos** ao Git local, sem faltantes ou excedentes.
- `npm ci` em ambiente local excedeu tempo; compilação TypeScript/Vite confirmada **no build remoto Vercel**, não local.

## Prévia publicada e inspecionada

- Projeto `canone-contabilidade-preview`, ID `prj_VjM86IFWl2Ox01FogfnRvBqNOIxN`.
- Deployment `dpl_32fbJxtBy8wP24BTe4wEadbLGNkj`.
- URL: `https://canone-contabilidade-preview-i75mc6arc-leivisml-7739s-projects.vercel.app`.
- Target `null`: **preview**, sem promoção à produção.
- Vercel `READY`; build `tsc --noEmit && vite build`, **59 módulos transformados**, **9 avisos de fontes não fornecidas**, nenhum erro de compilação.
- GET `/`, JS e CSS principais: HTTP 200. GET `/api/health` e `/s11qa/backend/db/migrations/002_identity_lgpd.sql`: HTTP 404.
- `ssoProtection.enabled=true`, `deploymentType=all`; `x-robots-tag: noindex,nofollow,noarchive`.
- Nenhuma alteração operacional no banco Supabase. Nenhum push do GitHub ou liberação comercial.

## Estado final e limitações

- **14/26** módulos têm alguma ferramenta de prévia interativa. **0/26** homologados comercialmente.
- Os 12 módulos restantes dependem de conteúdo revisado, motores canônicos ou multimídia: simulados, simulado-adaptativo, duelo, banco de questões, contabilidade ilustrada, CPC visual, auditoria prática, perícia, contabilidade pública, podcast, videoaulas e offline.
- Interações completas E2E em navegador e PostgreSQL real **não executados** nesta etapa.
- Gates: `FRONTEND_PREVIEW_READY`, `BACKEND_DB_HOLD`, `CONTENT_HOLD_HUMAN`, `COMMERCIAL_NO_GO`.

## Próxima entrega S17

Priorizar fonte canônica de conteúdos e motor único de avaliações, com questões e alternativas cujos gabaritos possuam proveniência revisada; executar migrações e RLS em PostgreSQL descartável antes de habilitar autenticação, ranking, assinaturas ou resultados oficiais.
