# Cânone — fonte S22 recuperada (quarentena)
**Situação:** NO-GO / NÃO EXECUTAR MIGRAÇÕES OU DEPLOY.

Este diretório é uma **cópia de código selecionado**, extraída do bundle Git histórico `164fa4df8e99de29e35c41d35a25f6ee0b2c6462`, armazenada sob `source-s22/` para preservar a `main` e impedir ativação automática de workflows legados. **Não** é a raiz de release.

- Origem: `CANONE_V9_S22_PG17_LOCAL_HISTORICO_2026-11-15.bundle` e ZIP correspondente.
- 476 arquivos Git versionados; **389** incluídos nesta proposta, **87** mantidos fora por precaução (evidências, logs, snapshots, conteúdo normativo/editorial potencial e patches auxiliares).
- Os **30 arquivos SQL originais** estão preservados sob `backend/db/migrations/`. As propostas S22 de overlays **não** foram aprovadas para execução em bancos permanentes.
- Verificação desta rodada: **277/277** testes locais PASS; `s22_release_gate.py --strict` recusou a produção com exit **41**.
- O pacote anterior não contém um arquivo `LICENSE`; **não presumir direitos sobre materiais de terceiros**. Não há licença nova concedida por esta importação.
- Varredura estática de padrões conhecidos para segredos retornou zero correspondências nos 476 arquivos rastreados, mas **não é auditoria exaustiva de credenciais ou dados pessoais**.
- Conteúdo normativo CFC/Senado, gabaritos e provas reais requerem conferência de original, versão, direitos e autorização de publicação por item.
- A diretriz de produto vigente é S23 v0.3: plataforma de preparação ao **Exame de Suficiência** e depois **EQT**; não usar o antigo planejamento genérico de ERP como escopo da V1.

Detalhes: `../inventories/source/CANONE_S22_SOURCE_IMPORT_MANIFEST.json` e `../docs/PLANO_MIGRACAO_CANONE_SUPABASE_EXCLUSIVO.md`.

**Não mesclar sem revisão independente, testes CI e plano de tratamento dos 87 excluídos.**
