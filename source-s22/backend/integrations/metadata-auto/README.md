# Biblioteca Cânone Metadata Auto — v1

## Objetivo

Manter **metamodelo observado, dicionário, grafo, crosswalk e gates de integridade** a partir de fonte declarativa ou de introspecção PostgreSQL. Sem editar dicionário, ERD ou contratos manualmente. A geração **não** altera o banco e não autoriza publicação de conteúdo.

## Dependências

- **`pg-structure@7.15.3`**: biblioteca de introspecção de PK, FK (inclusive compostas), colunas, tipos e comentários do PostgreSQL; roda no job privado de catálogo.
- **Node.js (ESM)**: motor `engine.mjs` gera todos os artefatos determinísticos e testa drift com comparação byte a byte.
- **PostgreSQL real**: FKs, CHECKs, UNIQUE, RLS e `FORCE RLS` são enforcement real. SQL opcional de `ddl/` somente em **Cânone isolado**, após migrations 001–030.

`npm ci` do sidecar `metadata-auto` requer lockfile gerado por um runner com acesso ao registry; esta entrega não conseguiu instalar `pg-structure` no ambiente atual (registry indisponível), portanto **a introspecção live da biblioteca ainda não foi executada**. Não declarar este gate como PASS até instalar e testar em homologação.

## Comandos

```bash
# Sem rede, gera a partir do catálogo observado por consultas somente leitura ao Supabase
node backend/integrations/metadata-auto/generate.mjs --write
node backend/integrations/metadata-auto/generate.mjs --check
node --test backend/integrations/metadata-auto/tests/*.test.mjs

# Em runner de integração aprovado (sem VITE_ e apenas acesso read-only):
# cd backend/integrations/metadata-auto && npm install --package-lock-only && npm ci
# CANONE_SOURCE_DATABASE_URL fornecida por secret manager, sem expor valor em logs
node backend/integrations/metadata-auto/generate.mjs --live --check
# Se houver alteração legítima: revisão em PR e geração explícita; nunca promover automaticamente.
```

Os artefatos em `generated/` são somente documentos e tipos. `--check` com divergência retorna exit 4. `--live` com FK inesperada, coluna removida, tabela ausente ou projeto de origem diferente retorna erro e bloqueia a integração. **A ausência de credenciais ou dependência não é PASS**, mas HOLD.

## Fontes, relações e garantia

- `snapshots/supabase-audit-educa-observed.v1.json`: recorte **parcial** do catálogo lido via Supabase em 14/11/2026. Contém 19 FKs reais e três relações lógicas explicitamente não-FK.
- `backend/docs/03-erd.mmd`: ERD Cânone *fornecido no pacote*, declara 90 tabelas e 85 FKs; contagem ainda não reconfirmada sobre Postgres de homologação.
- `../audit-educa/contract.v1.json`: lista fechada de dez tabelas de origem e destinos candidatos.
- `generated/dicionario-dados.csv`: colunas efetivamente observadas, explicitando campo com tipo ainda desconhecido em snapshot parcial.
- `generated/relacionamentos.mmd`: grafo físico/lógico de origem; `generated/integracao-crosswalk.mmd`: mapa origem → destino; `generated/mapa-crosswalk.md`: mapa tabular; `generated/metamodel.generated.json` e `generated/metadata.types.generated.d.ts`: contratos derivados.
- `generated/integrity-gate.generated.json`: bloqueadores de release; os dados remotos **não são automaticamente publicáveis**.

## Matriz de bloqueio

| Camada | Portão fail-closed |
|---|---|
| Estrutura | PK/coluna inexistente, duplicidade de entidade, FK sem alvo, FK não validada, FK de aridade divergente |
| Contrato | origem não autorizada, tabela ausente, chave não declarada, destino Cânone não encontrado |
| Mudança | catálogo físico mudou sem atualização aprovada; gerados divergem do snapshot versionado |
| Ingestão | fonte sem SHA, chave duplicada, direitos normativos não revisados, fonte não comprovada |
| Promoção | sem gabarito oficial ou revisão editorial, entidade `HOLD_HUMAN`, norma com vigência desconhecida |
| Banco Cânone | FK entre crosswalk e destino, UNIQUE e CHECK, RLS + FORCE RLS, grants mínimos |
| CI/Release | testes locais e em PostgreSQL real, drift de catálogo, UAT, aprovação humana |

**Não executar DDL do bridge sobre `Calculadoras-Smart` nem sobre `SOT-10-09-2026`.** Não incluir o schema privado do bridge na Data API. A SQL é uma proposta de implementação, **não aplicada** e ainda sem prova em banco dedicado.

### Correção de classificação física (evidência `pg_catalog`)

Quatro fontes `account_palm` presentes no contrato são **views com `security_invoker=true`**: `master_register`, `entities`, `normative_works` e `regulatory_instruments`. O gerador diferencia `object_kind=VIEW` de `object_kind=TABLE` e recusa PK ou FK física atribuída a uma view. `pg-structure` deve introspectar tanto `schema.tables` quanto `schema.views`; alteração do tipo físico retorna `BLOCKED_OBJECT_KIND_DRIFT`.

Tabelas-base reais: `cko_governance.account_palm_master_register_v1`, `cko_master.entities`, `public.regulatory_instruments`. Essas tabelas NÃO são adicionadas à allowlist do exportador: as views governadas continuam sendo a superfície autorizada de leitura. A interligação é **dependência de view**, não FK e não permissão para UPDATE/DELETE na origem.

O `--live` também utiliza `pg@8.23.1` para checar `pg_catalog.pg_constraint.convalidated`, `pg_class.reloptions` (`security_invoker=true`) e se a definição da view ainda referencia a fonte física esperada. Uma modificação indevida na view bloqueia a pipeline antes de gerar contrato novo.

## Distinção essencial — inventário físico ≠ conhecimento canônico

Este pacote pode certificar PK, FK, views e tipos SQL, **não a validade de uma interpretação contábil**. Seu `metamodel.generated.json` é um **inventário estrutural observado**, e não um metamodelo semântico publicável. A projeção semântica é gerada exclusivamente em `../canonical-knowledge/`, a partir de documentos originais normativos e editoriais preservados, pinpoint em bytes, átomos, claims e conceitos. **Release só pode ocorrer após os dois gates passarem**; a ausência do corpus é HOLD, nunca PASS de conteúdo.
