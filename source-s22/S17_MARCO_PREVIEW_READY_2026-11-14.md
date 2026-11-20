# Cânone V9 — S17 | Banco autoral de questões e prática local

**Data:** 2026-11-14. **Ambiente:** prévia técnica protegida (não produção).

## Fonte e identidade

- Base canônica: S16, commit `a30f621c94ea4780b185c9dc4fb476a37da0d3e1`.
- Branch local: `work/canone-s17-personal-practice`.
- Contrato do catálogo de 26 módulos não modificado; nenhuma duplicação de Design System.
- Duas rotas interativas novas, presentes no catálogo: `#/modulo/reposicao` (Banco pessoal) e `#/modulo/simulados` (Prática autoral demonstrativa).
- Reutiliza `ExamQuestion`/`ExamProgress` e `Nav`/`Footer` existentes.

## Implementação validada

1. Questões criadas pelo usuário com tema, enunciado, alternativas A/B/C/D e referência livre não verificada.
2. Validações de dados: limites de tamanho, itens não vazios, alternativas distintas, IDs únicos, limite de 60 questões.
3. Sessão de seleção de 1 a 20 questões filtráveis por tema, resumo visual das escolhas, revisão e reinício.
4. Cópias das questões no início da sessão, preservando sua integridade se o banco pessoal for editado.
5. Exportação JSON do banco pessoal (sem nota e sem gabarito).
6. Estado mantido em memória da aba durante a navegação, mas não persiste após reload.

## Limite estrito de autoridade

- **Nenhum** gabarito, nota, acerto/erro, ranking, atestado, certificado ou publicação oficial.
- Fonte de cada questão: `user-authored-unverified`. Referências declaradas pelo usuário são explicitamente **não verificadas**.
- Nenhuma persistência (localStorage, sessionStorage, cookies), autenticação, requisição de rede ou envio ao Supabase nos dois novos componentes.
- Motor oficial de tentativas no backend e RLS não ativados ou alterados.

## Evidências

- `node --experimental-strip-types --test app/tests/*.test.mjs backend/db/shared-host/tests/*.test.mjs`: **138 PASS, 0 FAIL** (27 novos testes S17).
- 30 migrations SQL originais: preservadas, sem diferença em relação à S16.
- Build remoto: `tsc --noEmit && vite build`, Vercel **READY**, 61 módulos transformados. Avisos remanescentes de fontes não distribuídas; sem erros finais.
- Vercel projeto `prj_VjM86IFWl2Ox01FogfnRvBqNOIxN`, deployment `dpl_AVqiMk2pCmMAd3xmDFaLMjqyXP99`.
- URL: https://canone-contabilidade-preview-cdipep8sd-leivisml-7739s-projects.vercel.app
- `54/54` arquivos da fonte reconciliados: 49 SHA-1 iguais ao S16 e cinco arquivos novos/alterados SHA-1 idênticos ao local.
- Verificações HTTP: `/`, JS e CSS **200**; `/api/health` **404**; `/app/src/tools/personal-practice.ts` **404**.
- Proteção Vercel `ssoProtection.enabled=true`, cobertura `all`, HTTP `x-robots-tag: noindex, nofollow, noarchive`.
- O deployment usa upload de arquivos por API, não GitHub; não corresponde a um commit remoto registrado automaticamente.

## GATES

- `FRONTEND_PREVIEW_READY` — **PASS**.
- `SOURCE_PARITY` — **PASS 54/54**.
- `LOCAL_TESTS` — **PASS 138/138**.
- `POSTGRESQL_ISOLATED_UAT` — **HOLD_RUNTIME**.
- `CONTENT_PROVENANCE_AND_HUMAN_APPROVAL` — **HOLD_HUMAN**.
- `AUTH_RLS_PRODUCTION` — **NO_GO**.
- `COMMERCIAL_RELEASE` — **NO_GO**.
- Browser E2E clique-a-clique continua pendente; HTTP 200 não é prova de fluxo de formulário completo.

## Continuidade planejada

S18: acoplar fontes verificadas e trilha editorial das questões ao backend canônico, testar PostgreSQL descartável e RLS; depois homologar avaliação, correção e tentativas antes de ativá-las. Duelo em tempo real e simulado adaptativo continuam sem implementação funcional comercial.
