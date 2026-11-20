# Cânone — alpha.8 | tentativas, correção privada e SRS idempotente

**Estado:** candidato para staging PostgreSQL 17 / Supabase **exclusivo**, não aplicado remotamente. Todos os arquivos históricos S22 permanecem intactos. **Somente `main`.**

## Objetivo e proveniência

A reimplementação controlada das migrations `006`, `007`, `012`, `018` e `019` corrige lacunas de segurança do código histórico sem inventar regras de aprovação do Exame de Suficiência/EQT. O gerador `tools/convert_canone_attempt_srs.py` verifica os hashes de **30 migrations** contra o catálogo S5 e produz `009_attempt_grade_srs.candidate.sql.txt` e seu manifesto JSON.

## Contrato operacional

O SQL cria cinco funções privadas em `canone_ops`: `exam_start(form_id)`, `exam_answer(attempt_id, ordinal, alternative)`, `exam_finish(attempt_id)`, `exam_reveal(attempt_id)` e `exam_to_srs(attempt_id, ordinal)`. Todas são `SECURITY DEFINER`, `search_path=pg_catalog`, privilégios de execução retirados de `PUBLIC`, `anon` e `authenticated` e concedidos **apenas a `service_role`**. O schema `canone_ops` **não** deve ser exposto na Data API/PostgREST nem em endpoints RPC para cliente. Um serviço backend autenticado deve verificar o JWT real antes de encaminhar a requisição, vincular o sujeito verificado ao contexto `auth.uid()` e nunca disponibilizar a chave `service_role` ao navegador. **O teste sintético de contexto não comprova validação real de JWT.** O produto ainda não possui adaptador frontend/backend homologado.

`exam_start` só aceita variantes reais com gabarito definitivo. `exam_answer` bloqueia a linha da tentativa (`FOR UPDATE`) antes de validar propriedade e estado. Submissões repetidas substituem a mesma posição, e as contagens são recalculadas por agregação, não incrementadas. Retorna `void`, sem revelar o veredito em andamento. O modelo original mantém o veredito na tabela privada, que não tem `SELECT` para o usuário. O resultado factual (`correta`, `errada`, `anulada`) provém **da posição da variante**, e não de um gabarito global ambíguo por item.

`exam_finish` é serializado, repetível sem efeito colateral e retorna **apenas contagens factuais**, sem nota de corte ou aprovação inventada. `exam_reveal` exige tentativa `concluida`, dono e serviço autorizado. Ainda não inclui o texto do enunciado nem libera acervos editoriais pendentes de licenciamento.

`exam_to_srs` registra revisão sistêmica somente para uma **resposta concluída**. A tabela `canone_learning.exam_review_receipt` (RLS + FORCE e sem privilégios browser) garante unicidade por `(attempt_id, ordinal)` e liga o evento append-only ao estado derivado na **mesma transação**. Retentativas retornam o mesmo `review_event_id`; itens anulados não geram revisão incorreta. O algoritmo `canone-srs-exam-v1` está versionado explicitamente. Ele é um subfluxo de SRS para provas concluídas; não representa a conversão de todos os motores gerais de revisão histórica.

## Segurança e testes

- Verificar sem executar SQL: `python3 tools/convert_canone_attempt_srs.py --root . --check` e `python3 -m unittest discover -s tests -p 'test_canone_attempt_srs.py' -v`.
- Teste PostgreSQL descartável: `node tests/canone_attempt_srs_pglite.mjs` (requer dependências Node do backend histórico; fixtures exclusivamente sintéticos).
- Negativos: cliente não executa funções nem lê notas; usuário B não altera tentativa de A; ausente JWT não inicia; chave só aparece após conclusão; anulação não vira erro; resposta pós-finalização bloqueada.
- Positivos: duas posições, troca de resposta sem inflar contagens, conclusão idempotente, um único evento SRS após tentativa duplicada.

## Limites conhecidos / próximas etapas

Este é um **serviço interno de prova de conceito**, não uma API autorizada a operar com usuários reais. Nenhuma migration SQL foi promovida. É necessário executar no PostgreSQL 17 descartável com múltiplas conexões concorrentes (resposta versus encerramento e duplicatas SRS), usar Auth/JWT gerenciado real, validar o backend de autorização/assinatura, a cadeia de auditoria dos serviços e a autorização normativa/licença das questões, além de estabelecer a regra de avaliação/nota de corte da edição oficial. **`NO_GO` produção** não impede desenvolvimento técnico.
