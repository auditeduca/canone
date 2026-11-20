# Plano de migração — Supabase exclusivo Cânone
**Corte de levantamento:** 2026-11-19 · **Versão:** 0.2 · **Estado:** PREPARAÇÃO / NO-GO.

## I. Escopo e soberania de dados
O Cânone é uma plataforma educacional de preparação para exames contábeis (S23 v0.3). O novo projeto Supabase, quando criado pelo proprietário, **não deve compartilhar tabelas, credenciais, branches ou banco** com o ecossistema de enfermagem.

**Fontes identificadas no banco compartilhado** `pgsybzggewhinaniybiy`:
| Categoria | Relações | Decisão |
|---|---:|---|
| 14 schemas `canone_*` | 4 tabelas de controle; outros schemas vazios | Modelo de controle nativo a reconstruir no destino |
| `contabilidade_cfc` | 11 tabelas | Candidato de conteúdo/exames; direitos e PK/FK antes de copiar |
| `account_palm` | 18 tabelas + 26 views | Compartilhado; referências de normalização/corpus não são dados exclusivos Cânone |
| `public` (nomes de exames/CFC) | 15 tabelas + 1 view | Compartilhado; contém potenciais questões/gabaritos/documentos: revisão item a item |
| `cko_governance` (nomes vinculados a CFC) | 6 tabelas | Compartilhado com CE/CKO; possível dependência; não copiar automaticamente |
| **Total de candidatos** | **54 tabelas + 27 views** | Metadata-only de compartilhados; 4 tabelas nativas com dados de controle exportados |

Arquivos-fonte da análise:
- `inventories/supabase/CANONE_CANDIDATE_RELATIONS_20261119.json`: 81 relações, RLS e número de colunas/PK/FK.
- `inventories/supabase/CANONE_CANDIDATE_COLUMNS_20261119.json`: tipos de 1.157 colunas de relações candidatas; **não** é DDL restaurável.
- `inventories/supabase/CANONE_CONTROL_ROWS_20261119.json`: 53 linhas de quatro tabelas nativas; **não contém registros de assinantes**.
- `inventories/source/CANONE_S22_SOURCE_IMPORT_MANIFEST.json`: arquivos recuperados por SHA-256.

## II. Regras antes de copiar dados
1. Criar projeto Supabase exclusivo com controle de acesso; não repetir a configuração do banco compartilhado.
2. Determinar o **inventário de domínio de destino** a partir do SQL original S22, *não* de todas as tabelas compartilhadas.
3. Reconciliar as 30 migrations originais com os overlays 018–030 **em PostgreSQL 17 descartável**; revisar funções SECURITY DEFINER, donos sem BYPASSRLS, search_path, grants, policies, autenticação e isolamento A/B. O S22 reporta 30 scripts candidatos que passaram em sandbox e 90 tabelas locais, não migradas ao remoto.
4. Somente depois de testes independentes criar migrations versionadas para staging do novo projeto, em execução controlada e reversível.
5. Selecionar tabelas compartilhadas **por finalidade**, campo, proveniência, direito e impacto. Preferir **vínculos de evidência** e derivados licenciados aos dados brutos; gabaritos, informações pessoais, documentos restritos e conteúdo de enfermagem ficam fora até revisão.
6. Executar pilotos em lotes pequenos com IDs preservados, checksums e contagens: lote de fontes oficiais validadas → conteúdo aprovado → questões/gabaritos licenciados → progresso sintético.
7. Verificar backup/restore, owner, RLS (anon/authenticated, edição e visualização cruzada), acessibilidade e E2E do aluno antes de produção.

## III. Inventário de permissões e segurança
As 4 tabelas `canone_control` apresentam RLS habilitada e nenhuma policy no projeto de origem. Nas tabelas compartilhadas há RLS heterogênea; **ausência de RLS em schema não exposto não equivale, isoladamente, a vazamento**. Verificar exposição Data API, grants, views `security_invoker` e privilégios de funções no destino.

## IV. Critérios de aceite
- [ ] Identificador e região do novo projeto registrados (sem senhas/keys no Git).
- [ ] PG17 isolado: 30/30 migrations reconciliadas em ordem com restauração e rollback provados.
- [ ] Autenticação/usuários A e B com acesso cruzado negado em testes adversariais.
- [ ] Registros compartilhados liberados por proveniência e direitos, com hashes reais de bytes quando permitido.
- [ ] Jornada piloto CFC: aula → questão → tentativa → correção licenciada → revisão → progresso persistente, desktop e mobile.
- [ ] Revisão técnica, editorial, normativa, jurídica e de segurança independentes.
- [ ] Decisão escrita GO/NO-GO. **Sem promotion automática**.

## V. O que já está pronto
- Fonte S22 e proposta SQL preservadas em branch isolada com manifesto.
- 277 testes locais reexecutados PASS; gate `NO-GO` confirmado.
- Snapshot de quatro tabelas nativas de controle e estrutura de 81 relações candidatas no GitHub.
- Diretiva de produto S23 v0.3 e matrizes de módulos/exames/gates registradas em `planning/s23/`.

## VI. Bloqueios em aberto
`HOLD_SECURITY` (auth/RLS/owner), `HOLD_SOURCE` (CFC/Senado e gabaritos), `HOLD_RIGHTS` (originais/licenças), `HOLD_ENVIRONMENT` (novo Supabase não criado), `HOLD_UAT` (jornada E2E), `RELEASE_NO_GO`.

O próximo passo da futura instância **não** é importar o banco compartilhado inteiro; é criar staging isolado e migrar **somente o modelo de domínio canônico já revisado**.
