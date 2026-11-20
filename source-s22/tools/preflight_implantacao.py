#!/usr/bin/env python3
"""Preflight somente leitura para a implantação do Cânone V9. Sem acesso a rede, banco ou segredos."""
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]

def evaluate(root=ROOT):
    checks=[]
    def item(code, assertion, detail, blocking=False):
        checks.append({'id':code,'passed':bool(assertion),'blocking':blocking,'detail':detail})

    manifest=json.loads((root/'MANIFESTO_ENTREGA.json').read_text(encoding='utf-8'))
    modules=(root/'app/src/content/modulos.ts').read_text(encoding='utf-8')
    ids=[int(x) for x in re.findall(r'\{\s*n:\s*(\d+),\s*id:',modules)]
    migrations=sorted((root/'backend/db/migrations').glob('*.sql'))
    mig_ids=[int(x.name.split('_',1)[0]) for x in migrations if re.match(r'^\d+_',x.name)]
    item('CATALOGO_26', len(ids)==26 and sorted(ids)==list(range(1,27)),f'{len(ids)} módulos enumerados; IDs exclusivos 1..26',True)
    item('MIGRACOES_30',len(migrations)==30 and mig_ids==list(range(1,31)),f'{len(migrations)} migrations enumeradas 001..030',True)
    item('PROVENIENCIA_CANONICA',all((root/p).exists() for p in [
      'backend/integrations/canonical-knowledge/contract.v1.json',
      'backend/integrations/canonical-corpus/README.md',
      'backend/integrations/metadata-auto/generate.mjs',
      'backend/integrations/audit-educa/contract.v1.json']),
      'Contrato, corpus, metamodelos e Audit Educa presentes',True)
    item('SENADO_28',(root/'backend/integrations/senado-legislacao/generated/source-backed-review.csv').exists(),
      'Fila jurídica V9 de 28 dispositivos presente',True)
    fontpaths=re.findall(r"url\(['\"]?(/fonts/[^)'\"]+)", (root/'app/src/brand/tokens.css').read_text(encoding='utf-8'))
    absent=[p for p in fontpaths if not (root/'app/public'/p.lstrip('/')).is_file()]
    item('FONTES_DS',not absent, f'{len(absent)} arquivos previstos pelo Design System ausentes do pacote; não redistribuir fontes sem autorização',True)
    item('NAO_DISTRIBUIR_FONTES',not any((root/'app/public/fonts').glob('*.woff2')),
         'Binários de fonte não podem compor pacote compartilhável; mantidos CSS e fallbacks',True)
    cliente=(root/'app/src/api/cliente.ts').read_text(encoding='utf-8')
    entrar=(root/'app/src/screens/Entrar.tsx').read_text(encoding='utf-8')
    token_safe='VITE_COMANDER_TOKEN' not in cliente
    item('SEGREDO_FRONTEND',token_safe, 'Token de operador ausente do frontend S2' if token_safe else 'Token de operador ainda aparece no frontend',True)
    memory_only=not re.search(r'\b(?:localStorage|sessionStorage|indexedDB)\s*\.\s*(?:getItem|setItem|open)\s*\(',entrar) and 'sessaoMemoria' in entrar
    item('SESSAO_PREVIEW_NAO_PERSISTE',memory_only,'Token apenas em memória na prévia; não significa cookie de produção homologado',True)
    item('SESSAO_SEGURA',False,'Falta backend real com cookie HttpOnly/Secure/SameSite, CSRF, revogação e autorização comprovada',True)
    app=(root/'app/src/App.tsx').read_text(encoding='utf-8')
    item('COMERCIO_GATE','Assinar <IcArrow' not in app,'Chamada comercial ativa sem E2E de checkout/entitlement comprovado',True)
    item('BACKEND_DB_REAL',False,'Sem evidência de migrations, RLS, restore e E2E em PostgreSQL Cânone isolado',True)
    item('CORPUS_HOMOLOGADO',False,'Metadados do Storage não equivalem a 747 arquivos revalidados e claims aprovados',True)
    item('GITHUB_REMOTO',False,'Código V9 em ZIP/Drive e branch local; repo Cânone não identificado na instalação GitHub disponível',True)
    # Evidência de preview: snapshot observado e preservado; não substitui UAT visual.
    s3_path=root/'docs/evidencias/S3_HTTP_SMOKE_2026-11-14.json'
    try:
        s3=json.loads(s3_path.read_text(encoding='utf-8'))
    except (OSError,ValueError):
        s3={}
    remote=s3.get('vercel',{})
    statuses=s3.get('checks',{})
    preview_ok=(remote.get('deployment_id')=='dpl_BfMTZkPeARFTA37i77dNGPLB7YAx' and
                remote.get('target') is None and remote.get('ready_state')=='READY' and
                remote.get('sso_all') is True and
                statuses.get('html')==200 and statuses.get('js')==200 and statuses.get('css')==200 and
                statuses.get('api_health')==404)
    item('VERCEL_PREVIEW',preview_ok,'Snapshot de HTTP real e configuração SSO ALL; UAT navegador permanece pendente',True)
    item('TESTES_COMPLETOS',False,'138 testes de integração offline; 14 testes backend não carregados por dependência ausente',True)
    item('BASELINE_PRESERVADA',manifest['source_commit'].startswith('5867638') and manifest['migrations_count']==30,
         f"Commit base {manifest['source_commit']} e 30 migrations declarados",True)
    return {'project':'CANONE_CONTABILIDADE_AUDIT_EDUCA','source_commit':manifest['source_commit'],
            'policy':'NO_GO_PRESERVE_EXISTING_DESIGN_AND_MODULES',
            'checks':checks,'passed':sum(c['passed'] for c in checks),
            'blocking_failures':[c['id'] for c in checks if c['blocking'] and not c['passed']],
            'release_gate':'HOLD_HUMAN'}

if __name__=='__main__':
    result=evaluate()
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if '--strict' in sys.argv and result['blocking_failures']:sys.exit(4)
