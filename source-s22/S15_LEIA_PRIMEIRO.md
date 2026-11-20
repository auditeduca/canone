# Cânone V9 — S15: ferramentas locais, sem backend (NO-GO)

Data: 14/11/2026. Base: branch local S14 `5ee7d60a5e8f1ffa02587f87c6e5de92a0ce64ab`.

## O que existe

Oito rotas novas reutilizam dois núcleos, sem sessão autenticada ou persistência:
- `#/modulo/flashcards`: criar, virar, listar e excluir cartões de autoria do usuário;
- `#/modulo/caderno-erros`: registrar dúvidas e revisões próprias, sem atribuir erro via gabarito;
- `#/modulo/plano-de-estudos`: criar, concluir e excluir blocos, com minutos e percentual transitório;
- `#/modulo/diario-e-razao`: registros sintéticos de débito e crédito e razão simplificado;
- `#/modulo/laboratorio`: mesma base do diário e geração de lançamentos sintéticos;
- `#/modulo/dre-interativa`: resultado didático receitas menos despesas do mesmo diário;
- `#/modulo/balanco-3d`: demonstração bidimensional, **sem renderizador 3D**;
- `#/modulo/dashboard`: painel provisório da sessão, **não é Dashboard de Aprovação**.

Os módulos de cálculos financeiros S14 permanecem intactos. Todas as demais rotas continuam preservadas no `App` anterior. A instalação de dependências não concluiu no container e **build TSX, smoke browser e publicação Vercel desta S15 ainda NÃO foram confirmados**.

## Restrições

- Somente protótipos didáticos: nenhum conteúdo normativo foi homologado, nenhum lançamento é real.
- Sem `fetch`, Supabase, login, pagamento ou armazenamento permanente nessas ferramentas.
- Nenhum resultado é nota, certificado, diagnóstico, aprovação ou contabilidade conforme CPC/IFRS.
- O motor único de avaliação existente no backend não foi alterado nem duplicado.
- 30 migrations originais permanecem intactas; PostgreSQL real ainda não homologado.
- Publicação comercial NO-GO, gates humano, segurança, jurídico e conteúdo preservados.

## Comandos

Da raiz do projeto:

```bash
node --experimental-strip-types --test app/tests/*.test.mjs
node --experimental-strip-types --test backend/db/shared-host/tests/*.test.mjs
cd app && npm ci && npm run build
```

Não prossiga para deploy sem build e smoke de frontend da nova versão.
