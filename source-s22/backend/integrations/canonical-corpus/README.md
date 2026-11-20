# Marco 4 — Corpus canônico real (somente candidatos)

**Objetivo:** impedir o salto de `account_palm` e `contabilidade_cfc` para entidades e
conteúdo do Cânone sem prova de preservação, atomização, origem editorial/normativa,
revisão e autorização de uso.

## Dados reais confirmados por SQL somente leitura (14/11/2026)

- `account_palm.normative_extractions`: 249 referências com `raw_sha256`, `text_sha256` e `mask_sha256` registrados; **hash no banco não prova arquivo baixado/revalidado neste ambiente**.
- `account_palm.normalized_units_v1`: 24.385 unidades, `PASS`, `INTERNAL_ONLY`, `canonical_promotion=false`.
- `account_palm.normative_assertion_candidates_v1`: 24.385 registros de features/assertivas provisórias, sem transformação em afirmação canônica aprovada.
- `account_palm.normative_claim_candidates_v1`: **0 registros**.
- `contabilidade_cfc.questions`: 50 questões, gabarito oficial ainda não verificado na origem.
- 5 verificações SQL de integridade referencial/identidade/hash produziram 0 inconsistências no momento da consulta.

## Funcionamento

1. `node ../audit-educa/export-readonly.mjs --execute`: com segredo `CANONE_SOURCE_DATABASE_URL` e usuário estritamente de leitura, gera arquivos NDJSON em `backend/.local-bridge/export` e manifesto de hashes em snapshot `REPEATABLE READ READ ONLY`.
2. `node ../audit-educa/intake-candidates.mjs --execute`: valida contagens/hashes e relações cruzadas; gera candidatos e `evidence-queue.json` **apenas no diretório local privado**, sempre `HOLD_HUMAN`.
3. `node readiness-cli.mjs --execute --input ../../.local-bridge/candidates/candidates.ndjson --report ../../.local-bridge/candidates/corpus-readiness.json`: produz cobertura sem exibir questões ou gabaritos.
4. `node archive.mjs --execute --input ../../.local-bridge/source-pair.json`: preserva arquivo original e derivado de extração separados em diretório local privado. Requer manifesto operador com caminhos locais e identidades oficiais/editoriais e, opcionalmente, `spans` explícitos do texto extraído.
5. `node ../canonical-knowledge/generate.mjs --check --strict-release`: ainda retorna bloqueio esperado porque o grafo de produção não possui evidências homologadas. **Nunca mudar esse comportamento para aceitar corpus vazio**.

### Manifesto do par original/derivado (modelo de contrato, não prova real)

```json
{
  "source_id": "CFC-NBC-IDENTIFICADOR-CONFIRMADO",
  "source_kind": "NORMATIVE",
  "source_uri": "https://dominio-oficial/arquivo.pdf",
  "source_version": "VERSAO-VERIFICADA",
  "title": "Titulo comprovado",
  "publisher": "CFC",
  "authority": "CFC",
  "original_format": "application/pdf",
  "original_path": "../../.local-bridge/source.pdf",
  "extracted_text_path": "../../.local-bridge/extraction.txt",
  "extractor": "nome-da-ferramenta",
  "extractor_version": "versao-exata",
  "expected_original_sha256": "64 hex do arquivo realmente preservado",
  "expected_text_sha256": "64 hex do texto extraido realmente preservado",
  "spans": []
}
```

> **Atenção ao PDF:** o offset de texto está sempre na extração UTF-8 versionada; a ligação ao PDF é feita pelo digest do original, versão, método e localizador (ex.: página). Byte offset no PDF não é sinônimo de posição de texto. O exemplo acima contém placeholders, nunca preenchê-los com valores inventados.

## Estados e autoridade

- `NORMATIVE`: documentos normativos oficiais e vigentes; só originam afirmações normativas após confirmação de texto/versão/vigência/direitos/revisão.
- `EDITORIAL`: prova CFC, explicações, artigos, material autoral. Um documento publicado por entidade oficial não é automaticamente uma *norma*.
- `MIXED`: exige átomos normativos e editoriais distintos, com relação declarada e revisão humana.
- `PHYSICAL_METADATA`: PK/FK/DDL vêm do catálogo PostgreSQL, sem falsa atribuição de autoridade a uma norma contábil.
- `TECHNICAL_ADR`: infraestrutura e UI vêm de decisões técnicas versionadas e testadas, sem criar conceitos normativos inexistentes.

## Links de verificação oficial

`source-registry.v1.json` guarda somente links e classificações da prova CFC 2022.1 (branca) e gabarito **preliminar**. A prova 2022.2, mesmo que o arquivo se chame `TIPO 01 BRANCA`, é outro exame. Gabarito 2022.2 não pode ser copiado para 2022.1. Não há gabarito final importado ou conteúdo liberado.

## Segurança

- Nenhuma conexão remota é iniciada por padrão.
- Exportação remota usa `READ ONLY` e dados privados são ignorados pelo Git.
- `archive.mjs` grava os documentos originais e as extrações em arquivo mode `0600` local e retorna `HOLD_HUMAN`, não `PUBLISHED`.
- Não colocar URL de conexão, segredo de administrador, fulltext de prova/norma ou arquivos PDF extraídos em GitHub/Vercel.
- O projeto Cânone isolado ainda não foi criado em Supabase, GitHub ou Vercel nesta etapa.

## V5 — Índice de três artefatos, recuperação e fila de revisão

Veja [STORAGE-RECOVERY-V5.md](STORAGE-RECOVERY-V5.md) para operação e critérios de aceite.

`export-storage-index.mjs` identifica **PDF original / texto extraído / máscara** com
referências e hashes no banco, sem exportar bytes ou contaminar outros schemas.
`recover-storage-triad.mjs` usa acesso autenticado ao bucket privado (somente GET)
e só grava manifesto de sucesso após os 3 hashes reais e tamanho serem validados.
`review-batches.mjs` divide afirmações candidatas por instrumento normativo e questões
em fila editorial independente, sem inferir conteúdo, gabarito ou aprovação humana.

Sem credenciais de leitura a operação permanece em `HOLD_CREDENTIAL`.
