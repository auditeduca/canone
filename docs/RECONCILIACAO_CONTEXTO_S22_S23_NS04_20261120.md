# Cânone — reconciliação de contexto e antirretrabalho S22/S23 → NS-04

**Registro:** 20/11/2026 · **Escopo:** análise do repositório `auditeduca/canone`, `main` · **Estado:** INVENTÁRIO CONFERIDO / INTEGRAÇÃO PENDENTE / PRODUÇÃO NO_GO.

## Correção do indicador global

A estimativa de cerca de **30%** mencionada em diálogo não era resultado de matriz de aceite validada e **não deve ser utilizada como percentual único de conclusão acumulada do Cânone**. Misturou entrega histórica do código, trabalho para consolidar na arquitetura atual e critérios adicionais para lançamento.

Reportar separadamente:
1. **Ativos recuperados/versionados** (arquivo e hash presentes, sem inferir operação).
2. **Comportamentos efetivamente integrados/testados** (testes/CI com escopo e data).
3. **Prontidão de produto/produção** (itens efetivamente homologados sob gates de conteúdo, identidade, segurança, recuperação, pagamentos e infraestrutura).

Percentual por frente só com denominador publicado e classificação por item: `RECOVERED`, `INTEGRATED_PASS`, `PENDING_PORT`, `REPLACED_WITH_PROOF`, `HOLD_RIGHTS`, `OUT_OF_SCOPE`. Não gerar médias ponderadas arbitrárias.

## Fontes existentes e o que realmente foi preservado

| Fonte | Evidência verificada | Limitação |
|---|---|---|
| S22 histórico | [manifesto de importação](../inventories/source/CANONE_S22_SOURCE_IMPORT_MANIFEST.json), 476 arquivos Git no bundle; 389 arquivos incluídos em `source-s22/`, 87 excluídos com registro; 30 migrations SQL originais preservadas | Os 87 exclusos não estão automaticamente incorporados; origem legada não é release operacional |
| Frontend S22 | `source-s22/app/` inclui **61 arquivos**, React 18/Vite, `src/App.tsx`, telas de jornada, entrada, catálogo, Comander, módulos, componentes `ui/learning/ExamQuestion.tsx` e testes | Aplicação está em quarentena; prévia continha fluxo demonstrativo e não login/persistência homologados |
| Produto S23 | [matriz de 26 módulos](../planning/s23/S23_MODULOS_26.csv), [faseamento](../planning/s23/S23_FASEAMENTO_26.csv), reconciliação S22/S23 com **61 telas, 35 funcionalidades, 34 controles e 14 gates** inventariados | Matriz/preview não significam 26 módulos operacionais, nem 61 telas com UAT |
| Backend S22 | `source-s22/backend/src/areas/public/catalogo.ts` com consultas por views públicas, sem gabarito; teste histórico 277/277 PASS; serviço, migrations e contratos preservados | Portabilidade, grants, RLS, licenças e funções ainda requerem testes/decisões específicas |
| Conversão alpha.2–alpha.9 | 30/30 migrations e 90/90 tabelas reconciliadas; candidatos PG17/PGlite; operações privadas de prova, assinatura e revisão SRS; [histórico técnico](PROGRAMA_MESTRE_S22_S26.md) | DDL em PG17 efêmero não é instalação Supabase ou paridade completa da origem |
| NS-01–NS-03 | 182 declarações SQL catalogadas; 12/12 HTTP sintético; [13/13 HTTP→PG17](NS03_HTTP_PG17_E2E_LOCAL.md) | Auth real e paridade de 40 funções/17 triggers/2 views/67 políticas seguem incompletos/revisão |
| NS-04 | `frontend/student/` com demo de 2 itens inventados, sete testes Node e Chromium desktop/mobile; [CI](https://github.com/auditeduca/canone/actions/runs/44692128299) | **Prova isolada, não substituto da app React S22**; front→gateway→PG17, catálogo autorizado, histórico persistido e identidade real pendentes |
| Supabase histórico | [inventário 19/11](CONSOLIDACAO_MULTIFONTE_S22_S23_SUPABASE_20261119.md) registra 54 tabelas/27 views candidatas compartilhadas, canone_control nativo e 30 migrations NOT_APPLIED | Não copiar sem direito/autorização, F8 exclusivo continua último; não fazer alterações remotas |

## Desvio identificado e decisão de reconciliação

**Risco de perda de contexto operacional, não prova de perda dos arquivos preservados.** Ao criar a UI local NS-04 `frontend/student/` não fizemos reconciliação prévia com os componentes e design system de `source-s22/app/src/`. O resultado pode recriar funcionalidades já existentes e fragmentar o frontend.

**Decisão corretiva:** conservar NS-04 como harness de teste de jornada e **usar a aplicação React S22 como origem preferencial da consolidação visual**, sujeita a revalidação de build, licenças e segurança. Não promover automaticamente a app inteira; adaptar por componente após crosswalk. Reusar contratos do backend sempre que seguros; o navegador nunca recebe o gabarito nem credenciais do banco. A fixture NS-04 com chave no cliente nunca serve para provar sigilo.

## Próximas operações, em ordem

1. **F3-REC-01:** construir crosswalk **arquivo/tela S22 → requisito S23 → funcionalidade NS-04 → API → teste → gate**. Identificar componentes existentes (reutilizar / adaptar / substituir justificadamente / HOLD) e preservar referências de origem/hashes.
2. **F3-REC-02:** recompilar app React S22 de forma isolada e executar seus testes sem alterar a quarentena, coletando falhas atuais; validar design system/tokens e navegação.
3. **F3-REC-03:** implementar a jornada CFC na app canônica reutilizando `ExamQuestion` e o catálogo seguro, conectada ao gateway e PG17 **local** sem gabarito no bundle cliente. Criar endpoints/contratos faltantes de catálogo, listagem de itens sem chave, histórico e progresso.
4. **F3-REC-04:** repetir CI de browser real com aluno A/B, acesso negado antes do fechamento, mobile, teclado, persistência e cenários de falha. Completar homologação de conteúdo/UX/segurança.
5. **GLOBAL-REC-01:** preservar inventário dos **87 arquivos S22 excluídos** como itens de triagem (sem promover conteúdo/licenças/segredos); reconciliar artefatos históricos de Biblioteca/Drive somente por necessidade, com trilha verificável.
6. **PMO:** redefinir percentual por frente com numerador/denominador objetivos e três indicadores separados. Até lá, retirar o `~30% global` como dado de acompanhamento confiável.

## Regras mantidas

Repositório independente `auditeduca/canone`, alterações somente na `main`, commits pequenos e CI; nenhuma branch nova, nenhuma operação no Supabase compartilhado ou novo projeto antes de F8; `NO_GO` para produção; licenciamento, origem, segurança, LGPD e editorial por item. Valorizar o código S22 preservado, mas não confundir os 26 módulos catalogados com 26 fluxos homologados.
