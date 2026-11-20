# 09 · Prova aplicada e gabarito oficial

> Este documento descreve o que o banco faz com **prova** e **gabarito** — as
> duas coisas que o acervo real tem e que o schema até a migration 018 não
> tinha casa nenhuma.

## O problema que a 018 resolve

O acervo (`provas_cfc`, ambiente de extração) tem, segundo o catálogo:

| | |
|---|---|
| variantes de prova | **56** (23 de Suficiência × 50 questões + 33 da EQT × 25) |
| questões | **1.975** (Fonte: `scripts/prova-forma-acervo.mjs`) |
| com gabarito | **1.941** → **34 anuladas** (Fonte: catálogo do acervo) |
| gabaritos | **43 definitivos** + **13 preliminares** (a rodada 2026.2, cujo definitivo não saiu) |
| variantes por exame | **4 paralelas** (T01, T02, T03, T04) |

O schema anterior tratava o gabarito como uma coluna booleana
(`learning.item_option.is_correct`) e a prova como um simulado
(`learning.mock_exam`). As duas coisas estavam erradas:

1. **A prova aplicada não é um simulado.** O mesmo exame é aplicado em 4
   variantes paralelas — 4 conjuntos de questões, 4 gabaritos, a mesma data.
2. **O gabarito oficial não é um booleano.** Ele tem ciclo de vida
   (preliminar → definitivo), tem anulação (questão anulada não tem resposta)
   e tem procedência (de qual PDF oficial veio, com que extração).
3. **A questão anulada não cabia.** A regra de publicação exige exatamente 1
   alternativa correta; uma questão anulada não tem gabarito nenhum. Sem a
   018, as 34 anuladas do acervo simplesmente não entrariam.

## A estrutura

```
taxonomy.exam_edition        a RODADA (2025.1, 2026.2 …)
  └─ taxonomy.exam_track     o EXAME dentro da rodada
       (suficiencia | eqt + especialidade: BCB, CVM, SUSEP, Previc, QTG, Perito)
       └─ learning.exam_form  a VARIANTE da prova (T01..T04)
            └─ learning.exam_form_item   a ordem das questões (posição → item)

learning.answer_key          o GABARITO (preliminar | definitivo) + procedência
  └─ learning.answer_key_entry   a resposta por posição (letra OU anulada)
```

**Por que o número de questões mora na trilha, e não na rodada.** A
Suficiência e a EQT acontecem na *mesma* rodada — 2025.1 tem as duas — e a
Suficiência tem 50 questões enquanto a EQT tem 25. Um número só na rodada
seria mentira para uma das duas.

**Por que a ordem é dada.** O gabarito do CFC se refere a **posições**
("questão 37"), não a enunciados. Por isso `exam_form_item` guarda a
posição, e a chave da alternativa é `letra` + `posição`.

## As regras que o banco impõe

| # | Regra | Onde | Como se prova |
|---|---|---|---|
| 1 | **Gabarito definitivo exige a prova inteira** — não se sela uma prova pela metade | `assert_answer_key_complete` (constraint trigger deferido) | `09-provas-gabarito` |
| 2 | **Gabarito definitivo exige todas as posições, sem buraco** | idem | idem |
| 3 | **A letra do gabarito tem que existir entre as alternativas** | `check_answer_key_entry` | idem |
| 4 | **A posição tem que existir na prova** | idem | idem |
| 5 | **Um definitivo e um preliminar por variante** | índices únicos parciais | idem |
| 6 | **O definitivo substitui o preliminar da mesma prova** | `check_answer_key_lineage` | idem |
| 7 | **O gabarito oficial tem precedência sobre o payload** | `set_item_correct` + `apply_answer_key` | idem |
| 8 | **Questão anulada não tem resposta** — e anular uma questão publicada é recusado | `clear_item_correct` | idem |
| 9 | **O veredito distingue `anulada` de `errada`** | `learning.grade_answer` | idem |
| 10 | **O gabarito não é alcançável pelo assinante** | privilégio (017/018) + view | `09` e `04-rls` |
| 11 | **A trilha da Suficência não pode discordar da rodada** | `check_exam_track_numbers` | idem |
| 12 | **A letra do item é DERIVADA** — escrever por cima da letra oficial é recusado | `reconcile_item_correct` (021) | idem |

### O detalhe que faz a diferença: a regra 3

O acervo foi extraído de PDFs por parser, e o defeito clássico dessa
extração é a **prova desalinhada**: o parser perde uma seção do PDF de
gabarito, e a letra da questão 37 passa a ser a letra da questão 36. O
acervo real já teve esse bug — e ele foi corrigido no pipeline de extração,
não no banco.

No banco, a regra 3 torna o desalinhamento **impossível de importar em
silêncio**: a letra que o gabarito aponta tem que existir entre as
alternativas daquela questão. A extração errada não entra — ela é recusada,
com a posição e a alternativa na mensagem.

### A regra 1 e 2 são diferidas, e por quê

`assert_answer_key_complete` é um **constraint trigger `DEFERRABLE
INITIALLY DEFERRED`**: a verificação roda no `COMMIT`, quando as entradas já
foram inseridas. Uma validação immediate só valeria na entrada — e
"regra que só vale na entrada" é regra morta. É a mesma lição que o
`review_event` append-only ensinou.

## O veredito

`learning.grade_answer(item, alternativa)` deixou de devolver booleano:

```sql
SELECT learning.grade_answer('…uuid…', 'C');  -- 'correta' | 'errada' | 'anulada'
```

- Se o item pertence a uma prova com gabarito vigente, o veredito vem do
  **gabarito oficial** (definitivo antes do preliminar).
- Se não há gabarito oficial, vale o gabarito do próprio item.
- **Anulada não é errada.** Uma questão anulada pelo CFC não pode ser
  "errada" — o candidato não tem como errá-la. Devolver `errada` seria
  mentir sobre o próprio exame.

A alternativa correta **nunca sai do servidor**: o assinante não tem
privilégio em `learning.item_option` nem em `learning.answer_key`, e o
gabarito de uma prova real só é revelado a quem **já terminou a tentativa**
(`learning.reveal_exam_key`).

## A tentativa

`learning.exam_attempt` é a resposta do candidato a uma prova;
`learning.exam_attempt_answer` guarda a resposta e o **veredito do
servidor**, questão por questão. A identidade vem do contexto (`SET LOCAL
app.current_user_id`) — nenhuma função aceita `userId`.

**Não existe coluna de nota.** A regra de cálculo (o que acontece com a
questão anulada no denominador, qual o arredondamento) depende do edital de
cada edição, e o Cânone não tem essa fonte. Guardar o dado bruto é honesto;
calcular aprovação sem fonte seria inventar número.

## A ingestão do acervo

`ops.import_corpus_form(jsonb)` é a ponte entre o acervo (JSON, em outro
ambiente) e o schema. Ela escreve **sempre pela mesma porta** — payload →
projeção por trigger → gabarito — o que torna a escrita paralela
estruturalmente impossível.

O contrato de entrada é o catálogo do acervo:

```json
{
  "id": "cfc_suf_2024_2_T01", "ano": 2024, "edicao": 2,
  "tipo_prova": "T01", "exam_type": "Suf", "banca": "FGV",
  "gabarito_type": "definitive",
  "questoes": [{ "numero": 1, "gabarito": "A", "enunciado": "…", "alternativas": { "A": "…", "B": "…", "C": "…", "D": "…" } }]
}
```

Decisões de honestidade da ingestão:

- **O enunciado é lido defensivamente** (vários nomes de campo) e a
  **ausência de enunciado é erro** — uma questão sem enunciado é perda
  silenciosa, e perda silenciosa é o que o acervo não pode ter.
- **Conflito de número de questões é conflito**, não sobrescrita: a mesma
  rodada com outro número de questões recusa a importação.
- **É idempotente**: rodar duas vezes não duplica nem diverge.
- **O vocabulário é traduzido explicitamente**: o acervo fala
  `definitive/preliminary`, o banco fala `definitivo/preliminar`.

## A prova de forma

`node scripts/prova-forma-acervo.mjs` monta o acervo inteiro — 56 variantes,
1.975 questões, 34 anuladas, 43 definitivos e 13 preliminares (Fonte:
catálogo do acervo) — pela mesma porta da ingestão, e confere os
invariantes depois. Não é teste de
velocidade: é a prova de que a estrutura comporta o acervo real.

A **distribuição por rodada** do script é uma suposição (o acervo real está
em outro ambiente e traz a distribuição exata). O que a prova fixa são os
totais e a forma.

## O QA adversarial (e os furos que ele abriu)

Nenhuma regra acima foi considerada pronta por ter um teste. Um **agente
independente** (que não escreveu nenhuma linha do schema) mediu o
comportamento e tentou quebrar cada uma. Ele encontrou **cinco furos
reais** — todos reproduzíveis, todos fechados em migrations novas:

| # | O furo | Como o QA mediu | O conserto |
|---|---|---|---|
| 1 | A letra oficial podia ser **desmarcada** — a projeção dizia "nenhuma correta" e o veredito dizia 'correta' | `UPDATE item_option SET is_correct=false` na letra do gabarito | 022: a letra é derivada nos **dois** sentidos, num constraint trigger deferido |
| 2 | A **prova selada** podia ser desmontada: apagar uma posição deixava o gabarito apontando para o nada | `DELETE FROM exam_form_item` numa prova com gabarito definitivo | 022: prova com gabarito definitivo é **selada** (reimportar a mesma prova continua idempotente) |
| 3 | A **área era um GUC de texto livre**: o assinante revelava o gabarito antes de terminar | `SET app.current_area='staff'` como assinante | 023: a área vem do **PAPEL** (`current_user`), que só muda por `SET ROLE` |
| 4 | O `INSERT` criava a **segunda alternativa correta** | `INSERT ... is_correct=true` numa questão que já tinha gabarito | 023: a regra conta o estado **depois** da mudança |
| 5 | O **conflito de número de questões** era furável pelo gabarito 'preliminar' | importar 30 questões numa trilha que declara 50 | 023: o conflito é contra a **TRILHA**, em qualquer status de gabarito |

A lição que fica: **um teste verde prova que a regra existe, não que ela
fecha.** O furo 3 existia com um teste que passava — a regra estava
escrita, documentada eComments, e não valia. O QA mediu o estrago, não a
intenção.

## O que ainda está em aberto

- **A data das rodadas passadas.** `exam_edition.application_date` é NULL
  para 2022–2025: existe o PDF, mas a data não foi conferida na fonte. Um
  NULL explícito é honesto; uma data inventada não é. A regra que fica é:
  rodada **agendada** tem data.
- **A nota de corte da EQT.** `exam_track.passing_score` é NULL para as
  trilhas de EQT — depende do edital de cada especialidade.
- **A regra de aprovação.** Sem fonte, o banco não calcula nota. Quando a
  fonte aparecer, a regra entra como dado, não como código solto.
- **O papel de sistema.** `reconcile_item_correct` é `SECURITY DEFINER` e
  lê o gabarito com o privilégio de quem o mantém. Em produção, o dono da
  função é o papel da migration, que está sujeito ao `FORCE ROW LEVEL
  SECURITY` — e o PGlite (superuser) **não reproduz** essa condição. A
  pendência é um papel de sistema com `BYPASSRLS` que possua as funções
  `SECURITY DEFINER`; até lá, a regra é *fail-closed*: se o gabarito não
  puder ser lido, a escrita é recusada (ruidosa), nunca aceita em silêncio.
- **A ordem dos triggers.** Em Postgres os triggers `AFTER` disparam no fim
  do statement: um `UPDATE` de várias linhas encontra antes a regra de
  "uma alternativa correta" (que é `BEFORE`). O resultado é o mesmo — o
  statement aborta e nada é gravado — mas a mensagem muda. Vale saber
  quando um teste falha com outra mensagem que a esperada.
