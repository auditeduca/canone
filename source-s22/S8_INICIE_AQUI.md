# Cânone S8 — publicação protegida e jornada de questões

1. Abra `docs/pmo/MARCO_S8_JORNADA_INTERATIVA_2026-11-14.md`.
2. Use a prévia https://canone-contabilidade-preview-20gwg2ftu-leivisml-7739s-projects.vercel.app/#/jornada
3. Código de UI: `app/src/screens/Jornada.tsx` + `app/src/ui/learning/preview-session.ts`.
4. Motor real (não conectado): `backend/src/areas/subscriber/provas.ts` e migrations 001–030.
5. Testes: `node --experimental-strip-types --test app/tests/preview-journey-s8.test.mjs`.
6. Gate canônico estrito **deve** recusar: `node backend/integrations/canonical-knowledge/generate.mjs --check --strict-release`.
7. A S8 não escreve em Supabase. As 30 migrations funcionais permanecem catalogadas e não aplicadas.
