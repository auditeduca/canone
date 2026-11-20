# Bridge Cânone ← Contabilidade/Audit Educa (v1)

**Estado:** candidatos / HOLD_HUMAN. Não é migração aplicada; não há ligação a produção.

O contrato está em `contract.v1.json`. Somente fonte `Calculadoras-Smart`, exclusivamente
`contabilidade_cfc`, `account_palm` e `public.regulatory_instruments`.
Nenhum dado `public.exams` (Enfermagem), `ce_*` ou WU-TRIB entra.

## Fases automatizadas

1. `node export-readonly.mjs` imprime plano sem conectar e sem alterar banco.
2. Em um runner aprovado com **credencial de leitura**, executar `CANONE_SOURCE_DATABASE_URL=... node export-readonly.mjs --execute` (o segredo fica no gestor de segredos, nunca em VITE_*). Todos os SELECTs são feitos numa transação READ ONLY com snapshot consistente.
3. `node intake-candidates.mjs --execute` valida hash de cada arquivo, chave primária e contagem; produz `candidates.ndjson`, sempre com `HOLD_HUMAN` e `publication_eligible:false`.
4. Operador revisa lote e só depois do catálogo `norms` e dos testes do banco Cânone estar em ambiente isolado desenha-se a promoção transacional com autorização humana.

Os diretórios `backend/.local-bridge/` são **ignorados pelo Git**, porque podem
conter questões, trechos normativos, direitos autorais e dados não homologados.
Nenhum export sai publicamente no build frontend ou Vercel.

## Bloqueios de promoção

- 50 questões `PENDING_OFFICIAL_KEY`; 48 QA editorial pendente e duas revisões visuais.
- 549 registros mestre com `canonical_promotion=false`.
- 42 normas NBC TA/PA `source_verified=false`, `publication_eligible=false`.
- 393 segmentos `PASS_LOSSLESS` técnico mas `PENDING` editorial.
- 4 instrumentos exclusivos em `public.regulatory_instruments`; exigir reconciliação.
- É necessário verificar versão, vigência, direito de reprodução, SHA e provas do runtime antes da publicação.

## Destinos funcionais

- `contabilidade_cfc.questions` → candidato `editorial.content_item_version`, `learning.item` apenas pela projeção do Cânone;
- `sources` → `editorial.source`, hash/arquivo oficial devem ser comprovados;
- `master_register`, `entities`, `normative_works` → crosswalk de master data; somente os verificados podem preencher `norms.norm`;
- `regulatory_instruments` → candidatos `norms.norm` + `norms.norm_version` após apurar versão e vigência;
- `normalized_units_v1` → candidatos `norms.norm_item` sem publicação ou corpo de texto exportável por padrão;
- QA e segmentos → filas de revisão, jamais publicação automática.

**Limitação:** o Cânone ainda não tem um projeto Supabase e um repositório GitHub remoto identificados. Por isso essa entrega não executa DDL, DML ou deploy.

## Correção do mapa físico (14/11/2026)

O catálogo remoto mostrou que `account_palm.master_register`, `account_palm.entities`, `account_palm.normative_works` e `account_palm.regulatory_instruments` são **views `security_invoker=true`**. Suas fontes físicas são, respectivamente, `cko_governance.account_palm_master_register_v1`, `cko_master.entities`, `cko_master.entities` e `public.regulatory_instruments`. Elas só podem ser tratadas como **projeções de leitura**. O contrato preserva a ingestão por view (restrita), com chave lógica e SHA; não gera FK física no banco de origem nem escreve nessas views.

Os arquivos de metadados físicos, lógicos e de proveniência são regenerados pela biblioteca em `../metadata-auto`; nenhuma view deve ser confundida com tabela materializada ou fonte canônica autônoma.
