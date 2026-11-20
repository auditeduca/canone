# 04 · ÁREAS E ACESSO

> Três áreas, três papéis, três conjuntos de views. E uma quarta coisa que
> **não** é uma área: a visão de usuário.

## O mapa

```
┌─────────────────────────────────────────────────────────────────┐
│  ÁREA PÚBLICA — canone_public                                   │
│  Sem login. Só conteúdo publicado e material de referência.     │
│                                                                 │
│  public.v_public_plan      public.v_public_subject               │
│  public.v_public_module    public.v_public_content               │
│  public.v_public_item      (SEM gabarito)                       │
│                                                                 │
│  NÃO vê: learning.item_option · identity.* · learning.* (user)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ÁREA DO ASSINANTE — canone_subscriber                          │
│  Com login. Vê o que é DELE.                                    │
│                                                                 │
│  subscriber.v_my_progress   subscriber.v_my_due                  │
│  subscriber.v_my_history    subscriber.v_my_state                │
│  subscriber.v_item_options  (alternativas SEM gabarito)         │
│                                                                 │
│  NÃO vê: learning.mastery de outro · item_option · account      │
│  NÃO escreve: review_event de outro                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ÁREA ADMINISTRATIVA — canone_staff / canone_admin              │
│  Conteúdo, governança, auditoria.                               │
│                                                                 │
│  NÃO lê learning.mastery / learning.review_event por tabela.    │
│  Só pela PORTA ÚNICA: admin.read_user_progress_as(...)          │
└─────────────────────────────────────────────────────────────────┘
```

## A visão de usuário

O staff **não é** o aluno. Ele lê o dado do aluno *como o aluno*, sob uma
concessão:

```
admin.support_access_grant
  staff_user_id    quem pede
  subject_user_id  de quem é o dado
  scope            progresso | conta | assinatura | completo
  reason           OBRIGATÓRIO, mínimo 10 caracteres
  ticket_ref       chamado
  expires_at       máximo 72 horas (constraint)
  revoked_at       revogação
```

Três recusas, todas do banco:

| Tentativa | Recusa |
|---|---|
| `reason` com menos de 10 caracteres | `ck_grant` (CHECK) |
| `expires_at` além de 72h | `ck_grant_max_duration` (CHECK) |
| grant vencida, revogada, de outro staff ou de outro titular | `admin.read_user_progress_as` (42501) |

E cada leitura é registrada em `admin.support_access_log` — inclusive a
tentativa recusada não deixa rastro de leitura, porque não houve leitura.

### A porta única

```sql
admin.read_user_progress_as(staff_user_id, subject_user_id, grant_id)
RETURNS TABLE (subject_key, subject_label, items_seen, items_mastered,
                items_fragile, items_unseen, accuracy, confidence)
```

`SECURITY DEFINER`: precisa ler `learning.mastery`, que o papel de staff
não tem. E é exatamente esse o ponto — o staff não tem o dado, tem o
**acesso**.

A função recusa quando o grant não pertence ao staff, não cobre o titular,
está vencido, foi revogado, ou o escopo não permite ler progresso. Nos
cinco casos, nada é lido e nada é registrado.

### A concessão expira sozinha

O trigger `trg_expire_support_grants` roda a cada escrita na tabela de
concessões e revoga o que já venceu. Não depende de cron. (E tem trava de
reentrância: sem ela, o UPDATE interno redispara o trigger e estoura a
pilha — foi o que aconteceu, e o teste pegou.)

## A fronteira em três camadas

```
PRIVILÉGIO (017)  →  o papel pode sequer tocar na tabela?
RLS       (014)  →  o papel pode ver ESTA LINHA?
VIEW      (013)  →  o papel enxerga a ATRAVÉS de qual contrato?
```

As três são independentes e nenhuma cobre a outra:

- O papel público tem `SELECT` em `editorial.content_item` — mas o RLS
  filtra por estado público, então rascunho não aparece.
- O papel assinante tem `SELECT` em `learning.review_event` — mas o RLS
  filtra por `user_id = ops.current_user_id()`.
- O papel público **não** tem `SELECT` em `learning.item_option` — o
  gabarito nem chega a ser considered.

> A última linha é a mais importante: em Postgres, "não tem privilégio" e
> "não tem linha" são recusas diferentes, e a segunda não protege nada se
> a primeira está errada. Por isso o gabarito é bloqueado nas **duas**
> camadas.

## A vista pública não vaza rascunho

`public.v_public_content` filtra por `state_definition.is_public`, e o RLS
de `editorial.content_item` filtra pelo mesmo caminho. São duas camadas
com a mesma regra — de propósito: uma view que "esquece" de filtrar é
como se publica item em rascunho.

`public.v_public_item` entrega o item pronto para o cliente, **sem** as
alternativas e **sem** o gabarito. As alternativas vêm pela área do
assinante (`subscriber.v_item_options`), que esconde `is_correct`.

A correção é do servidor:

```sql
learning.grade_answer(item_id, 'A') → true | false
```

`SECURITY DEFINER` — é o servidor que olha o gabarito, e ele devolve só
o veredito.

## As três camadas, testadas

O que cada prova garante:

| Suíte | O que prova |
|---|---|
| `04-rls.test.mjs` | papel público vê publicado e não vê rascunho · público não lê gabarito · assinante não lê histórico de outro · assinante não escreve em nome de outro · staff não lê progresso por tabela · contexto não vaza entre requisições |
| `03-visao-usuario.test.mjs` | motivo curto recusado · prazo > 72h recusado · grant vencido recusado · grant de outro staff recusado · escopo insuficiente recusado · leitura registrada · expiração automática |
| `08-camada-conexao.test.mjs` | a camada de conexão entrega o mesmo isolamento do ponto de vista do chamador |

## O que a aplicação NÃO decide

O backend não implementa autorização de objeto. Ele troca de papel e passa
a identidade. O que a pessoa pode ver é decidido pelo banco, inclusive
para as tabelas que a aplicação nem conhece.

Isso tem um custo — e o custo é o ponto: um bug de autorização deixa de
ser um vazamento e vira um erro de teste.
