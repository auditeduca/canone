# Cânone — Plataforma de Contabilidade e Conhecimento Normativo

## Atualização de recuperação S22/S23 (19/11/2026)

**Fonte S22 recuperada e verificada por hash:** app ZIP com 477 entradas e bundle Git no commit `164fa4df8e99de29e35c41d35a25f6ee0b2c6462`. A diretriz de produto mais recente é **S23 v0.3 — Exame de Suficiência/EQT do CFC**. Encontradas **81 relações candidatas no Supabase (54 tabelas, 27 views)**, sendo 4 tabelas nativas de controle e 50 compartilhadas. Consulte o [relatório multifonte S22/S23](docs/CONSOLIDACAO_MULTIFONTE_S22_S23_SUPABASE_20261119.md). **Código ainda não importado neste GitHub público; produção NO-GO.**


> **Estado:** implantação em preparação · **gate de produção: NO-GO** · corte de consolidação: 2026-11-19.

Este repositório é o destino independente do **Cânone Contabilidade**: arquitetura, motor de avaliações, módulos educacionais e de consulta, conteúdo normativo rastreável, testes, governança e infraestrutura. Não confundir com a plataforma *Calculadoras de Enfermagem / CKO / NCOS*, que é um ecossistema distinto.

## Situação inicial verificada

- Repositório `auditeduca/canone` criado em 19/11/2026 como destino canônico de versionamento; **nenhum código-fonte legado foi migrado ou homologado por esta inicialização**.
- Preview Vercel separado: `canone-contabilidade-preview`; o último deployment consultado estava `READY`, o que **não equivale a homologação funcional ou produção**.
- No Supabase compartilhado `Calculadoras-Smart`, foram identificados **14 schemas `canone_*` reservados**, mas somente **4 tabelas de controle** em `canone_control`; todas com RLS habilitada e nenhuma policy. O catálogo de controle registra **30 migrations `NOT_APPLIED`**, backend/autorização pendente e publicação `NO_GO`.
- Relatos de ensaios anteriores (ambiente isolado): **16/30 migrations** e **261/261 testes de regressão** no checkpoint S21. Esses números são **históricos e não verificados neste repositório**.
- Objetivo funcional conhecido: motor central e **26 módulos**. A cobertura funcional, a conformidade normativa e os direitos de fontes ainda precisam ser auditados por módulo.

## Programa de integração e conclusão

Consulte [Programa Mestre S22–S26](docs/PROGRAMA_MESTRE_S22_S26.md) e [Registro de Evidências e Bloqueios](docs/REGISTRO_EVIDENCIAS_BLOQUEIOS.md) para acompanhar a execução.

1. **S22 — Inventário e reconciliação:** localizar artefatos S21, confirmar origem/sha/licença, trazer somente conteúdo comprovado para branches de integração; mapear lacunas e duplicidades.
2. **S23 — Banco e migrations:** corrigir SQL genérico, padronizar schemas próprios, ownership, grants, RLS, identidade e isolamento; executar em PostgreSQL descartável antes de qualquer staging.
3. **S24 — Backend e motor:** autenticação/autorização comprovadas, motor de avaliações, trilha de auditoria e contratos testados.
4. **S25 — 26 módulos e normativos:** matriz de cobertura + testes E2E, fontes oficiais verificadas, licenças e aprovações independentes.
5. **S26 — Release:** CI integral, backup/restauração/rollback, hardening, preview homologado e autorização expressa para produção.

## Regras de promoção

- **Nunca** declarar GO com base apenas em build verde, testes isolados ou URL READY.
- **Não** aplicar migrations remotas, publicar em produção, ativar pagamentos ou alterar privilégios sem verificação independente.
- Segredos e dados reais não podem ser commitados; fixtures sintéticas apenas.
- Toda entrega deve ter commit/SHA, arquivos alterados, teste reproduzível, fonte/evidência e decisão `PASS | HOLD | FAIL`.
- Normativos: preferir fonte oficial primária; se não estiver disponível ou os direitos não permitirem, manter `HOLD_SOURCE` ou `HOLD_RIGHTS` por item.

## Ambientes

| Ambiente | Finalidade | Estado |
| --- | --- | --- |
| GitHub `auditeduca/canone` | Fonte independente e controle de mudança | Inicialização |
| Vercel `canone-contabilidade-preview` | UI de demonstração | Preview READY; não homologado |
| PostgreSQL isolado | Teste de migrations e regressão | Evidência S21 a recuperar |
| Supabase `Calculadoras-Smart` / `canone_*` | Reserva de namespace e catálogo de gates | Sem migrations de domínio; NO-GO |
| Produção | Operação real | Não autorizada |

_Registro inicial: 2026-11-19. A criação deste README não certifica a migração do projeto._
