# Cânone — reconciliação multifonte, versão S22/S23 e extração Supabase
**Corte:** 19/11/2026 · **Produto:** preparação para Exame de Suficiência e EQT/CFC · **Gate global:** NO-GO

> Documento de reconciliação. **Prevalência:** decisão S23 v0.3 de escopo do aluno/CFC sobre priorizações genéricas anteriores; código S22 é o último pacote de aplicação **verificado por hash** nesta rodada. Não há homologação de produção.

## 1. Fontes recuperadas e reconciliadas

### Biblioteca ChatGPT — S19–S23
- Foram recuperados os quatro ZIPs de aplicativo S19, S20, S21 e S22, o bundle Git S22 e o manifesto S22, mais documentos e matriz S23.
- **S22 app ZIP:** `CANONE_V9_S22_APP_INTEGRAL_NO_GO_2026-11-15.zip`, **1.180.952 bytes**, **477 entradas**, SHA-256 `db1cc15e4ea4670012831f166de5a2e4c12936d9cab6a8992d7ae17b53603d07`; **manifesta correspondência exata**.
- **S22 Git bundle:** `CANONE_V9_S22_PG17_LOCAL_HISTORICO_2026-11-15.bundle`, **1.035.364 bytes**, SHA-256 `f1fef6a3452b0e21debc7024f006c546fa6f74221af9f234ed0fd909a366447d`; clone local bem-sucedido; branch `work/canone-s22-backend-contracts`, SHA `164fa4df8e99de29e35c41d35a25f6ee0b2c6462`. **476 arquivos Git versionados**; ZIP inclui documento de entrega adicional.
- **30/30 migrations SQL originais** encontradas no pacote `backend/db/migrations/`; overlays de revisão permanecem **não executáveis em ambiente compartilhado**.
- Diffs por SHA-256 de cada caminho: S19→S20 **431 idênticos, 1 alterado, 7 adicionados**; S20→S21 **439 idênticos, 10 adicionados**; S21→S22 **440 idênticos, 9 alterados, 28 adicionados**. Histórico Git preserva as versões anteriores, sem importar arquivos duplicados por engano.
- Busca automatizada básica em arquivos S22 não encontrou padrões literais evidentes de chaves privadas/tokens (GH, OpenAI, AWS, Google API, JWT Supabase ou URL Postgres), **não substitui auditoria de segredos/licenças antes de push para repo público**.
- Documento S22 reporta **277/277 testes locais PASS**, 30/30 scripts candidatos aplicados em **PostgreSQL 17.12 descartável**, **90 tabelas com RLS+FORCE**, 14 funções privilegiadas, API 5/5 PASS sob login sem BYPASSRLS e backup/restore PASS. **Histórico, não teste reexecutado hoje; NO-GO permanece**.

### S23 — escopo canônico mais recente
- Fonte: `CANONE_S23_PLANO_MESTRE_CANONICO_CFC_FASEADO_2026-11-15.md`, decisão S23 v0.3.
- O Cânone é **plataforma educacional** de preparação aos exames contábeis, principalmente **Exame de Suficiência** (P0) e posteriormente modalidades **EQT QTG, Perícia, CVM, BCB, Susep, Previc**. Não é ERP/escritório na V1.
- 26 módulos legados são projeções de serviços canônicos; **não** 26 backends. Motor de item/tentativa, revisão SRS, progresso, evidência normativa e identidade devem ser únicos.
- Matriz S23 verificada: **17 abas**, **61 telas**, **26 módulos**, **35 funcionalidades**, **34 controles**, **14 gates gerais**. Os números são inventário e metas, não funcionalidades homologadas.
- Vertical P0: edital oficial → trilha de estudo → aula licenciada → questão/gabarito revisados → simulado com tentativa servidor → feedback justificado → caderno/revisão/progresso persistente e acessível.
- Auditoria S23 confirmou telas ilustrativas com estado em `useState`, ausência de login/progresso persistente no preview, CTAs sem fluxo, riscos de responsividade; **preview READY não comprova produto pronto**.

### Google Drive
- Busca pela palavra `canone`: **65 arquivos**; pasta S11 de portabilidade: **13 itens**, sendo 7 já presentes na busca e **6 adicionais**; **71 IDs distintos** após deduplicação por ID. A deduplicação por título/ID não valida igualdade de bytes.
- Índice de 71 fontes: [Google Drive + S11](../inventories/sources/GOOGLE_DRIVE_CANONE_PLUS_S11_20261119.json).
- Inclui bundle Git, ZIP S11, manifesto hash, logs PG, ADRs S2–S11, normas V8/V9. O material S11 é histórico; não substituir o código S22.
- Biblioteca do Chat tem ainda inventário [parcial de arquivos](../inventories/sources/CHAT_LIBRARY_CANONE_20261119.json). A listagem foi interrompida após 3.000 itens e 150 nomes correspondentes; **não alegar exaustividade do acervo**.

## 2. Supabase compartilhado: o que foi efetivamente extraído

Projeto fonte: `Calculadoras-Smart`, ref `pgsybzggewhinaniybiy`, PostgreSQL 17, consulta somente leitura.

| Grupo | Tabelas | Views | Situação para a migração |
|---|---:|---:|---|
| `canone_control` | 4 | 0 | **Nativo**: metadados e 53 linhas exportadas |
| `contabilidade_cfc` | 11 | 0 | Compartilhado: direitos/escopo a revisar |
| `account_palm` | 18 | 26 | Compartilhado: normalização/atomização normativa; sem cópia de conteúdo |
| `public` (exams/CFC) | 15 | 1 | Compartilhado: inclui gabaritos/objetos de fonte; não migrar automaticamente |
| `cko_governance` (candidatas nominais) | 6 | 0 | Revisão mandatória; pode conter dados de CE/CKO não pertinentes |
| **TOTAL INVENTARIADO** | **54** | **27** | **50 tabelas e 27 views compartilhadas não equivalem a ativos próprios** |

Os **14 schemas `canone_*` estão reservados**, mas só `canone_control` tem tabelas reais; **30/30 migrations no catálogo remoto = NOT_APPLIED**. Os seis registros de release mantêm `prod_release=NO_GO`, `backend_identity=HOLD_HUMAN`, `domain_migrations=HOLD_DEPENDENCY`, `regulatory_evidence=HOLD_SOURCE`.

Arquivos versionados:
- [Relações, status RLS, chaves e estimativas](../inventories/supabase/CANONE_CANDIDATE_RELATIONS_20261119.json) — **81 relações**.
- [Colunas e tipos físicos](../inventories/supabase/CANONE_CANDIDATE_COLUMNS_20261119.json) — **1.157 colunas das 81 relações**, sem dados de registros.
- [Snapshot de dados apenas de `canone_control`](../inventories/supabase/CANONE_CONTROL_ROWS_20261119.json) — **53 linhas** (14 mapeamentos, 30 migrations, 6 gates, 3 bindings).

**Não foi gerado pg_dump integral do banco compartilhado nesta sessão.** O SQL de scripts candidatos em ZIP não é DDL de produção. A extração completa com dados de origem de cada tabela compartilhada requer seleção por finalidade, análise de direitos, segregação e acesso direto a uma conexão Postgres de leitura.

## 3. Pacote de recuperação para nova instância

Pacote privado preparado nesta conversa: `CANONE_CONSOLIDACAO_S22_S23_E_SUPABASE_20261119.zip` (2.329.464 bytes, SHA256 `614dd1366b9ddf68719994b6dbcc338c30879a6abf0228743289290e49e43808`). Contém ZIP S22, bundle Git S22, relatórios e matrizes S23, registros de QA, comparativo de hash entre as versões e script `EXPORT_SUPABASE_CANONE_READONLY.sh` para a próxima instância. **O ZIP não foi commitado no GitHub público**.

## 4. Plano de decisão para o novo projeto Supabase

1. **Criar projeto individual Supabase do Cânone**, com banco/keys/proteções separados da plataforma de enfermagem; nunca copiar credenciais atuais.
2. Reidratar S22 com bundle/ZIP e revisar os 30 SQL originais + overlays 018–030 sem sobrescrever históricos. Executar no PostgreSQL descartável e reconciliar RLS/roles/owners/SECURITY DEFINER antes de homologar.
3. Separar **dados nativos** `canone_control` de fontes editoriais compartilhadas (`contabilidade_cfc`, `account_palm`, `public`, `cko_governance`). Reutilizar identificadores e linhagens; nunca fazer `SELECT *` indiscriminado entre produtos.
4. Para referências CFC/Senado, verificar documentos originais, vigência, direitos/licenças, hashes de bytes e gabaritos; `HOLD_SOURCE`/`HOLD_RIGHTS` por claim até aceite.
5. Construir/homologar primeiro **um fluxo real de aluno CFC** ponta a ponta, não 26 demos. Testar web/mobile, dois usuários isolados, recuperação de sessão, erros e logs.
6. Produção e comercialização somente após gates humanos, jurídicos, de segurança, testes E2E, backup e rollback.

**Decisão formal:** `S22_SOURCE_RECOVERED`, `S23_SCOPE_APPROVED_FOR_PLANNING`, `SUPABASE_METADATA_EXTRACTED`, `SHARED_DATA_EXPORT_HOLD`, `RELEASE_NO_GO`.
