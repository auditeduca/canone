# Política de versionamento — Cânone (somente `main`)

**Decisão do proprietário (19/11/2026):** não criar novas branches. A `main` é o único destino para os próximos commits. A antiga branch de recuperação S22/S23 e sua PR são históricas, sem continuidade de desenvolvimento.

## Regras
1. **Um compromisso por alteração verificável:** mensagens seguindo `tipo(escopo): motivo` (`docs`, `fix`, `feat`, `test`, `ci`, `refactor`, `chore`).
2. **Changelog obrigatório:** atualizar `CHANGELOG.md` e `VERSION` na mudança de versão; registrar **SHA Git de cada marco**, diagnóstico, testes, impacto e rollback.
3. **Histórico preservado:** nenhuma reescrita, `force push`, exclusão de migrations originais ou squashing de evidências; as fontes S22 ficam sob `source-s22/` até aceite de integração.
4. **Regressão a cada commit:** CI somente leitura, sem conexão com Supabase, Vercel ou secrets; passar hash, testes e gate de recusa antes de avançar.
5. **Se o CI falhar:** corrigir com novo commit em `main`, sem criar branch; documentar desvio e restauração. A falha impede publicação, não impede a investigação/correção.
6. **Segurança e direitos:** fontes sem licença/autoridade primária, segredos e dados pessoais não podem ser inseridos no repositório público. Itens ficam `HOLD_SOURCE`, `HOLD_RIGHTS` ou `HOLD_SECURITY`.
7. **Versionamento vs. publicação:** uma versão `0.x` significa snapshot do código; **não é autorização para lançamento**. Só fazer deploy em um processo separado com GO explícito.
8. **Tags/releases:** poderão ser adicionadas quando o ambiente conectado oferecer criação segura de tags; por ora, `VERSION` + `CHANGELOG` + SHAs dos commits são o mecanismo rastreável, sem inventar tags.

## Estado da base
- Origem histórica S22: `164fa4df8e99de29e35c41d35a25f6ee0b2c6462`.
- Recuperação na main por fast-forward, arquivo `source-s22/QUARENTENA_S22_NO_GO.md`.
- Plano de produto S23 v0.3 prioriza Exame de Suficiência antes de EQT.
- Gate `RELEASE_NO_GO`; nenhuma migration executável via CI.

## Marcos futuros previstos
- `0.23.0-alpha.2`: finalizar segurança e inventários de origem, sem dados reais;
- `0.23.0-beta.1`: API/DB em staging isolado + jornada CFC sintética E2E;
- `0.23.0-rc.1`: conteúdo e fontes licenciados homologados e aprovação de segurança;
- `1.0.0`: somente após decisão humana formal `GO`.

Esses números são **planejamento**, não lançamentos realizados.
