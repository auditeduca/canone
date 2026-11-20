# Histórico de versões — Cânone

Todas as alterações de engenharia e de conteúdo do Cânone serão versionadas **somente na branch `main`**, por commits Git e registro de versão. O projeto permanece em desenvolvimento; a existência de uma versão não significa que ela esteja aprovada para produção.

Formato de versão: **MAJOR.MINOR.PATCH[-PRERELEASE]**, em que:
- `0.x.y`: software em construção, contratos ainda sujeitos a mudança;
- `-alpha.N`: inventário, integração e testes internos;
- `-beta.N`: fluxo funcional candidato a homologação;
- `-rc.N`: candidata a aprovação, sujeita a revisão independente;
- estável: somente quando todos os gates forem `GO`.

## [0.23.0-alpha.1] — 2026-11-19

**Estado:** `SOURCE_RECOVERED / CI_OFFLINE_ONLY / RELEASE_NO_GO`.

### Acrescentado
- Fonte histórica S22 recuperada sob `source-s22/` (389 arquivos), isolada da raiz de publicação.
- 30 migrations originais **versionadas, nunca aplicadas automaticamente**.
- Manifesto de integridade por SHA-256 e 87 exclusões sob `HOLD_RIGHTS` / revisão.
- Planejamento S23 para Exame de Suficiência e EQT/CFC, com quatro matrizes CSV.
- Inventário do Supabase compartilhado: 81 relações, 54 tabelas e 27 views candidatas; colunas, ACL, FK e registros das 4 tabelas nativas de controle.
- Histórico de descobertas ChatGPT/Google Drive com deduplicação nominal por referência.
- CI de recuperação sem deploy, hashes e suíte local, mais gate `NO-GO`.
- Documentação para migrar seletivamente a um projeto Supabase exclusivo, ainda inexistente.

### Validação
- **389/389 hashes conferidos** no workflow de recuperação;
- **277/277 testes locais** com dependência de compatibilidade TS5.8.3 isolada no CI;
- `s22_release_gate.py --strict`: bloqueio `NO-GO` intencional, código 41;
- Não foram reexecutados neste GitHub os testes completos de PostgreSQL 17, browser E2E, pagamentos ou gabaritos de exame reais.

### Pendências
Segurança RLS/roles e funções privilegiadas, direitos/fontes oficiais, revisão dos 87 excluídos, staging Supabase independente, teste integrado aluno CFC e aceite humano. **Proibido declarar GO ou executar migrations a partir desta versão.**

_Registro de versão documental: não implica criação de tag Git, release GitHub ou deploy._
