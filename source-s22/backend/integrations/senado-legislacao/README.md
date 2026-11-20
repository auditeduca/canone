# Conector Legislativo — Senado Federal (Cânone V7)

Integração **somente leitura** que busca **candidatos de legislação federal** via API oficial do Senado, sem transformar metadados em normas contábeis do CFC, sem publicar e sem escrever no Supabase.

## Fontes oficiais e separação de autoridades

- Catálogo Senado: https://www12.senado.leg.br/dados-abertos/legislativo/legislacao
- Endpoint documentado de pesquisa: `https://legis.senado.leg.br/dadosabertos/legislacao/lista.json?numero=6404&ano=1976`
- Documentação dos recursos: https://legis.senado.leg.br/dadosabertos/docs/index.html
- LexML (pesquisa e URN): https://www12.senado.leg.br/dados-abertos/legislativo/legislacao/acervo-do-portal-lexml
- Senado lista informações jurídicas/legislativas federais, não os 249 PDFs NBC/CFC cuja autoridade emissora é o CFC. A instrução normativa da RFB deve ser consultada também na RFB.
- O portal da legislação do Senado avisa que o texto exibido **não substitui o original publicado no Diário Oficial**; validar a publicação original e a versão temporal da norma antes da canonização.

## Quatro atos localizados em páginas oficiais, sem JSON da API recuperado nesta sessão

| ID candidato | Identidade | Página oficial | Relação candidata |
|---|---|---|---|
| `BR-FED-LEI-6404-1976` | Lei nº 6.404/1976 | https://legis.senado.leg.br/norma/548280 | Recebe alterações da Lei 11.638/2007 |
| `BR-FED-LEI-11638-2007` | Lei nº 11.638/2007 | https://legis.senado.leg.br/norma/569477 | `AMENDS` Lei 6.404/1976 |
| `BR-FED-DL-9295-1946` | Decreto-Lei nº 9.295/1946 | https://legis.senado.leg.br/norma/534334 | Cria o CFC; alterado pela Lei 12.249/2010 |
| `BR-FED-LEI-12249-2010` | Lei nº 12.249/2010 | https://legis.senado.leg.br/norma/575891/publicacao/34618955 | `AMENDS` DL 9.295/1946 |

As duas relações permanecem `HOLD_ATOMIZATION`, ainda que as páginas oficiais demonstrem sua existência. Não representam claim semântico ou redação vigente homologados.

## Execução

```bash
cd backend
# Não faz requisições HTTP (dry-run padrão):
node integrations/senado-legislacao/fetch-readonly.mjs
# Em ambiente com acesso ao host da API:
node integrations/senado-legislacao/fetch-readonly.mjs --execute
# Uma lei específica:
node integrations/senado-legislacao/fetch-readonly.mjs --execute --source=BR-FED-LEI-6404-1976
# Teste sem acesso externo:
node --test integrations/senado-legislacao/tests/*.test.mjs
```

**Destino local privado**: `backend/.local-bridge/senado` (`.gitignore`). `responses.private.json` e `intake.private.json` possuem hash SHA-256, URL, identificadores, estado e informação de quarentena. Não há chaves ou gabaritos no frontend; o conector NÃO usa segredos de usuário para API pública.

Em caso de erro HTTP, DNS, formato inválido ou ausência de identificador comprovado, retorna `HOLD_API` / `HOLD_SCHEMA_OR_IDENTITY` e nunca promove. No início de qualquer execução, o manifesto anterior é invalidado. O campo `matched_field_pairs` é uma heurística de estrutura de resposta; **não** é validação do documento, vigência, alteradores ou direitos.

## Integração ao metamodelo canônico

O contrato do `catalog.v1.json` descreve a separação:

1. `SENADO_API`/`SENADO_HTML` → `source_candidate` do domínio legislativo, sem qualquer conteúdo canônico automaticamente.
2. `download/read` de documento oficial com versão → SHA-256 e preservação privada → texto extraído e spans → revisão jurídica → afirmações.
3. CFC NBC, RFB IN e Senado são autoridades distintas: usar `RELATES_TO`, `AMENDS`, `DERIVES_FROM` **somente após evidência**. Mesma palavra no título ou no assunto não permite `EQUIVALENT_TO`.
4. Outras tabelas do Supabase (Enfermagem, NCOS, WU-TRIB) permanecem excluídas, e o catálogo físico não é fonte semântica.
5. Revalidar alterações de vigência temporal da legislação e conteúdo editorial antes de usar afirmações em questões, materiais de curso ou simulado.

## Estado observado em 14/11/2026

- Portal Senado HTML: 4 páginas de atos identificadas.
- API Senado: documentação e endpoint localizados, porém **0 JSON obtidos** (falhas de acesso de rede neste executor).
- Supabase `public.regulatory_instruments`: 253 registros, 249 com IDs `CFC-%`; os quatro extras eram dois instrumentos da profissão de enfermagem e duas INs RFB. Nenhuma das quatro normas federais deste piloto foi comprovada como já existente pelo número/ano nessa tabela. Não reutilizar os dois registros de enfermagem no Cânone.
- Publicação: `NO_GO`, `HOLD_HUMAN`.

## Marco V8: arquivo original da API + escopo por artigo (sem autopromoção)

**Correção de proveniência:** a V7 calculava o SHA-256 sobre os bytes HTTP, mas guardava o JSON reserializado. A V8 escreve **os bytes exatos do corpo HTTP** em `backend/.local-bridge/senado/raw/BR-FED-...<sha256>.json` e registra caminho, hash e tamanho no manifesto v2. Esses arquivos privados são ignorados pelo Git. O diretório é resolvido relativamente ao módulo (não ao `cwd`), evitando um caminho incorreto `backend/backend/`.

**Reprodução do pacote**:

```bash
cd backend
npm run senado:dry-run      # quatro URLs, sem rede
npm run senado:fetch        # somente se houver rede e acesso à API
npm run senado:verify       # reabrir cada resposta bruta, conferir SHA, bytes e identidade
npm run senado:test         # funciona offline, testes com documentos SINTÉTICOS
```

- `senado:verify` nunca muda status de publicação; seu êxito significa exclusivamente que o JSON armazenado pode ser auditado byte a byte e a identidade candidata não mudou.
- O arquivo `intake.private.json` v1 da V7 é **incompatível** com o replayer V8: preservar um registro antigo exige nova obtenção verificável da resposta HTTP original.
- O conector continua `HOLD_API` quando a API está fora do alcance; respostas de testes ou páginas HTML não contam como JSON da API obtido.
- URLs consultáveis só no domínio `legis.senado.leg.br`, sem redirecionamento, sob `/dadosabertos/legislacao/`. O HTTP não faz alterações remotas.
- Se qualquer documento falhar, os manifestos antigos de sucesso (`intake.private.json` e `responses.private.json`) são invalidados antes da tentativa; um lote parcial não é aprovado.

**Vínculos jurídicos para revisão por dispositivo, sem leitura atomizada armazenada:**

- Lei 11.638/2007 → Lei 6.404/1976: dispositivos identificados no portal oficial do Senado (lista em `catalog.v1.json`); marcados `SENADO_HTML_METADATA`, `HOLD_SOURCE_ATOMIZATION`.
- Lei 12.249/2010, artigos 76 e 77 → DL 9.295/1946, dispositivos indicados pelo texto no portal oficial; marcados `SENADO_HTML_PUBLISHED_TEXT`, `HOLD_SOURCE_ATOMIZATION`.
- **Não existe conteúdo normativo canônico liberado** a partir desses registros. A lei compilada, as alterações posteriores, os documentos do DOU e os textos editados pelo CFC exigem conciliação própria.

Fontes de referência:
- https://legis.senado.leg.br/norma/569477
- https://legis.senado.leg.br/norma/575891/publicacao/34618955
- https://legis.senado.leg.br/dadosabertos/docs/index.html

Fila V8 determinística: `node integrations/senado-legislacao/article-queue.mjs --check` produz 26 candidatos apenas de escopo por artigo, sem textos nem claims. O arquivo é `generated/article-review-queue.csv`, somente para revisão, nunca publicação.

## Marco V9 — Conciliação de fonte oficial, sem inventar atoms

A V9 preserva a fila de 26 dispositivos V8 e adiciona **dois candidatos temporais independentes**: os §§ 1º e 2º do artigo 25 do Decreto-Lei 9.295/1946, relacionados à Lei 14.039/2020, indicados na página oficial do Senado https://legis.senado.leg.br/norma/534334 . A lei de 2020 **não foi importada por API**, nem integrada como instrumento canônico; deve primeiro ser cadastrada e validada com publicação original.

Arquivos:

- `source-observations.v1.json`: quatro grupos de observações de páginas oficiais (18 + 7 + 1 + 2 dispositivos); são **metadados e pistas de navegação** e não reprodução dos bytes oficiais.
- `source-backed-review.mjs`: valida correspondência exata com 26 IDs e escopos V8, distingue `AMENDS`/`ADDS`, identifica novos candidatos, bloqueia autopromoção e gera CSV/relatório reproduzíveis.
- `generated/source-backed-review.csv`: 28 candidatos com origem e localizador, dois itens `P0` para artigos 6º e 12 (Exame de Suficiência); todos `HOLD_HUMAN`.
- `generated/source-backed-report.json`: 26 reconciliados, dois acréscimos candidatos, **0 documentos preservados pela V9, 0 átomos aprovados, 0 claims canônicos**.

```bash
cd backend
npm run senado:source-check   # confere CSV/manifesto contra observações e catálogo
npm run senado:source-generate # regerar após revisão das fontes
npm run senado:test           # testes offline
```

As páginas consultadas:
- https://legis.senado.leg.br/norma/569477 — lista dos artigos da Lei 6.404/1976 alterados pela Lei 11.638/2007.
- https://legis.senado.leg.br/norma/575891/publicacao/34618955 — artigos 76 e 77 da Lei 12.249/2010.
- https://legis.senado.leg.br/norma/534334 — alteração permanente de 2010 e acréscimos de 2020 ao Decreto-Lei 9.295/1946.

**Governança:** `source_bytes_verified=false`, `atom_verified=false`, `source_temporal_validity=UNVERIFIED`, `publication_eligible=false`. Números de linhas em `observed_lines_hint` são apenas posições da renderização consultada: não são offsets de bytes, identificadores de versão jurídica, nem citações jurídicas canônicas. Proibido promover conteúdo sem PDF/publicação oficial, hash, extração com spans, vigência, revisão jurídica e editorial. A API JSON permanece `HOLD_API` por falha de DNS no ambiente da execução; o Senado não é fonte substituta das NBC/CFC.
