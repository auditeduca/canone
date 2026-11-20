# Cânone — confronto com Supabase, GitHub e Vercel
Data-base: 2026-11-13/14. Origem: pacotes anexados e inspeção somente leitura das conexões.

## Baseline local
- Aplicativo React/Vite/TypeScript (`app/`) extraído de `canone-app.zip`.
- Backend TypeScript/PostgreSQL (`backend/`) extraído de `canone-backend-schema (2).zip`.
- 30 migrations previstas; 90 tabelas e views conforme documentação do backend.
- Domínios exigidos: `identity`, `editorial`, `taxonomy`, `norms`, `learning`, `commerce`, `admin`, `ops`, `audit`; acesso em `subscriber` e `public`.
- O pacote não contém a interface de responder simulado, provedor de magic link, checkout ou documentos legais.
- Os testes declarados nos manifestos não foram novamente reproduzidos como PASS nesta etapa.

## Supabase — inspeção remota somente leitura
- Projetos visíveis: `Calculadoras-Smart` (ref `pgsybzggewhinaniybiy`) e `SOT-10-09-2026` (ref `hcqukuotfwflmebjygam`).
- Não há namespace `canone` detectado e nenhuma implantação dos nove domínios localizada.
- `Calculadoras-Smart` contém `contabilidade_cfc`: 11 tabelas, 50 questões registradas em `questions`, além de registros PMO e normativos (Audit Educa).
- `SOT-10-09-2026` contém `wutrib` (42 tabelas) e `public` (10 tabelas); não é o Cânone.
- Seis tabelas de `contabilidade_cfc` estão sem RLS (`sources`, `questions`, `pmo_workstreams`, `pmo_source_register`, `pmo_findings`, `pmo_sync_runs`).
- Verificação adicional: `anon` e `authenticated` não têm `USAGE` do schema nem `SELECT` nas seis tabelas; portanto, não foi demonstrada exposição direta por esses papéis. Recomenda-se auditoria de RLS, grants e Data API antes de qualquer mudança.
- Nenhum SQL de mutação ou migração foi executado nos bancos.

## GitHub — inspeção remota
- Repositório com escrita acessível na conexão atual: `IndiciumFIN/dev-chatgpt-workspace` (branch padrão `main`).
- Não foi encontrado repo específico do Cânone; o repositório visível pertence a outro workspace.
- A presente branch `work/canone-conclusao-supabase-vercel` é **local** e portátil; não foi criada no GitHub.
- Antes do push, confirmar/conectar o repo GitHub canônico do Cânone. Não fazer push no workspace ou na main de outro produto.

## Vercel — inspeção remota
- Conta `leivis.ml@gmail.com`: 32 projetos visíveis, sem projeto Cânone.
- Conta `leivis.ml@aol.com`: equipe `auditeducas-projects` bloqueada por falta de grant; link de autorização gerado.
- Projeto Vercel deve ser isolado, usando conexão Git com branch `work/canone-conclusao-supabase-vercel`.
- Frontend Vite: `Root Directory=app`, `Framework=Vite`, `Build Command=npm run typecheck && npm run build`, `Output=dist`.
- A prévia estática não é a operação integrada: backend HTTP ainda requer adaptação de execução/hosting e PostgreSQL dedicado.
- Sem chave/URL do projeto de homologação, NÃO vincular o frontend a bases de outras aplicações ou à produção.

## Próximos gates
1. Confirmar repositório de destino e o acesso Vercel; push da branch local após conferência.
2. Criar projeto Supabase Cânone isolado com custo aprovado, ou selecionar um já existente mediante evidência.
3. Executar migrations sob papéis compatíveis em ambiente de homologação dedicado, testar privilégios/RLS.
4. Corrigir segredos embutíveis em `VITE_*`, autenticação administrativa e sessão do assinante.
5. Implementar a jornada do simulado e os requisitos legais/comerciais.
6. Configurar prévia Vercel e executar CI, E2E, segurança, acessibilidade e UAT.
7. Bloquear publicação até GO/NO-GO humano.

Status: `HOLD_TARGET_IDENTIFICATION`. Nenhum recurso remoto foi criado ou alterado.
