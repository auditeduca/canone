# 03 · ERD

> **Gerado do banco.** O diagrama abaixo é extraído do catálogo do Postgres
> em tempo de build (`npm run erd`), com 90 tabelas e
> 85 chaves estrangeiras. Um ERD escrito à mão mente no dia
> seguinte; este não tem como mentir.

Diagrama completo (Mermaid): [`03-erd.mmd`](./03-erd.mmd)

## As tabelas por domínio

| Schema | Tabelas | O que guarda |
|---|---|---|
| `identity` | 10 | credencial, perfil, consentimento, solicitação de dados |
| `editorial` | 15 | metamodelo, conteúdo versionado, verificação, fonte, revisão |
| `taxonomy` | 9 | áreas, assuntos, subtopics, módulos, blueprint, edições do exame |
| `norms` | 4 | órgãos, normas, versões, itens normativos |
| `learning` | 26 | itens, SRS, progresso, histórico, notas, offline |
| `commerce` | 7 | planos, assinaturas, pagamentos, elegibilidade |
| `admin` | 6 | concessão de visão de usuário, moderação, flags |
| `ops` | 12 | settings, integrações, webhooks, jobs |
| `audit` | 1 | log append-only com encadeamento de hash |

## As cinco relações que sustentam a tese

```
editorial.source ──< editorial.verification ──< editorial.content_item
        (fonte)            (a prova)                    (o conteúdo)
                              │
                              │ state='verificada'
                              │ exige source_quote + valid_until
                              ▼
                     content_item.state = 'publicado'
```

1. **`content_item` ↔ `content_item_version`** — o payload canônico mora
   na versão; o item é o índice estável.
2. **`content_item_version` → `learning.item`/`item_option`** — projeção
   por trigger. O payload é a verdade.
3. **`content_item` → `verification` → `source`** — a verificação é
   entidade, com o trecho literal da fonte ao lado.
4. **`norms.norm` → `norm_version` → `norm_item`** — a vigência encadeada;
   nova versão caduca a verificação e abre a moderação.
5. **`identity.account` → tudo** — o `user_id` é a origem da propriedade
   (o RLS usa `ops.current_user_id()`, não a coluna).
