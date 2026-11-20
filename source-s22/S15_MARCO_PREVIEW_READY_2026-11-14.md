# Cânone S15 — evidências de publicação na Vercel

Data: 14/11/2026. Projeto Vercel `prj_VjM86IFWl2Ox01FogfnRvBqNOIxN` (`canone-contabilidade-preview`).

## Implantação canônica

- URL: https://canone-contabilidade-preview-36hebt49n-leivisml-7739s-projects.vercel.app
- Deployment: `dpl_VBv65FLscGFaps9gR5vMYizbuFbW`
- Status observado via Vercel: **READY**.
- Target: `null` — prévia, não produção.
- Autenticação Vercel: `ssoProtection.enabled=true`, `deploymentType=all`.
- Arquivos fonte do frontend: **48/48 com SHA-1 idêntico** aos arquivos `app/` do commit `b774ae7a1fba403ae0e6292cddd5dbb85e2f53cb`.
- Build `npm ci` + `tsc --noEmit` + `vite build`: **PASS**. 57 módulos transformados, 0 vulnerabilidades reportadas e 9 avisos de fontes ausentes.
- HTTP GET `/`, `/assets/index-Ch_TD0XA.js`, `/assets/index-BZzbT_5O.css`: **200**.
- GET `/api/health` e `/s11qa/backend/db/migrations/002_identity_lgpd.sql`: **404**.
- Cabeçalhos de CSP e `x-robots-tag: noindex,nofollow,noarchive`: presentes.

## Escopo

- 8 novas rotas locais S15: flashcards, caderno de erros, plano de estudos, diário/razão, laboratório, DRE, balanço 2D e painel transitório.
- 2 rotas S14 preservadas: calculadoras contábeis e matemática financeira.
- Os 26 módulos do catálogo continuam; **não há 26 motores homologados**.
- Login operacional, notas, gabaritos oficiais, assinaturas, backend e migrations **não foram publicados**.
- `git push` ao GitHub remoto: **não realizado**. O commit citado identifica a fonte local; não representa commit remoto.
- Não foi executado teste E2E de navegação com navegador completo, nem teste PostgreSQL real.

## Estado de governança

`PREVIEW_READY` apenas para frontend; `PRODUCTION_NO_GO`, `POSTGRES_HOLD_RUNTIME`, `CONTENT_HOLD_HUMAN`.
