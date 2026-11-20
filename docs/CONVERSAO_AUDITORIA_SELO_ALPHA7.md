# Cânone — auditoria encadeada e selo completo (0.23.0-alpha.7)

**Destinação:** artefato de staging em PostgreSQL isolado; nenhuma escrita no Supabase compartilhado. O SQL `008` é **candidato**, não migration pronta para aplicar automaticamente.

## Origem e limites

O SQL histórico `009_admin_governance.sql` prevê hash encadeado de `audit.audit_log`, mas seu trigger selecionava o último hash sem serializar concorrência e a função de hash não incluía todos os campos de contexto da linha. A migration `024_gabarito_imutavel_regua_fixa.sql` impedia adulteração do definitivo, mas a promoção de preliminar para definitivo não comprovava a completude da prova. O lote alpha.7 trata essas lacunas no schema canônico sem sobrescrever os SQL históricos.

O gerador valida SHA-256 das **30 migrations**, registra as três fontes principais e gera **4 funções novas**, **2 substituições de função** e **2 triggers novos**, além de substituir o evento de um trigger existente.

## Contrato da cadeia de auditoria v2

1. `audit_payload` inclui os **15 campos** operacionais de auditoria, usando tempo como microssegundos desde epoch em vez de texto dependente de fuso horário; `prev_hash` e `row_hash` não entram no conteúdo para evitar autorreferência.
2. `set_row_hash` usa `pg_advisory_xact_lock` e exige transações **READ COMMITTED** antes de atribuir `seq` monotônico, `prev_hash` e `row_hash`. Valores fornecidos no `INSERT` são substituídos.
3. `verify_chain` recalcula o hash de cada linha a partir do conteúdo real e avalia o vínculo com a linha precedente sobre **toda a janela**, mesmo ao filtrar `p_from`.
4. `UPDATE`, `DELETE` e `TRUNCATE` não são permitidos. `anon` e `authenticated` não recebem privilégios sobre auditoria ou a função verificadora.
5. O cutover exige uma tabela de auditoria **vazia**. A migração de uma cadeia preexistente requer um procedimento de reconciliação assinado, sem rehash silencioso.

**Limite criptográfico:** o hash comprova alterações observáveis sob as garantias de acesso do banco; não impede que um superusuário reescreva todos os registros e hashes. Uma âncora independente, imutável e externa ao banco (e procedimento de reconciliação) são exigidos antes de alegar prova de não adulteração contra administradores privilegiados. A serialização por `pg_advisory_xact_lock` ainda precisa de testes com **conexões simultâneas reais no PostgreSQL 17**.

## Selo definitivo

A promoção do gabarito exige simultaneamente:

- gabarito criado como **preliminar**, nunca diretamente como `definitivo`;
- o formulário tem a quantidade esperada de questões definida pela trilha;
- as posições no formulário são contínuas de **1 a N**, com número exato;
- as entradas de gabarito também são contínuas de **1 a N**, com número exato;
- cada posição do formulário tem a posição correspondente no gabarito.

A operação segura trava o formulário antes de contar as posições, e o trigger de composição de prova também obtém o lock do formulário para coordenar com o selo. Uma prova selada segue imutável por alpha.6. O teste adversarial inclui tentativas de selo prematuro, inserção de definitivo direto e edição posterior.

**Concorrência:** a ordem de locks de `answer_key`, `answer_key_entry` e `exam_form` precisa ser exercitada por múltiplas conexões e isolamento em PostgreSQL 17. O smoke em PGlite não comprova ausência de deadlock.

## Testes e reprodução

```bash
python3 tools/convert_canone_audit_seal.py --root . --check
python3 -m unittest discover -s tests -p 'test_canone_audit_seal.py' -v
node tests/canone_audit_seal_pglite.mjs
```

O teste Node exige as dependências npm **já instaladas** no diretório `source-s22/backend`, como no CI. Nenhuma URL de banco externo é permitida. Todas as entidades usadas nos testes são sintéticas, sem conteúdo editorial licenciado.

## Próximas etapas

- PostgreSQL 17 multi-sessão: concorrência dos inserts de auditoria e interleaving entre inclusão de item, entrada de gabarito e selo;
- âncora externa e rotação de chaves/procedimento de verificação de hash para auditoria jurídica;
- funções remanescentes de correção e tentativas, integração JWT Supabase Auth, políticas de serviço e E2E;
- implantação futura em **Supabase exclusivo** somente após PG17 e aprovação formal. Gate operacional: **NO_GO**.

## Resultado independente em PostgreSQL 17.12 — 20/11/2026

A execução [GitHub Actions #44677935551](https://github.com/auditeduca/canone/actions/runs/44677935551), commit `9bce955d489ddb479e4a3a619fe7d0818848bf87`, passou nos dois jobs:

- PGlite: **12 testes Python**, **21 verificações de auditoria/selo**, regressões históricas mantidas.
- PostgreSQL 17.12: execução dos candidatos SQL **001–008** em banco descartável; **12 sessões independentes** de escrita na auditoria, sequência de **1 a 12** e **zero divergências de hash**.
- Concorrência de prova: uma transação manteve o lock do formulário ao finalizar o gabarito, enquanto outra tentou incluir uma terceira posição. A inserção foi **recusada**, o gabarito permaneceu definitivo e a prova manteve duas posições.

O teste é reproduzível por `tests/pg17_alpha7_concurrency.sh` e aceita exclusivamente o ID de contêiner efêmero do GitHub Actions. O teste não comprova todos os interleavings de concorrência, não avalia JWT gerenciado e não substitui a **ancoragem externa** contra reescritas por administradores privilegiados.
