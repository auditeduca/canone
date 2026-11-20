# 06 · LGPD

> O que o schema faz para que a conformidade não dependa de disciplina da
> equipe.

## A conta é credencial, o perfil é dado pessoal

```sql
identity.account        email, password_hash, status, failed_logins, locked_until
identity.user_profile   display_name, birth_date, cpf_encrypted, cpf_last4, phone_e164
```

Separados de propósito: a **credencial** é dado de autenticação, o
**perfil** é dado pessoal. Apagar a conta não apaga o perfil; anonimizar o
perfil não quebra o login.

`identity.account.status` inclui `anonimizado` — o titular exerceu o
direito de eliminação e a conta guarda só o identificador mínimo.

## O CPF nunca fica em texto

```sql
cpf_encrypted  bytea   -- cifrado
cpf_last4      char(4) -- só os 4 últimos
```

O `cpf_last4` existe para o suporte confirmar a identidade sem ver o
documento. O `cpf_encrypted` existe porque o CRC precisa do CPF — e o
schema guarda o valor cifrado, nunca em claro.

> O schema **não** cifra: ele guarda o campo e a chave fica fora
> (`secret_ref` no cofre). A cifragem é da aplicação, com a chave no
> cofre. O que o banco garante é que não há coluna de CPF em claro.

## Finalidade de consentimento versionada

```sql
identity.consent_purpose(key, label, legal_basis, required, version, description)
identity.consent(user_id, purpose_key, purpose_version, granted,
                 legal_basis, ip_address, user_agent, evidence, collected_at)
```

Semearadas no banco:

| Finalidade | Base legal | Obrigatória |
|---|---|---|
| Termos de uso | contrato | sim |
| Política de privacidade | contrato | sim |
| Funcionalidade essencial | execução de contrato | sim |
| Comunicações de marketing | **consentimento** | não |
| Análise de produto | **consentimento** | não |
| Suporte e atendimento | legítimo interesse | não |

O consentimento guarda `purpose_version` — a versão da finalidade no
momento da coleta. Se a finalidade muda, o consentimento antigo continua
registrado contra a versão antiga. Sem isso, "aceitei" não quer dizer
nada depois de uma mudança de texto.

E guarda `evidence` (jsonb), `ip_address` e `user_agent`: a prova de que
o consentimento foi colhido.

## Solicitações do titular

```sql
identity.data_request(user_id, kind, status, requested_at, due_at, ...)
```

Tipos: `acesso`, `correcao`, `eliminacao`, `portabilidade`, `revogacao`.

O prazo de resposta é do banco, não da caixa de entrada: `due_at` é
calculado na criação e a fila de atendimento lê por ele.

## O direito de eliminação tem dois caminhos

1. **Anonimização** (padrão): o perfil vira `anonimizado`, e o
   `learning.review_event` continua existindo porque é o histórico de
   estudo — que é dado do **produto**, não dado pessoal identificável
   depois da anonimização.
2. **Eliminação** (quando a base legal exige): a conta é removida em
   cascade e o que sobrevive é o que é agregável e não identifica ninguém.

> A distinção importa e é jurídica, não técnica. O schema registra as
> duas e a política de qual se aplica fica documentada — não no código
> espalhado.

## A visão de usuário é o ponto mais sensível

O staff lendo dado de aluno é tratamento de dado pessoal de terceiro. O
schema trata isso com quatro travas:

| Trava | Onde |
|---|---|
| motivo obrigatório (≥ 10 caracteres) | `CHECK` em `admin.support_access_grant` |
| prazo máximo de 72 horas | `CHECK` `ck_grant_max_duration` |
| expiração automática, sem depender de job | trigger `trg_expire_support_grants` |
| registro de cada leitura | `admin.support_access_log` |

E com uma quinta, que é a mais importante: **o staff não tem privilégio
para ler `learning.mastery`**. A leitura acontece por
`admin.read_user_progress_as`, que exige concessão e registra.

> Acesso permanente a dado de terceiro é violação de LGPD. Por isso o
> prazo tem teto no schema, não na política da empresa.

## Segredo nunca no banco

```sql
ops.integration.secret_ref  -- referência ao cofre, NUNCA o valor
ops.setting.is_secret       -- o valor não sai em API de leitura de config
```

O banco guarda o **nome** do segredo. O valor vive no cofre, e a
aplicação resolve por `secret_ref`. Se o valor entrasse no banco, um dump
de banco seria um vazamento de credenciais.

`src/config/secrets.ts` implementa o padrão: `Vault.resolve(ref)` falha
**fechado** (erro explícito) quando o segredo não existe, e `redigir()`
mascara por chave em qualquer log.

## Retenção

O que o schema prepara para retenção:

| Dado | Campo | Observação |
|---|---|---|
| conta | `deleted_at`, `status='anonimizado'` | eliminação/anonimização |
| consentimento | `collected_at`, `purpose_version` | evidência preservada |
| solicitação | `due_at`, `status` | fila com prazo |
| auditoria | `audit.audit_log` | append-only, **não** se apaga |
| coleta de IP/UA | `consent.ip_address`, `audit.ip_address` | dado de prova |

O log de auditoria **não tem rota de eliminação** — por desenho. Ele não
contém dado de aluno identificável além do `actor_id`/`subject_user_id`,
que se tornam anonimos junto com a conta. A auditoria da auditoria é um
problema diferente, e é intencional.

## O que o schema NÃO faz

- **Não anonimiza sozinho.** A anonimização é um job, com regra de
  negócio. O schema guarda o caminho (`status='anonimizado'`) e a
  evidência (`deleted_at`).
- **Não criptografa.** Cifra é da aplicação; o schema guarda o campo
  cifrado e a chave no cofre.
- **Não define base legal.** `legal_basis` está nas finalidades
  semeadas, revisáveis por `INSERT` versionado.
- **Não garante o direito ao esquecimento** (o "right to be forgotten") —
  ele é juridicamente limitado por obrigação legal de guarda, e isso é
  decisão da empresa, não do schema.
