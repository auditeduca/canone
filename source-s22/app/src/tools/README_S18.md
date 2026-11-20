# S18 — Study Workbenches

O único motor `study-workbench.ts` modela fichas autorais para cinco módulos preexistentes do catálogo. `StudyWorkbenches.tsx` adapta títulos e campos sem criar um segundo Design System.

Contrato: `WorkbenchEntry` imutável, `user-authored-unverified`, `HOLD_SOURCE` quando a fonte não é informada, no máximo 25 fichas por módulo/100 por sessão. `exportWorkbench()` retorna `canone.user-authored.workbench.s18` com `verified=false`.

Para testar sem compilação de browser:

```
cd app
node --experimental-strip-types --test tests/*.test.mjs
```

Gate: esses dados não podem ser publicados nem considerados prova documental ou normativa. Sem backend, login, armazenamento ou nota.
