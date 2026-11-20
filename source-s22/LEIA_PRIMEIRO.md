> **Atualização S4 (14/11/2026):** Esta entrega evolui o aplicativo V9, preservando os 26 módulos, 30 migrations e o histórico. O commit indicado abaixo é a **origem V9**, não o head da S4. A versão de desenvolvimento atual inclui Vite 6.4.6, Playwright 1.55.1, build com TypeScript rigoroso e prévia Vercel autenticada com npm audit 0 na data. Ver `README.md` e `docs/pmo/MARCO_S4_VITE6_AUDITORIA_LOCKFILE_2026-11-14.md`. Produção, banco, login e conteúdo seguem **NO-GO**.

# Cânone — APP completo V9 (fonte + documentação)

**Base:** branch local `work/canone-conclusao-supabase-vercel`, commit `58676382aa7b651da00059455267664e92573a0a`.

Este ZIP **não é um delta**. Inclui os diretórios do frontend, backend, 30 migrations, 26 módulos catalogados, integrações canônicas, Senado V9, código da V8 e PMO histórico. O patch V9 está apenas como evidência adicional.

**Estado:** código local de desenvolvimento; **NO-GO para produção**. O status 138 PASS refere-se aos testes das integrações offline; outros 14 arquivos clássicos dependem de PGlite não instalado. As últimas tentativas de API Senado tiveram falha DNS, e os arquivos privados do corpus CFC ainda não tiveram seus bytes verificáveis rebaixados.

**Comece por:** `COMO_EXECUTAR_E_HOMOLOGAR.md`, depois `docs/pmo/PENDENCIAS_CONSOLIDADAS_V9_2026-11-14.md` e `docs/pmo/PENDENCIAS_CONSOLIDADAS_V9_2026-11-14.csv`.

O pacote foi intencionalmente sanitizado: sem fontes tipográficas binárias (9 arquivos), segredos, dados privados, corpus protegido, artefatos de runtime ou `node_modules`. Faltam credenciais e ambientes de homologação separados, além dos aceites humanos necessários. Isso é documentado, não disfarçado de conclusão.
