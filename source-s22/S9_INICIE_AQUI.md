# Cânone — continuidade S9 (14/11/2026)

## O que mudou de fato

1. O backend agora exige direito de acesso vigente **em todas as seis rotas do assinante**, incluindo responder, finalizar e revelar. `backend/src/http/api.ts` usa um único wrapper `comAssinante`, no mesmo contexto transacional de `canone_subscriber`.
2. Sessões de contas `bloqueado`, `excluido`, `anonimizado`, removidas ou temporariamente bloqueadas não são resolvidas. O magic-link não reativa tais contas.
3. A interface HTTP rejeita origem não autorizada e payload JSON maior que 64 KiB.
4. Foram acrescentados 26 testes rápidos de contrato/recusa e três cenários adversariais ao teste HTTP com banco real em PGlite. A infraestrutura de CI passou a compilar o backend e executar o gate S9.
5. O frontend S8 continua usando o mesmo componente único `ExamQuestion` e o mesmo Design System, sem novo gabarito ou motor concorrente.

## Comprovações

- Offline/local: **203 PASS**, incluindo os 26 novos testes; sem banco local instalado.
- Remoto/Vercel (QA de build): **38 PASS, 0 FAIL**, TypeScript compilado, 30 migrations originais aplicadas em PGlite efêmero, HTTP de teste sem credenciais reais e build Vite 6.4.6 aprovado.
- Preview READY (SSO e `noindex`): https://canone-contabilidade-preview-ofnuex6vs-leivisml-7739s-projects.vercel.app/#/jornada
- Escopo Vercel: o código do backend foi **usado nos testes do build, não publicado como API**. `/api/health` e `/s9qa/backend/*` retornam 404.
- Supabase `Calculadoras-Smart`: 14 schemas `canone_*`, 4 tabelas de controle, **30 migrations operacionais NÃO aplicadas**, zero `USAGE` por `anon`, `authenticated` ou `service_role` nos schemas exclusivos.

## Como reproduzir em ambiente com acesso ao npm

```bash
cd backend
npm ci
npm run test:s9
npm audit --audit-level=high
```

Para os checks canônicos adicionais a partir da raiz:

```bash
node backend/contracts/product/generate.mjs --check
node backend/db/shared-host/port-sql.mjs --check
node backend/integrations/metadata-auto/generate.mjs --check
node backend/integrations/canonical-knowledge/generate.mjs --check
```

## Gates não liberados

- `NO-GO` para produção, pagamentos, acesso real de assinantes e conteúdo normativo não homologado.
- O backend existente ainda devolve Bearer em JSON; migração para cookie HttpOnly/Secure/SameSite + CSRF e hardening de sessão aguarda projeto operacional de backend e homologação.
- PGlite de QA **não comprova** portabilidade para os 14 schemas `canone_*` no PostgreSQL 17 compartilhado; os papéis e views `SECURITY DEFINER`/RLS exigem testes específicos e revisão de owner.
- Nenhuma migration operacional, seed, autenticação ou conteúdo foi aplicada ao Supabase nesta etapa.
- Fontes tipográficas originais permanecem indisponíveis para distribuição; a prévia usa fallback.
- O GitHub remoto permanece sem push; o bundle permite recuperação em clone limpo.

**Regra:** um motor de tentativa, um catálogo canônico, Design System preservado, sem autopromoção de conteúdo/produção.
