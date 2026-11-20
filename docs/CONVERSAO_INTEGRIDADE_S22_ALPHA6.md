# Cânone — integridade de provas, eventos e auditoria (0.23.0-alpha.6)

**Escopo:** SQL candidato exclusivamente para banco PostgreSQL descartável. Não aplicar em Supabase compartilhado nem em produção. O gerador não cria branches, usuários, grants operacionais ou migrations automaticamente aplicáveis.

## Resultado desta rodada

- **7 funções `SECURITY INVOKER`** com `search_path=pg_catalog`; os privilégios `EXECUTE` das funções trigger são revogados de `PUBLIC`, `anon` e `authenticated`.
- **8 triggers de integridade explícitos:** imutabilidade de eventos de revisão e auditoria; inserção/alteração/remoção de entrada de gabarito definitivo; alteração e exclusão de gabarito definitivo; bloqueio de alteração da composição de prova selada; e bloqueio de mudança de quantidade de questões em exame e edição após selo.
- **12 triggers para `updated_at`**, explicitamente permitidos em tabelas já convertidas. O trigger legado de `identity.account` não é recriado porque `auth.users` pertence ao Supabase Auth.
- São **20 definições de trigger** produzidas; o histórico original tem 26 instruções `CREATE TRIGGER` e também um bloco `DO` que criava triggers dinamicamente. O inventário não deve somar esses números como se fossem objetos distintos no estado final.
- As **30 migrations históricas** são conferidas por SHA-256 antes de gerar a saída. Cada função possui arquivo, linha e hash do corpo-fonte no manifesto.

## Alterações deliberadas em relação ao legado

1. A proteção do gabarito definitivo agora rejeita **inserção de nova entrada** e alteração de proprietário do vínculo, além de `UPDATE`/`DELETE`. A versão original bloqueava apenas UPDATE/DELETE das entradas.
2. Um gabarito definitivo **não pode ser excluído**. No legado, a função de proteção compartilhada com o `BEFORE DELETE` referenciava campos `NEW` usados apenas no fluxo de UPDATE; o novo contrato distingue explicitamente os eventos.
3. A composição de uma prova selada rejeita adição, remoção ou troca; somente UPDATE idempotente, sem mudança de campos, é aceito.
4. A quantidade de questões de `exam_track` ou `exam_edition` não pode diminuir nem aumentar quando uma prova relacionada já tem gabarito definitivo. Para a edição, preserva-se o escopo de `suficiencia` do S22.
5. Eventos `canone_learning.review_event` e registros `canone_audit.audit_log` são append-only para UPDATE/DELETE. **A formação e verificação da cadeia de hashes de auditoria NÃO foi portada neste lote**; nenhum sucesso de testes deve ser interpretado como auditoria operacional completa.

## Arquivos

- [Gerador Python](../tools/convert_canone_integrity.py)
- [SQL 007 — candidatos de integridade](../staging/supabase/007_integrity_triggers.candidate.sql.txt)
- [Manifesto e hashes](../staging/supabase/CANONE_INTEGRITY_ALPHA6_MANIFEST.json)
- [Testes unitários estáticos](../tests/test_canone_integrity_conversion.py)
- [Teste PostgreSQL em memória](../tests/canone_integrity_pglite.mjs)

## Comandos sem conexão remota

```bash
python3 tools/convert_canone_integrity.py --root . --check
python3 -m unittest discover -s tests -p 'test_canone_integrity_conversion.py' -v
node tests/canone_integrity_pglite.mjs
```

`node` exige as dependências npm do backend instaladas no CI; a suíte recusa as variáveis mais comuns de conexão remota. O teste usa contas e conteúdo sintéticos, sem texto de questões reais.

## Validações obrigatórias para as etapas seguintes

- Concorrência: selar gabarito enquanto outra transação insere entrada ou modifica a prova; lock ordering e transações idempotentes devem ser testados em PostgreSQL 17, não apenas PGlite.
- Completude: o selo de gabarito definitivo deve exigir exatamente as posições esperadas; as funções históricas de validação de gabarito ficam na fila, sem cópia insegura.
- Auditoria: implementar o cálculo ordenado e atômico da cadeia de hash e testar concorrência, auditoria de suporte e acesso append-only por papéis reais.
- Autorização: manter `anon` e `authenticated` sem concessões gerais em gabaritos, logs, prova selada e funções trigger; verificar `auth.uid()` e políticas RLS reais com o Supabase Auth gerenciado.
- As outras **50 instruções históricas de função** (58 totais menos 1 já portada na alpha.5 e 7 nesta rodada), os triggers específicos não incluídos e as duas views dependentes permanecem inventariados para avanço por lotes.

**Gate de produção: `NO_GO`. Desenvolvimento e versionamento: somente `main`.**
