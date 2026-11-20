# Cânone — Política EDITORIAL.RIGHTS.v1 / F3-REC-07

**Data:** 20/11/2026. **Regime:** `NO_GO`, `HOLD_RIGHTS` para terceiros sem prova de licença. O registry documenta **estado interno de controle**, não constitui título jurídico nem licença.

A modelagem S22 existente separa `editorial.source`, `editorial.verification`, `content_item`, `content_item_version`, `item_option` e `answer_key`. Esses vínculos provam rastreabilidade, **não** direito de reutilização comercial. Divulgação de arquivos em portal de concurso tampouco comprova uma licença ampla. A Lei 9.610/1998 exige análise sobre as utilizações e exceções aplicáveis; a decisão de direitos da obra deve ser comprovada separadamente, inclusive para reprodução digital e distribuição comercial.

## Máquina de estados

- `HOLD_RIGHTS`: origem mapeada, mas sem autorização documental verificada; não exportável, não vendável e não entregue ao aluno.
- `REJECTED`: evidência ou uso recusado; não exportável.
- `TEST_ONLY`: obra sintética criada para CI efêmero, com fonte e dois revisores **sintéticos**. Não é autorizada para publicação, compartilhamento real ou materiais comerciais.
- `APPROVED_FOR_PUBLICATION`: **intencionalmente indisponível** na política v1. Sua criação em revisão futura exige termo/licença com identificação do titular, autorização específica para modalidades de uso, território, prazo, prova documental com hash, verificação editorial independente, aprovação jurídica humana e rollback/revogação; uma alteração manual de JSON não pode transformar um HOLD em GO.

O registro versionado `governance/editorial_rights_registry_v1.json` contém cinco itens: **2 originais sintéticos TEST_ONLY**, duas páginas oficiais de provas FGV como `HOLD_RIGHTS` e o banco editorial em quarentena como `HOLD_RIGHTS`. URLs servem como fonte/proveniência, não são prova de licenciamento.

A verificação executa `python3 tools/f3_rec07_editorial_rights_gate.py --check`, mais testes negativos `python3 -m unittest tests/test_f3_rec07_rights_gate.py`: enum/status desconhecido, campo oculto, liberação precoce, escopo fora do CI, duplicações, revisores não independentes, expiração, lacunas de base. Publicação produtiva continua `NO_GO` mesmo com registro válido.

## Fontes oficiais consultadas

- Lei nº 9.610/1998, texto legislativo na Câmara dos Deputados: https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html
- Orientações do Ministério da Cultura: https://www.gov.br/cultura/pt-br/assuntos/direitos-autorais/perguntas-frequentes/perguntas-frequentes
- Índice oficial de exames FGV: https://conhecimento.fgv.br/exames/cfc-exame-de-suficiencia

## Próximos controles

F3-REC-07 no SQL de CI: cruzar **status de direitos**, versão do item, fonte/URL, digest de conteúdo, dois revisores diferentes, escopo e prazo antes de emitir qualquer questão. A promoção editorial de F4 e a autenticação real de F8 ficam para gates independentes.

## F3-REC-07 — prova no PostgreSQL de CI

O SQL `tests/sql/f3_rec07_rights_guard_ephemeral.sql` cria a tabela **temporária por ambiente** `rights_release_ci` contendo `content_item_id`, versão vigente, fonte, `TEST_ONLY/HOLD_RIGHTS/REJECTED`, escopo, impressão digital do conteúdo (enunciado + todas alternativas), evidência sintética, revisores distintos e validade. A nova função segura de teste `exam_questions` verifica a tabela **antes** de entregar questões pelo gateway. Sua predecessora F3-REC-06 é renomeada e perde `EXECUTE` de `service_role`.

O CI testa o veto de toda a prova quando **um único item** entra em `HOLD_RIGHTS`, sofre alteração de digest ou expira. Após restaurar a fixture, a aplicação continua realizando a prova normalmente. `TEST_ONLY` permanece um marcador **exclusivamente sintético**; nenhum desses registros representa aprovação de direitos de terceiros. `NO_GO`.
