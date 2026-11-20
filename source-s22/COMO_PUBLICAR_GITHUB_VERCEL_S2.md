# Cânone — continuidade de implantação S2 (NO-GO de produção)

**Fonte canônica local:** bundle Git completo da branch `work/canone-preview-s2-20261114` (entregue separadamente), derivado do Git Bundle V8 + patch V9 + alterações S2. Não é um repositório remoto publicado.

## GitHub — recurso de criação de repositórios indisponível no conector

Crie **um novo repositório privado, vazio, exclusivo de Cânone** na conta `IndiciumFIN`, sem README inicial, sem template e sem sobrescrever `indiciumfin`, `dev-chatgpt-workspace`, `calculadorasdeenfermagem` ou demais repositórios. A ferramenta GitHub conectada permite ler/criar commits e branches em repositórios existentes, mas **não possui a ação de criar repositórios**; portanto, o remoto não foi criado neste marco.

Depois de criar o novo repo, na sua máquina (com Git e a permissão de escrita):

```sh
git clone CANONE_V9_S2_HISTORICO_GIT_2026-11-14.bundle canone
cd canone
git switch work/canone-preview-s2-20261114
git remote remove origin
# Informe a URL REAL criada pelo GitHub; não deduza um nome a partir deste documento.
git remote add origin https://github.com/IndiciumFIN/<REPO_PRIVADO_CANONE>.git
git push -u origin work/canone-preview-s2-20261114
```

Não promova para `main` até a aprovação de todos os P0 e revisão de direitos editoriais. Recomenda-se proteção de branches e PR obrigatório.

## Vercel — destino já criado

- Equipe: `leivisml-7739s-projects`.
- Projeto: `canone-contabilidade-preview` (`prj_VjM86IFWl2Ox01FogfnRvBqNOIxN`).
- Preview protegido implantado: `dpl_BfMTZkPeARFTA37i77dNGPLB7YAx`.
- URL: https://canone-contabilidade-preview-podvwns2o-leivisml-7739s-projects.vercel.app
- Config: framework Vite, root `app`, Node 22, install `npm ci`, build `npm run build`, output `dist`.
- Vercel Authentication: `all`. Sem backend real, assinaturas, tokens administrativos ou PDFs normativos.

O primeiro deployment foi rotulado inadvertidamente `production` pela API quando solicitamos `staging`, apesar de proteção SSO `all`; isto está documentado como bloqueio. **Não altere produção nem remova proteção** até a revisão humana da existência desse alias e a aprovação formal.

O preview atual é um exercício técnico; não valida direitos, vigência, segurança operacional ou jornada real do aluno.

## Banco isolado

A organização Supabase `bekcrbwjlhpnyewukoqw` informou custo incremental de US$ 0/mês, mas o serviço recusou criar o terceiro projeto grátis por limite de dois ativos. Nenhum existente foi modificado. Para seguir, é necessário liberar capacidade **com autorização explícita sobre custo/organização**, ou fornecer um PostgreSQL isolado já disponível; só então aplicar e testar as 30 migrations.

## Critérios mínimos para desbloquear release

Consulte `docs/pmo/MARCO_S2_IMPLANTACAO_RECONCILIADA_2026-11-14.md`, `docs/pmo/S2_BACKLOG_IMPLANTACAO_2026-11-14.csv`, teste `python tools/test_preview_s2.py`, relatório `docs/evidencias/S2_IMPLANTACAO_REMOTA_EVIDENCIA.json`, e gate canônico estrito. Sem homologação: `HOLD_HUMAN_NO_GO`.
