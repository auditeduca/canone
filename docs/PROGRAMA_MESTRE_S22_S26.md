# Programa Mestre — Cânone (S22–S26)
**Versão:** 0.1.0 · **Corte:** 2026-11-19 · **Estado geral:** INTEGRATION_PENDING / NO-GO

## Objetivo e definição de pronto
Consolidar as entregas anteriores do Cânone Contabilidade em repositório independente, com trilha Git e banco isolado, confirmar o escopo dos 26 módulos, implantar um backend seguro e homologar normas, conteúdo e produto. **O repositório é criado, mas o código de origem S21 ainda não foi identificado e importado.**

**DoD global:** fontes recuperadas e reconciliadas; 30/30 migrations verificadas em banco descartável e staging aprovado; autenticação/RBAC/RLS validadas por identidades reais de teste; suíte CI e E2E verde; 26 módulos inventariados e avaliados por contrato; normativos oficiais com edição/data/rights rastreados; deploy preview auditado; backups/rollback comprovados; checkers técnico, normativo, jurídico e segurança independentes; aprovação explícita de produção.

## Indicadores — não confundir evidência e meta
| Indicador | Meta | Fotografia verificada | Interpretação |
|---|---:|---:|---|
| Código S21 integrado ao novo Git | 100% | 0% | Repositório inicialmente vazio; README de bootstrap não é código |
| Migrations catalogadas no Supabase | 30 | 30 `NOT_APPLIED` | Catálogo não indica migrations de domínio executadas |
| Migrations testadas em ensaio anterior | 30 | 16 (relato S21) | Sem artefato/sha ancorado no novo repo |
| Schemas canone reservados no Supabase | 14 | 14 | Apenas namespace, não backend |
| Tabelas canone no Supabase | — | 4 | Somente `canone_control`, RLS ligada, sem policies |
| 26 módulos homologados | 26 | 0 comprovados | Preview de UI ≠ homologação |
| Produção | GO com todos os gates | NO-GO | Sem migração remota/autorização |

O percentual global de entrega **não é calculável** até concluir a recuperação do inventário e definir denominadores por frente.

## S22 — Recover, compare, deduplicate (prioridade P0)
| ID | Microtarefa | Evidência exigida | Estado |
|---|---|---|---|
| S22-01 | Formalizar repositório e estado inicial | README + commit | PASS |
| S22-02 | Localizar origem oficial do código S21 (Git/arquivos/exports) | URL, ref, SHA256 e data | TODO |
| S22-03 | Inventariar os 30 arquivos SQL + dependencies | Manifesto por arquivo, ordem, impacto | TODO |
| S22-04 | Localizar implementação dos 26 módulos e motor | Matriz módulo→rota→API→tabelas→testes | TODO |
| S22-05 | Recuperar evidência primária dos 261 testes | Workflow/run/artefato/commit | TODO |
| S22-06 | Comparar código, Vercel, Supabase e relatórios | Crosswalk, divergências e decisão | TODO |
| S22-07 | Deduplicar preservando licenças/proveniência | Hashes e equivalência demonstrada | TODO |
| S22-08 | Abrir PR de integração isolada, sem deploy | Diff, testes, riscos, rollback | TODO |

## S23 — Banco e contratos
- S23-01: criar ambiente PostgreSQL 17 descartável e seed exclusivamente sintética.
- S23-02: reescrever/validar as referências genéricas e dependências SQL com schemas `canone_*`, **sem tocar schemas CE/CKO/NCOS**.
- S23-03: conferir ownership, grants mínimos, RLS, views com `security_invoker`, search_path e funções privilegiadas.
- S23-04: matriz migração→objetos→testes→rollback; executar 30/30 no ambiente isolado, comparar schema diff e restaurar backup.
- S23-05: somente após aceite independente, preparar plano separado de staging; nenhum SQL de domínio em produção nesta fase.

## S24 — Backend e motor central
- S24-01: definir identidade, perfis e permissões (RBAC/ABAC) com testes de abuso e isolamento.
- S24-02: implementar APIs versionadas, motor de avaliação, persistência, auditoria e idempotência.
- S24-03: corrigir erros de ownership/roles herdados e confirmar fronteiras de dados.
- S24-04: validação de segurança (authn/authz, exposição de segredos, endpoints, rate limiting), observabilidade e desempenho.

## S25 — Módulos e normativos
- S25-01: inventariar 26 módulos com escopo funcional e critérios individualizados.
- S25-02: testar casos positivos/negativos, mobile/acessibilidade, persistência, exportação e E2E.
- S25-03: referências CFC/Senado e outras normas somente com fonte oficial, versão, vigência, hash do documento quando licenciado e direitos de uso.
- S25-04: revisão técnica/contábil/editorial/jurídica por item; fontes sem autorização permanecem HOLD.

## S26 — Homologação e liberação
- S26-01: CI, testes de carga, pentest dirigido, backup/restauração e rollback.
- S26-02: preview externo homologado com autenticação, integrações e audit trails.
- S26-03: matriz final de riscos/gates; aceite maker/checker/auditor independente.
- S26-04: produção **somente por ordem específica após GO documentado**.

## Governança de execução
Cada tarefa possui `id/status/owner/fonte/hash/commit/teste/bloqueio/data`. Estados: `TODO`, `IN_PROGRESS`, `PASS`, `FAIL`, `HOLD_SOURCE`, `HOLD_RIGHTS`, `HOLD_SECURITY`, `HOLD_HUMAN`. HOLD não bloqueia pesquisa ou implementação segura, mas **impede promoção do item ao uso operacional**. Não forçar gate verde sem evidência.

## Dependências e fontes
- GitHub: repositório atual `auditeduca/canone`; artefatos legados S21 ainda a localizar.
- Supabase: Calculadoras-Smart, schemas reservados `canone_*`, só READ_ONLY até staging autorizado.
- Vercel: `canone-contabilidade-preview`, preview candidato READY, sem aceite funcional.
- Normativas externas: CFC, legislação oficial e órgãos competentes; validar versão/vigência e direitos.
- Fontes do usuário: arquivos ZIP, backups ou exportações a localizar antes de afirmar completude.

**Decisão vigente:** manter `NO-GO` e executar S22 de forma rastreável.