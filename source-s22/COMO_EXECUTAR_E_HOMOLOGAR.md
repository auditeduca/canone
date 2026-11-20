# Como usar o pacote integral V9

## Estrutura

- `app/`: frontend React/Vite (fontes tipográficas binárias não incluídas; consultar `app/public/fonts/README_ATIVOS_NAO_DISTRIBUIDOS.md`).
- `backend/src/`: código TypeScript do backend e APIs.
- `backend/db/migrations/`: 30 migrations SQL originais.
- `backend/integrations/`: pipeline Audit Educa, canonização, metadados, Storage e Senado.
- `.github/workflows/`: CI offline preparada; só atua de fato quando o código estiver em um repositório remoto com checks configurados.
- `docs/pmo/`: cronologia V5–V9 e pendências da V1.
- `docs/evidencias/`: logs da verificação realizada para este ZIP.
- `extras/`: patch incremental V8→V9, para auditoria; não aplicar sobre este código já atualizado.

## Instalação local com Node e npm

Recomendado: ambiente isolado de desenvolvimento, sem credenciais de produção, com acesso confiável a dependências e versões lockfile.

```bash
cd backend
npm ci
npm run typecheck
npm test
npm run meta:check
npm run canonical:check
npm run senado:articles
npm run senado:source-check
# Não executar migrations com apontamento a uma base compartilhada.

cd ../app
npm ci
npm run typecheck
npm run build
npm run dev
```

**Atenção**: a sequência de comandos não foi integralmente homologada neste ambiente. Os 14 arquivos clássicos de teste necessitam de `@electric-sql/pglite`; os pacotes não são distribuídos em `node_modules`. Se faltar dependência, configurar um registry npm autorizado e executar `npm ci` novamente antes de atribuir falha ao produto.

`backend/package.json` inclui comandos que podem **modificar o banco**, como `migrate` e `db:reset`. Não executá-los sem confirmar target, backups, papéis e homologação isolada.

## Segurança

Não informar `VITE_COMANDER_TOKEN` (ou outras credenciais) em variáveis públicas do frontend. O código anterior possui esse caminho: pendência P0. Nenhum comando deste pacote cria projeto Supabase/Vercel ou efetua deploy automaticamente.

## Reproduzir a auditoria de integridade

Em ambiente com Python 3:

```bash
python3 tools/verificar_pacote.py
```

Ver instruções detalhadas e critérios de aceite em `docs/pmo/PENDENCIAS_CONSOLIDADAS_V9_2026-11-14.md` e `docs/pmo/PENDENCIAS_CONSOLIDADAS_V9_2026-11-14.csv`.


## S4 — build e preflight reproduzíveis

- Na raiz: `node app/scripts/check-preview-security.mjs`; em seguida `node --test app/tests/check-preview-security.test.mjs`.
- Com acesso ao registry npm: `cd app && npm ci && npm audit --audit-level=high && npm run build`. O comando de build executa `tsc --noEmit && vite build`; não desabilitar a checagem TypeScript.
- Para normativos e backend, executar os testes e gates conforme `docs/pmo/MARCO_S4_VITE6_AUDITORIA_LOCKFILE_2026-11-14.md`; o PostgreSQL isolado continua indisponível e **nenhuma migration deve ser aplicada ao banco compartilhado**.
- A URL da prévia tem SSO habilitado. Teste de HTTP 200 não comprova funcionalidades dentro do navegador. Não ativar backend, autenticação por cookie ou pagamentos sem homologação.
