> **Continuidade S9 (14/11/2026):** backend com gate único nas seis rotas de assinante, revogação de conta/sessão, 203 testes offline e 38 testes remotos PostgreSQL/PGlite em `READY` protegido. Frontend demonstrativo S8 preservado; **backend operacional e liberação comercial permanecem NO-GO**. Leia [S9_INICIE_AQUI.md](S9_INICIE_AQUI.md).

# Cânone — baseline candidata à integração

Repositório **local** criado dos pacotes fornecidos para preparar a branch de conclusão.

- `app/`: site React/Vite/TypeScript.
- `backend/`: banco, motor de provas, HTTP, testes e migrations.
- `docs/`: PMO e confronto com conexões reais.

**Atenção:** não aponta para Supabase ou Vercel de produção. Os builds e testes relatados nos manifestos não constituem homologação deste bundle.

## Condições antes de integrar
1. Identificar o repositório remoto exclusivo do Cânone.
2. Criar ou selecionar ambiente Supabase exclusivo e não aplicar migrations em bases compartilhadas.
3. Configurar Vercel Preview com Root Directory `app`, framework Vite.
4. Corrigir riscos P0, inclusive token administrativo em variável pública.
5. Aprovar os gates do plano PMO.

## Metadados governados / atualização automática (marco 14/11/2026)

- `backend/integrations/metadata-auto/`: gerador único de metamodelo, dicionário por coluna, grafo de relações, crosswalk e artefatos tipados.
- `backend/integrations/audit-educa/intake-candidates.mjs`: o lote agora é recusado ANTES de salvar candidatos se o grafo cruzado estiver inconsistente.
- `backend/integrations/metadata-auto/ddl/`: SQL de proteção referencial para banco Cânone isolado; **não aplicado remotamente**.
- `docs/pmo/MARCO_METADADOS_AUTOMATICOS_2026-11-14.md`: relatório e pendências de homologação.
- `backend/package.json`: `npm run meta:generate`, `npm run meta:check`, `npm run meta:test` (os dois últimos não requerem conexão com Supabase).

A biblioteca opcional de introspecção `pg-structure@7.15.3` encontra-se declarada no sidecar, porém o registro npm não pôde ser acessado para instalá-la e gerar seu lockfile; portanto o gate `--live` permanece **HOLD_DEPENDENCY**. O gerador offline foi executado sobre metadados parciais efetivamente observados no Supabase, com identificações explícitas de campos ainda não introspectados.

## Regra central de canonização normativa e editorial

O `metadata-auto` trata integridade física de tabelas, **não é fonte semântica**. O núcleo de conhecimento é `backend/integrations/canonical-knowledge`: toda afirmação de domínio decorre de documento normativo ou editorial preservado, trecho literal SHA-256, átomo, afirmação canônica e conceito. O editorial não substitui fonte normativa para obrigações. Dicionário de conceitos, contratos e metamodelo semântico são gerados, com gates `canonical:check` e `canonical:test`. Nenhum conteúdo é promovido sem fonte e revisão. Consultar `docs/pmo/REVISAO_CANONICA_NORMATIVA_EDITORIAL_2026-11-14.md`.

## Marco 4 — corpus real e cadeia de evidência (14/11/2026)

- Read-only do Supabase: 249 extrações com 3 hashes, 24.385 unidades normalizadas, 24.385 assertivas candidatas, **0** claims semânticos materializados. 5 controles cruzados sem divergências.
- Bridge v2: 13 objetos de origem (somente candidatos); `canonical-corpus` com prontidão de publicação e arquivo privado de original/extraído.
- Proibido criar conceito canônico ou promover questão sem PDF/HTML original atestado, versão, atomização literal, revisão e direitos.
- Testes unitários integrados executados neste marco: 62/62; sem teste real de PostgreSQL no Cânone.
- Entrega de código é **local**, não significa branch remota GitHub ou deployment Vercel.
- Ver `docs/pmo/MARCO_CANONIZACAO_ACERVO_REAL_2026-11-14.md`.

### Marco V5 — Recuperação autenticada do corpus real

A auditoria ao Supabase localizou 249 PDFs originais, 249 textos derivados e 249 máscaras
em `ingest-private`, com vínculos e tamanhos compatíveis; **bytes ainda não baixados
nem validados neste ambiente**. A recuperação, a comparação de hashes reais e a fila
normativa/editorial são implementadas em `backend/integrations/canonical-corpus/`.
Leia `STORAGE-RECOVERY-V5.md` antes de executar. Nenhuma etapa autoriza publicação.

## Marco V6 — piloto estratificado e bloqueio de recuperação integral

A seleção de cinco documentos do acervo real por estratos de tamanho está documentada em
`docs/pmo/MARCO_V6_PILOTO_E_GATES_2026-11-14.md`, com SQL reproduzível em
`backend/integrations/canonical-corpus/metadata-reconciliation.v6.sql`.
O pipeline de Storage **revalida os bytes arquivados do piloto** antes de aceitar `--all`.
Sem os cinco trios reais verificados, o comando falha antes de tentar a recuperação completa.
Nenhum documento privado deve ser incluído em Git. A homologação semântica e o release seguem `HOLD_HUMAN`.


### Atualização V8 — Senado Federal

- Respostas HTTP JSON originais são preservadas byte a byte em `backend/.local-bridge/senado/`, e `senado:verify` reabre e valida o SHA-256 sem modificar o estado de publicação.
- Relações Lei 11.638/2007 → Lei 6.404/1976 e Lei 12.249/2010 → DL 9.295/1946 têm escopos **candidatos** por artigo, bloqueados até atomização e revisão.
- Ver `docs/pmo/MARCO_V8_SENADO_PROVENIENCIA_2026-11-14.md`.

## Marco S3 — HTTP real e pacote saneado (14/11/2026)

A prévia Vercel S2 de destino confirmou HTML/JS/CSS `HTTP 200`, com SSO `all` e `noindex`.
Não há backend em `/api/health` (`404`) nem fontes self-hosted disponíveis (`404`).
A fonte do Design System (tokens CSS, tipografia declarada e fallbacks) permanece
sem alteração; **os nove binários WOFF2 foram excluídos da exportação compartilhável
(e do histórico Git saneado) até comprovação dos direitos**. Ler
`docs/pmo/MARCO_S3_HTTP_SEGURANCA_GIT_2026-11-14.md` e
`docs/evidencias/S3_HTTP_SMOKE_2026-11-14.json`. A aplicação não foi
homologada em navegador; o release continua `HOLD_HUMAN_NO_GO`.

## Marco S4 — Segurança e prévia Vercel (14/11/2026)

- **Prévia protegida:** https://canone-contabilidade-preview-7mvx8h4uk-leivisml-7739s-projects.vercel.app
- Build remoto `npm ci` + `tsc --noEmit && vite build` **READY**, com `npm audit` reportando **0 vulnerabilidades** no frontend em 14/11/2026.
- Lockfile reproduzível com `vite@6.4.6`, `playwright@1.55.1` e `playwright-core@1.55.1`; nove testes novos de segurança e onze checks do preflight aprovados.
- O frontend permanece estático: sem backend, banco, login operacional, checkout ou fontes tipográficas binárias homologadas.
- A prévia tem `X-Robots-Tag: noindex, nofollow, noarchive` e Vercel Authentication; **não** significa aprovação para produção.
- O gate estrito continua `HOLD_HUMAN_NO_GO`; `docs/pmo/MARCO_S4_VITE6_AUDITORIA_LOCKFILE_2026-11-14.md` explica as pendências.
- O repositório GitHub exclusivo ainda não foi criado e a Supabase recusou o banco isolado por limite de projetos gratuitos ativos.

Verificação offline da variante de prévia: `node app/scripts/check-preview-security.mjs` e `node --test app/tests/check-preview-security.test.mjs`.
O build no ambiente com npm disponível: `(cd app && npm ci && npm audit --audit-level=high && npm run build)`.

## S6 — catálogo único de produto e fábrica de funcionalidades

A declaração canônica de produto agora é `backend/contracts/product/catalog.v1.json`, fonte **única** dos 26 IDs de módulos, suas fases, ícones e 15 motores reutilizáveis. `app/src/content/modulos.ts` é arquivo **gerado**, não deve ser editado à mão. `backend/contracts/product/feature-template.v1.json` é o template único de sete gates por módulo. Nenhum módulo novo é publicado apenas por existir no catálogo.

```bash
node backend/contracts/product/generate.mjs --check
node --test backend/contracts/product/tests/*.test.mjs
# Após alteração aprovada no catálogo:
node backend/contracts/product/generate.mjs --write
```

Leia `backend/docs/adr/0008-fabrica-canonica-de-modulos.md` e `docs/pmo/MARCO_S6_FABRICA_CANONICA_2026-11-14.md`. As 30 migrations funcionais do S5 continuam não aplicadas ao Supabase compartilhado; o conteúdo normativo permanece em HOLD_SOURCE e a produção em NO_GO.

## Marco S7 (14/11/2026)

Consulte `S7_INICIE_AQUI.md` e `docs/pmo/MARCO_S7_PORTABILIDADE_JORNADA_CANONICA_2026-11-14.md`. 178 testes offline PASS, Vercel Preview protegida com TypeScript PASS, seis migrations 002-007 geradas exclusivamente para revisão; nenhuma execução no Supabase. Gate `NO-GO` preservado.
