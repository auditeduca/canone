# F3-REC-05 — catálogo restrito, histórico e recuperação (candidato)

**20/11/2026 — escrita local e CI obrigatório — NO_GO.**

A origem S22 já possui tabelas `exam_form`, `exam_form_item`, `exam_attempt`, `exam_attempt_answer` e serviço de `progresso`. Sem criar tabelas, a candidata `tests/sql/f3_rec05_private_reads_ephemeral.sql` acrescenta três funções de consulta somente-leitura e privadas, com `SECURITY DEFINER`, busca em contexto `auth.uid()`, verificação de benefício `cfc.exam`, `REVOKE` para browser e `GRANT EXECUTE` exclusivo a `service_role` no gateway. **Este SQL de teste não é migration aplicável a projetos gerenciados sem F8.**

- `POST /api/v1/exam/catalog {}`: somente ID/rótulo/quantidade de versões com edição realizada e gabarito definitivo. **Não transporta enunciado, alternativas ou chave.** Metadados ainda não liberam uso de conteúdo não homologado.
- `POST /api/v1/exam/history {}`: até 20 tentativas do aluno, status, datas, respostas e contagem de corretas **somente após conclusão**.
- `POST /api/v1/exam/resume {attemptId}`: respostas escolhidas do usuário, contagens e estado, sem `verdict` ou `correct_option`. Outro usuário recebe resposta indistinguível de tentativa inexistente (`404`).
- O gateway existente conserva autenticação verificada, contexto transacional, veto à assinatura revogada e tratamento de erros redigidos.

A próxima etapa React deve comparar `formId` com catálogo permitido, reconstruir estado após reload e exibir histórico. O texto/alternativas continuam como fixture local para o CI; catalogação editorial autorizada é um gate independente. `NO_GO` para publicação.

Fontes: `source-s22/backend/src/areas/public/catalogo.ts`, `source-s22/backend/src/areas/subscriber/progresso.ts`, migrations 006, 018 e 019, alpha.8 e alpha.9.

## Testes de ponta a ponta

O job PG17 após alpha9 aplicará a candidata 011 apenas no contêiner efêmero, vetará EXECUTE de `authenticated` e realizará a jornada React real com recarregamento, listagem de tentativas do próprio aluno, recuperação do ID em sessão autenticada, respostas restantes e finalização. Negativas para B/usuário não autorizado e proteção do gabarito permanecem. Resultados só serão declarados após CI.
