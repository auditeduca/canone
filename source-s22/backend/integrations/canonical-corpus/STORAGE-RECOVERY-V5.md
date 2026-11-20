# Marco V5 — Recover corpus from Supabase Storage (candidate-only)

**Fonte**: `Calculadoras-Smart` (`pgsybzggewhinaniybiy`).
**Escopo**: documentos oficiais do universo `account_palm` / `CFC-%`.
**Não aplicável** a tabelas de Enfermagem, WU-TRIB ou Protheus.
**Sistemas afetados**: nenhum sistema remoto; SQL estritamente `READ ONLY` e Storage `GET`.

## Evidência observada de forma independente por SQL (14/11/2026)

| Verificação | Resultado |
| --- | ---: |
| Registros em `account_palm.normative_extractions` | 249 |
| Documentos originais com vínculo a `account_palm.acquisition_evidence` | 249 |
| Objeto original PDF localizado em `storage.objects` | 249 |
| Objeto TXT derivado localizado em `storage.objects` | 249 |
| Objeto MASK derivado localizado em `storage.objects` | 249 |
| `raw_sha256` da extração = SHA registrado no evento de aquisição | 249 |
| `raw_byte_count` da extração = tamanho do original no Storage | 249 |
| `identity_gate` e `provenance_gate` da aquisição | 249 true |
| `normative_text_gate` da aquisição | 249 true |
| `gate_status` de aquisição | 249 BLOCKED |
| `promotion_eligible` | 0 true |
| Norma com autorização final de publicação | 0 confirmada |

**IMPORTANTE:** os 747 objetos foram identificados por seus *registros de metadados* no bucket privado `ingest-private`. A inspeção do banco **não equivale à recuperação ou comparação criptográfica dos bytes**. As URLs internas e os caminhos não são publicados em Git. `account_palm.normative_extractions` é uma VIEW `security_invoker=true`; seu conteúdo físico reside em `public.cfc_internal_normative_extractions`.

Os 249 originais têm `content_type=application/pdf` com tamanhos registrados entre 12.320 e 6.749.392 bytes.

## Pipeline executável (sem credenciais no Git)

1. `node backend/integrations/canonical-corpus/export-storage-index.mjs` — DRY RUN seguro.
2. Configurar **fora do projeto** `CANONE_SOURCE_DATABASE_URL` com role somente SELECT em views `account_palm`, catálogo `storage.objects` e objetos estritamente necessários.
3. `node backend/integrations/canonical-corpus/export-storage-index.mjs --execute`: abre snapshot `REPEATABLE READ READ ONLY`, extrai índice privado com os 249 trios, cruza IDs, versões de origem, SHA, tamanhos, status e registro de objeto. O índice **não inclui conteúdo**.
4. Para recuperação: configurar `CANONE_SOURCE_STORAGE_API_KEY` (chave pública compatível) e `CANONE_SOURCE_STORAGE_READ_TOKEN` (JWT de usuário com permissão SELECT restrita ao bucket/caminhos previstos na política de Storage). Não usar `service_role` no frontend nem publicar tokens nos logs.
5. `node backend/integrations/canonical-corpus/recover-storage-triad.mjs --execute --index backend/.local-bridge/storage-index/artifact-index.private.json --limit 5` — piloto autenticado de cinco documentos. `--all` habilita o universo de 249, **somente depois de conferir resultados do piloto**.
6. Os bytes preservados ficam em `backend/.local-bridge/recovered/<tipo>/<sha256>` com permissão 0600. O manifesto de cada documento só aparece depois dos três SHA-256 e tamanho verificados. Documento com formato PDF inválido é recusado. Não há OCR nem inferência semântica automática.
7. Exportar as candidaturas completas com `node backend/integrations/audit-educa/export-readonly.mjs --execute` e `node backend/integrations/audit-educa/intake-candidates.mjs --execute`.
8. Gerar fila distinta de revisão normativa/editorial: `node backend/integrations/canonical-corpus/review-batches.mjs --execute --input backend/.local-bridge/candidates/candidates.ndjson --batch-size 100`. O lote contém IDs, hashes e localizadores, não textos integrais nem gabaritos.
9. Validar todos os gates offline e, em ambiente PostgreSQL Cânone isolado, os testes RLS e contrato da aplicação antes da publicação.

**Códigos de saída do recuperador:** `0` somente para dry run, `3` em erro parcial de download/bytes e `4` em preservação realizada mas ainda com `HOLD_HUMAN`. `4` é um bloqueio deliberado de release, não falha de checksum.

### SQL de auditoria para comparar sem mover dados

O índice lê 249 linhas de `account_palm.normative_extractions` e sua aquisição, juntando exclusivamente os caminhos já referenciados por `raw_payload` e pelos campos `text_storage_*` / `mask_storage_*` à `storage.objects`. Nenhuma operação de escrita, cópia de blob ou migração é executada nesse comando. A implementação em `export-storage-index.mjs` é a especificação executável desse contrato.

## Políticas e gates

- `SOURCE_BYTES`: 3/3 SHA reais e 3/3 tamanhos. **FALHA se não obtiver acesso de leitura**, mesmo que os metadados do banco estejam perfeitos.
- `SOURCE_IDENTITY`: instrumento da extração, aquisição e catálogo precisam coincidir.
- `SOURCE_RIGHTS`: direitos de uso e divulgação, versão/vigência e confiabilidade da fonte = **pendente**.
- `ATOM`: offsets literais da extração UTF-8 versão identificada; a posição no PDF não é intercambiável com o offset textual.
- `SEMANTIC_CLAIM`: extração de características não é um claim. `normative_claim_candidates_v1` tem **0** registros observados.
- `EDITORIAL`: 50 questões CFC, sem gabarito oficial final homologado; nenhuma promoção automática.
- `GO/NO-GO`: somente após revisão editorial, normativa, direitos, testes de RLS e aprovação humana.

## Plano PMO em microtarefas

| WO | Etapa | Dependência | Estado |
|---|---|---|---|
| CAN-M5-01 | Localizar os trios originais/extratos/máscaras no Storage | Inventário SQL | **PASS_METADATA (249/249)** |
| CAN-M5-02 | Confrontar origem, SHA, tamanho, formato, estados | FKs e storage.objects | **PASS_METADATA (249/249)** |
| CAN-M5-03 | Desenvolver índice versionado e detecção fail-closed | Contrato de extração | **IMPLEMENTED_TESTED_LOCAL** |
| CAN-M5-04 | Desenvolver recuperador privado e verificador SHA dos bytes | Token read-only | **IMPLEMENTED_TESTED_LOCAL / HOLD_CREDENTIAL** |
| CAN-M5-05 | Executar piloto com 5 fontes reais | Credenciais read-only e políticas Storage | **HOLD_CREDENTIAL** |
| CAN-M5-06 | Recuperar o universo completo sem promoção | Piloto verificado | **HOLD_PILOT** |
| CAN-M5-07 | Gerar 24.385 filas de revisão semântica por instrumento | Exportação integral de candidatos | **IMPLEMENTED_TESTED_LOCAL / HOLD_EXPORT** |
| CAN-M5-08 | Produzir claims semânticos + conceitos normativos/editoriais canônicos | Avaliação especialista e fontes verificadas | **HOLD_HUMAN** |
| CAN-M5-09 | Validar Vercel, GitHub e ambiente PostgreSQL independente | Conexões e alvo correto | **HOLD_TARGET** |

## Status correto

**Arquitetura e controles locais: avançaram.**
**Integridade de presença do Storage: verificada para 249 trios.**
**Integridade criptográfica dos bytes originais em Cânone: NÃO TESTADA ao vivo.**
**Claims semânticos canônicos: ainda NÃO materializados.**
**Release: `HOLD_HUMAN`.**

## Complemento V6 — piloto obrigatório antes do universo integral

A versão V6 seleciona cinco instrumentos por estratificação do tamanho original do PDF; não escolhe cinco fontes consecutivas por ordem alfabética. O critério é determinístico e verificável em `metadata-reconciliation.v6.sql`.

- `recover-storage-triad.mjs --execute --index <indice_privado>` valida cinco trios selecionados e reabre os 15 arquivos do piloto para recalcular hashes. Sucesso de bytes gera `pilot-attestation.private.json`, sempre `HOLD_HUMAN`.
- `--all` **só executa depois** de o recuperador confirmar a existência, integridade real, tamanho, SHA e estado de bloqueio dos cinco trios da seleção corrente. O manifesto sozinho não autoriza o universo integral.
- O limite manual sem `--all` está restrito a 1–5. Um novo índice com hash diferente força revalidação do piloto se seus artefatos mudaram.
- Exportar o índice gera um arquivo temporário; o arquivo ativo só é promovido após todos os controles. Uma falha invalida o índice ativo antigo para impedir reutilização acidental.
- Este mecanismo NÃO é aprovação semântica, editorial, de direitos nem da aplicação comercial. Nenhum conteúdo privado integra os arquivos de Git.

**Dependência operacional:** credenciais read-only de Storage e Postgres fornecidas por cofre/variáveis de ambiente fora do Git. A execução dos bytes reais continua em `HOLD_CREDENTIAL` enquanto não houver um executor autenticado.
