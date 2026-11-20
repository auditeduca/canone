# Cânone V9 — S18 | Prévia protegida | NO-GO de produção

Data-base: 2026-11-14. Entrega autoral isolada; nenhuma mudança de esquema ou backend.

## Origem e objetivos

Partiu-se da branch local S17 `fb1c67f851bb6b3f3133109cd4845ab1328958cf`.
A S18 cria um único mecanismo reutilizável de fichas de estudo, mapeado para cinco IDs já presentes no catálogo canônico de 26 módulos, sem alterar o JSON de produto ou seus geradores.

- `contabilidade-ilustrada`: fichas de comparação e contexto, sem figuras normativas prontas.
- `cpc-visual`: mapa pessoal de tópicos e referências declaradas; nenhuma validação contra CPC oficial.
- `auditoria-pratica`: proposta de papel de trabalho **fictício**, sem conclusão profissional.
- `pericia`: quesitos e métodos de estudo **fictícios**, sem laudo.
- `contabilidade-publica`: eventos sintéticos e propostas de classificação, sem validação MCASP/LRF.

Funcionalidades: criação, edição, exclusão, pesquisa, estatísticas de referência declarada e exportação JSON por módulo. Os dados são mantidos no estado de React da aba e desaparecem ao recarregar. Nenhum armazenamento, submissão, serviço de autenticação, cobrança, servidor ou compartilhamento.

## Regras de qualidade e proveniência

`provenance=user-authored-unverified`, `HOLD_SOURCE` para registros sem fonte e `USER_DECLARED_UNVERIFIED` para referência digitada. Nenhuma das duas categorias constitui homologação. Até 25 fichas por módulo e 100 na sessão, com limites de campo; exclusão/edição por ID protegida contra troca de domínio. A exportação não eleva a autoridade do material e não inclui gabaritos.

## Evidências desta iteração

- Testes frontend Node 22 com `--experimental-strip-types`: **155/155 PASS**. Arquivo de log `CANONE_S18_TESTES_LOCAL_2026-11-14.log`.
- Testes de portabilidade S11: **14/14 PASS**.
- Testes estáticos de segurança S12: **14/14 PASS**.
- Verificações preparatórias S13: **20/20 PASS**. Esses testes não comprovam execução de migrations em PostgreSQL.
- `30/30` migrations originais: SHA-256 idêntico ao pacote integral S17. Zero alterações de banco.
- Build remoto TypeScript/Vite: **READY** (`63 modules transformed`), sem erros fatais; nove avisos preexistentes de fontes não distribuídas.
- Página `/`, JS `index-wLIX8tKF.js`, CSS `index-BZzbT_5O.css`: HTTP **200**.
- `/api/health`: HTTP **404**, esperado por não publicar o backend.
- Proteção SSO Vercel: habilitada para todos os deployments. `X-Robots-Tag: noindex, nofollow, noarchive` na prévia.
- Paridade fonte/deployment por SHA-1: **57/57** arquivos frontend, zero divergência.

## Publicação

Projeto: `canone-contabilidade-preview`, framework Vite.

Deployment: `dpl_67VjfwqCMxJLQg1pgzHzRDdzPmyt`.
URL: https://canone-contabilidade-preview-l3q538r7f-leivisml-7739s-projects.vercel.app
Ambiente: **preview**; `target=null`. Envio de fontes pelo conector Vercel (não push GitHub). Nenhum domínio de produção associado ou promovido.

## Restrições e pendências

- **5 módulos restantes sem ferramenta interativa equivalente:** `duelo`, `simulado-adaptativo`, `podcast`, `videodulas`, `offline`.
- **0/26** homologados para operação comercial. Exibição visual ≠ aprovação normativa.
- PostgreSQL real descartável, RLS, testes concorrentes e auth: **HOLD_RUNTIME / NO-GO**.
- Fontes legais/normativas oficiais, suas versões, trechos, interpretações e conteúdo editorial: **não conferidos ou promovidos**.
- Browser E2E de formulários, edição, navegação e exportação: **não executado**. HTTP e build não substituem testes de interação.
- Frontend publicado no Vercel via upload; Git registrado **localmente**, ainda não push remoto.
- Supabase compartilhado, backend oficial, assinaturas, notas e aprovação de questões permanecem intocados.

## Critério de continuidade

S19 candidata: cinco módulos restantes, sem simular autoridade de correção ou prometer duelo em tempo real antes de existir backend. Priorizar criação de conteúdo original do usuário, exportação verificável e testes em navegador. Produção só após PostgreSQL/RLS em banco descartável e revisão humana das fontes.
