# 10 · A ÁREA DO ADMINISTRADOR: COMANDER + GOVERNANÇA

> **Plano executado.** O que está neste documento não é intenção: é o que
> existe no código, com a prova que sustenta cada afirmação.

---

## 1 · O PROBLEMA

A área do administrador do Cânone tinha três defeitos de forma:

**Não tinha forma.** Era um conjunto de repositórios (`src/areas/admin/`) que
ninguém via. Um painel de administração que é uma biblioteca não é uma
área de administração.

**Não tinha fronteira.** Um CRUD de admin deixa a interface decidir o que o
banco deveria decidir: o que é uma transição válida, o que pode ser
publicado, o que cabe num prazo, o que é uma anulação. Cada uma dessas
decisões, transferida para o navegador, é uma regra que um importador, um
job ou um `psql` buram.

**Não tinha rastro.** "Quem mudou isso?" só tinha resposta quando alguém
lembrasse de olhar o log — e a leitura do dado de aluno pelo staff, que é a
operação mais sensível de toda a área, era uma concessão que o banco
registrava mas que nada exibia.

---

## 2 · A IDEIA: COMANDER + GOVERNANÇA

Duas metades, uma ideia. A área do administrador deixa de ser um painel de
leitura com botões e passa a ser um **console de comandos**.

### O COMANDER — onde se age

Cada ação privilegiada é um **comando nomeado**, com contrato explícito:

```ts
interface Comando {
  id: string;           // identificador estável
  titulo: string;       // como o admin chama a ação
  descricao: string;    // o que ela faz
  regra: string;        // O QUE O BANCO RECUSA — a regra do schema
  nivel: 'staff' | 'admin';
  exige: CampoComando[];// os campos, com tipo, obrigatoriedade e dica
  aplicar(tx, entrada, ctx): Promise<ResumoComando>;
}
```

Três propriedades, e elas são a essência:

**A prévia É a execução.** A prévia não é uma simulação do navegador. Ela
roda o comando no banco, dentro de uma transação que é **desfeita**
(`Db.dryRun`). A resposta da prévia é o que o banco faria — inclusive a
recusa, com a **mensagem do banco**. A execução é a **mesma função**, em
transação confirmada. Divergência entre prévia e execução é impossível
por construção.

E a prévia dispara as regras **deferidas** (`SET CONSTRAINTS ALL
IMMEDIATE`): sem isso, ela diria "ok" para um gabarito incompleto que o
COMMIT recusaria. Uma prévia que não dispara a regra é uma prévia que
mente — e foi exatamente isso que o primeiro teste pegou.

**A recusa é do banco.** O comander não tem regra própria. Ele traduz
requisição em chamada e devolve o que o banco respondeu. "Motivo com menos
de 10 caracteres" é a constraint do banco, não um `if` na interface.

**O comando não inventa poder.** Os oito comandos são operações que o
schema já sustenta e que o banco já recusa quando precisa recusar. Nenhum
comando cria uma capacidade nova.

### A GOVERNANÇA — onde se olha

O estado, lido do banco, com a honestidade do banco:

| Painel | De onde vem | O que mostra |
|---|---|---|
| Cadeia de auditoria | `audit.verify_chain()` | íntegra ou não — **recalculando** o hash de cada linha |
| Fila de moderação | `admin.moderation_queue` | o que está aberto, por prioridade |
| Concessões de suporte | `admin.support_access_grant` | inclusive as **vencidas e não revogadas** |
| Conteúdo sem verificação válida | `admin.v_content_health` | o que está publicado sem fonte |
| Variantes de prova | `admin.v_exam_form_status` | quantas questões, gabarito vigente, anuladas |
| Alegações recusadas | `admin.v_refused_claims` | o que a marca recusou publicar, e por quê |
| Auditoria recente | `admin.v_audit_recent` | quem fez o quê |

O painel que esconde o que está ruim é um painel de vendas. Este não.

---

## 3 · OS COMANDOS

| Comando | Nível | O que o banco recusa |
|---|---|---|
| `conceder_acesso` | staff | motivo com menos de 10 caracteres; prazo acima de 72h |
| `revogar_acesso` | staff | revogação sem motivo |
| `ler_progresso` | staff | leitura sem concessão válida — e cada leitura é registrada |
| `mover_conteudo` | staff | transição fora da tabela; publicar sem verificação vigente |
| `registrar_verificacao` | staff | verificação sem trecho literal da fonte |
| `selar_gabarito` | staff | prova incompleta; letra que não existe entre as alternativas (prova desalinhada) |
| `anular_questao` | staff | posição de gabarito **definitivo** (o selo é imutável); questão publicada |
| `importar_acervo` | admin | enunciado ausente; conflito de número de questões |

---

## 4 · A FORMA: DOIS LADOS, UM CONTRATO

```
BACKEND (a fonte)                      APP (o consumidor)
──────────────────                     ─────────────────
src/areas/admin/comander.ts
  · 8 comandos, com regra e campos
  · aplicar() = a ÚNICA execução
        │
        │  node scripts/gerar-contrato-comander.mjs
        ▼
app/src/api/contrato-comander.ts  ────  GERADO. Não se edita.
  · o catálogo (dados de runtime)
  · os tipos da governança (extraídos do .d.ts do backend)
        │
        ▼
app/src/api/cliente.ts   →   GET/POST /api/comander/*
app/src/screens/Comander.tsx
```

**O contrato é gerado, não escrito.** Um contrato escrito à mão mente: o dia
em que o backend ganha um campo e o app não sabe, ninguém percebe até o
formulário quebrar. Gerado, o drift é visível — e o teste
`tests/11-comander.test.mjs` confere que o arquivo do app está em dia com o
código.

**Três situações na tela, nenhuma mentira:**

| Situação | O que a tela faz |
|---|---|
| Com backend | Fala HTTP. Se o catálogo do servidor divergir do app, **a divergência aparece**. |
| Sem backend | Mostra o catálogo (gerado) e diz que os comandos não são executados. A governança diz que **não há estado a mostrar** — e não há estado de exemplo no lugar. |
| Erro | Mostra o erro. Não adivinha formato. |

---

## 5 · A PROVA

O que se prova, e como:

| Prova | Onde | O que mede |
|---|---|---|
| A prévia é desfeita | `11-comander` | depois da prévia, a concessão **não existe** |
| A recusa é do banco | `11-comander` | motivo curto → recusa com a mensagem do banco, nada gravado |
| A execução escreve | `11-comander` | a concessão passa a existir |
| A porta é o banco | `11-comander` | leitura sem concessão é recusada |
| O selo é conferido | `11-comander` | letra inexistente e gabarito incompleto são recusados **na prévia** |
| A retração é recusada | `11-comander` | anular questão publicada é recusado |
| A cadeia fecha | `11-comander` | `audit.verify_chain()` sem linhas quebradas |
| O HTTP responde | `11-comander` | catálogo, prévia, execução, 401 sem token, 404 |
| O contrato está em dia | `11-comander` | o arquivo do app bate com o código |
| **Ponta a ponta** | `scripts/prova-comander-e2e.mjs` | Chromium de verdade: o admin age sobre o banco real pela tela |

A prova de ponta a ponta é a que importa: ela compila o app contra o
comander, abre o navegador, escolhe um comando, pede a prévia, confere que
**nada foi gravado**, executa, confere que a concessão **existe no banco**,
abre a governança e confirma que a cadeia está íntegra e que a recusa do
banco aparece na tela com a mensagem do banco.

---

## 6 · O QUE FICOU DE FORA (e por quê)

- **Diretório de staff.** Não existe. O operador é reconhecido por token, e
  o id do usuário vem da configuração. É uma simplificação **explícita** —
  fingir um modelo de identidade que não existe seria pior.
- **A SECRETÁRIA.** O comander não guarda segredo: o token entra por
  cabeçalho e o banco guarda a referência ao cofre, como o resto.
- **Papel de sistema com `BYPASSRLS`.** Pendência que vem do schema (ver
  `docs/07-integridade.md`): em produção, o dono das funções
  `SECURITY DEFINER` está sujeito ao `FORCE ROW LEVEL SECURITY`, e o
  PGlite (superuser) não reproduz essa condição. Enquanto isso não for
  resolvido, as funções do comander podem falhar **ruidosamente** em
  produção — nunca em silêncio.
- **Execução em lote.** Um comando por vez. Lote é para quando existir um
  histórico de uso que justifique.
- **Fila de moderação operável.** A fila **aparece**; operá-la (atribuir,
  resolver) ainda é trabalho de banco, não de tela.

---

## 7 · COMO SUBIR

```bash
# 1 · o backend do comander (PGlite, sem Docker)
cd backend && npm run build
CANONE_STAFF_USER_ID=<uuid> CANONE_ADMIN_USER_ID=<uuid> \
CANONE_TOKEN_STAFF=... CANONE_TOKEN_ADMIN=... \
node scripts/subir-comander.mjs

# 2 · o app apontado para ele
cd app && VITE_COMANDER_URL=http://127.0.0.1:8787 \
VITE_COMANDER_TOKEN=<token> npm run build

# 3 · a prova de ponta a ponta
cd backend && node scripts/prova-comander-e2e.mjs
```

Sem `VITE_COMANDER_URL`, o app sobe em modo demonstração: o catálogo
aparece, os comandos não executam, e a tela diz isso.
