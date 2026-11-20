# Cânone — núcleo canônico orientado por evidência normativa e editorial

## Requisito de arquitetura

**Não declarar conteúdo canônico a partir de uma tabela, view, taxonomia, importador ou metamodelo.** Esses objetos são projeções de conhecimento, não a origem da verdade. A origem de cada afirmação é um documento normativo ou editorial **preservado e versionado**; o vínculo segue um trecho literal, um átomo, uma afirmação, um conceito e a projeção.

```text
FONTE PRESERVADA E VERSIONADA (NORMATIVA | EDITORIAL)
  → SHA-256 dos bytes + direitos + identidade da fonte
  → INTERVALO [start_byte,end_byte) E SHA-256 DO TRECHO (pinpoint)
  → ÁTOMO LITERAL (regra, definição, condição, exceção, fato, interpretação, exemplo)
  → AFIRMAÇÃO CANÔNICA (NORMATIVE | EDITORIAL | MIXED)
  → CONCEITO CANÔNICO (identidade, sinonímia, taxonomia, relações controladas)
  → PROJEÇÃO (norms.*, editorial.*, learning.*, content_type, field_definition)
  → CONTRATO / VALIDADOR / METAMODELO SEMÂNTICO / DICIONÁRIO
  → API / RENDER / MATERIAL DIDÁTICO
```

### Dois ramos com assimetria de autoridade

- **Normativo:** fonte oficial com órgão, documento, versão e vigência. Regras, obrigações, critérios e gabaritos que invocam normas precisam de ao menos um átomo normativo de origem. Um artigo editorial, comentário ou aula não pode elevar sua opinião à condição de norma.
- **Editorial:** fonte com autoria, editora/veículo, data, licença e versão. Pode originar interpretações, explicações, exemplos, guias, casos e decisões pedagógicas próprios, **rotulados como editoriais**. Se afirmar uma obrigação normativa, deve também vincular a versão da norma e seu átomo literal.
- **Misto:** exige os dois ramos (norma + comentário) e relacionamentos explícitos como `EXPLAINS`/`SUPPORTS`. Divergência editorial x normativa não é silenciosamente corrigida: abrir conflito e revisão humana.
- **Técnico-operacional:** login, cobrança, logs, sistema de arquivos e colunas técnicas não se originam de CPC/NBC. São rastreados por ADR/contrato técnico específico, sem se passar por conhecimento contábil.

### Autoridade e imutabilidade

O documento bruto, seu SHA-256 e o pinpoint por intervalo em **bytes** são o registro primário. `quote` é comparada literalmente aos bytes preservados; normalização/OCR é uma derivação, não substitui o original. A mudança de versão exige outro registro, nunca sobrescrita. Na projeção semanticamente publicada a versão da fonte, vigência, direitos, revisão e aprovação precisam estar válidos. Relações `SUPERSEDES` invalidam conteúdo atrelado a afirmações substituídas. `CONTRADICTS` precisa de resolução documentada.

### Implementação atual

| Componente | Estado |
|---|---|
| `contract.v1.json` — regras normativas/editoriais e alvos Cânone | Implementado |
| `engine.mjs` — digest, grafos, validação, conflitos, artefatos | Implementado e testado em fixtures sintéticas |
| `generate.mjs` — `--write`, `--check`, `--strict-release` | Implementado |
| `graph.v1.json` — corpus real | **Vazio**: aguarda exportação de arquivos originais com licença e hash; nenhuma alegação real criada |
| `generated/` — 9 artefatos automaticamente derivados | Gerados, sem dados normativos inventados |
| `ddl/001_evidence_first_staging_only.sql` — constraints e FK físicas | Preparado, **não executado** em PostgreSQL |
| `tests/` — casos normativo, editorial, misto e bloqueios | Testados localmente |

### Comandos

```bash
cd backend
npm run canonical:generate   # REGENERA documentos e tipos; não altera banco
npm run canonical:check      # compara byte a byte; CI reprova drift
npm run canonical:test       # provas determinísticas e sintéticas
node integrations/canonical-knowledge/generate.mjs --check --strict-release
# exit 5 enquanto faltar corpus/validação ou aprovação de publicação
```

### Integridade: limites honestos

A suíte offline prova as regras **do algoritmo**, não a legitimidade dos normativos nem a qualidade da revisão humana. O Supabase compartilhado forneceu apenas projeções, status e metadados; os arquivos brutos preservados, a verificação byte a byte e o vínculo editorial preciso não estão nesta branch. Não haverá migração automática de `master_register`, `normative_works`, questões ou fragmentos diretamente para uma entidade publicável.

`pg-structure` serve para refletir a **estrutura física** do PostgreSQL, e não para decidir semântica do domínio. Assim há dois gates complementares:

1. `metadata-auto`: estrutura, FK, PK, views, dicionário físico, drift, master data como referência.
2. `canonical-knowledge`: origem documental, intervalos, átomos, claims, relações, dicionário de conceitos, contratos e conteúdo derivado.

**Ambos devem passar.** A promoção editorial exige ainda fonte oficial, direitos, vigência, gabarito, validação humana, testes de banco real e políticas de acesso. A v1 mantém `HOLD_HUMAN` por padrão.
