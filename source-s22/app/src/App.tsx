import { useEffect, useState } from 'react';
import { Nav, Footer, Disclaimer } from './ui/Nav';
import { Home, Conteudos, Ecossistema, ModuloPage, ConceptsIndex } from './screens/pages';
import { Integridade } from './screens/Integridade';
import { Comander } from './screens/Comander';
import { Recursos } from './screens/Recursos';
import { Entrar } from './screens/Entrar';
import { Jornada } from './screens/Jornada';
import { EXAME } from './content/exame';
import { IcArrow, IcChevron, IcDownload } from './brand/icons';
import { FAQ } from './content/faq';
import { PLANOS, type PrecoPlano } from './content/precos';
import './brand/tokens.css';
import './brand/base.css';
import './brand/primitives.css';
import './brand/layout.css';

/* ============================================================================
   ROTEADOR — hash, sem dependência. Estático, offline-first, deployável
   em qualquer lugar sem servidor.
   ========================================================================== */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const path = hash.replace(/^#/, '') || '/';
  return [path, hash] as const;
}

function App() {
  const [path, hash] = useHashRoute();

  useEffect(() => {
    const el = document.getElementById('conteudo');
    if (el && hash.includes('modulo')) el.scrollIntoView({ block: 'start' });
  }, [hash]);

  const modulo = path.startsWith('/modulo/');

  let page: JSX.Element;
  if (path === '/') page = <Home variant="escuro" />;
  else if (path === '/concepts') page = <ConceptsIndex />;
  else if (path === '/conteudos') page = <Conteudos />;
  else if (path === '/ecossistema') page = <Ecossistema />;
  else if (path === '/integridade') page = <Integridade />;
  else if (path === '/comander') page = <Comander />;
  else if (path === '/faq') page = <Faq />;
  else if (path === '/planos') page = <Planos />;
  else if (path === '/recursos') page = <Recursos />;
  else if (path === '/entrar') page = <Entrar />;
  else if (path === '/jornada') page = <Jornada />;
  else if (modulo) page = <ModuloPage id={path.replace('/modulo/', '')} />;
  else page = <NaoEncontrado />;

  const mostrarNav = path !== '/concepts';

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {mostrarNav && <Nav path={path} />}
      <div role="status" style={{ textAlign: 'center', padding: '8px 12px', background: 'var(--ink-150)', color: 'var(--brass-200)', fontFamily: 'var(--f-ui)', fontSize: 12, borderBottom: '1px solid var(--line-brass)' }}>
        Ambiente de prévia restrita · Sem login operacional, publicação de questões ou pagamentos · Conteúdo em homologação
      </div>
      <main id="conteudo">{page}</main>
      {mostrarNav && <Footer />}
    </>
  );
}

/* ---------------------------------- FAQ --------------------------------- */
function Faq() {
  return (
    <div className="shell page">
      <span className="label">Perguntas frequentes</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>FAQ</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        O que perguntam antes de assinar — e o que não afirmamos.
      </p>
      <div className="stack" style={{ marginTop: 36, gap: 0, maxWidth: '76ch' }}>
        {FAQ.map((f, i) => (
          <details key={i} className="faq-item">
            <summary>
              <span>{f.q}</span>
              <IcChevron className="icon-sm" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
      <div style={{ marginTop: 48 }}><Disclaimer variant="box" /></div>
    </div>
  );
}

/* -------------------------------- PLANOS -------------------------------- */
/* -------------------------------- PLANOS -------------------------------- */

/**
 * Os recursos do plano são os ENTITLEMENTS do banco (commerce.plan_feature),
 * não uma lista escrita à mão: o que o plano dá é o que o banco diz que
 * ele dá. O rótulo é humano; a verdade é do banco.
 */
const ROTULO_RECURSO: Record<string, string> = {
  simulados_mes: 'Simulados por mês',
  flashcards: 'Flashcards',
  plano_de_estudos: 'Plano de estudos',
};

function recursosDoPlano(p: PrecoPlano): string[] {
  return p.recursos
    .filter((r) => r.ativo)
    .map((r) => {
      const base = ROTULO_RECURSO[r.chave] ?? r.chave;
      if (r.limite === null || r.limite === undefined) return base;
      return `${base}: ${r.limite}`;
    });
}

function CartaoPlano({ p }: { p: PrecoPlano }) {
  const recursos = recursosDoPlano(p);
  return (
    <div
      className="card"
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        borderColor: p.destaque ? 'var(--line-brass)' : undefined,
        background: p.destaque ? 'rgba(201,169,97,.04)' : undefined,
      }}
    >
      <div>
        <span className="label">{p.nome}</span>
        <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 10 }}>
          <span className="display-md" style={{ fontSize: 30 }}>{p.rotulo}</span>
        </div>
        {p.diasDeTeste > 0 && (
          <p className="xs" style={{ marginTop: 8 }}>
            {p.diasDeTeste} dias de teste
          </p>
        )}
        {p.descricao && (
          <p className="xs" style={{ marginTop: 12, maxWidth: '30ch' }}>{p.descricao}</p>
        )}
      </div>
      <hr className="hr" />
      <ul className="stack" style={{ gap: 10, flex: 1 }}>
        {recursos.map((x) => (
          <li key={x} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--brass-300)', flex: 'none', marginTop: 1 }}>✓</span>
            <span className="xs" style={{ fontSize: 13 }}>{x}</span>
          </li>
        ))}
      </ul>
      <span className={`btn ${p.destaque ? 'btn-brass' : 'btn-ghost'} btn-block`}
        role="status" aria-label="Assinaturas indisponíveis nesta prévia">
        Em homologação
      </span>
    </div>
  );
}

function Planos() {
  return (
    <div className="shell page">
      <span className="label">Planos</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>Planos do Cânone — homologação</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Prévia restrita: 26 módulos apresentados para revisão, sem compra ou assinatura ativa.
      </p>

      <div className="plan-grid" style={{ marginTop: 40 }}>
        {PLANOS.map((p) => (
          <CartaoPlano key={p.key} p={p} />
        ))}
      </div>

      {/* A origem do preço fica à vista: é a regra do Cânone, aplicada a
          si mesmo. O preço vem do banco, com a decisão que o produziu. */}
      <div className="disclaimer" style={{ marginTop: 26, maxWidth: '70ch' }}>
        <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" />
        </svg>
        <span>
          <strong>Preço com origem registrada.</strong> Os valores acima vêm do catálogo de
          planos do banco, com a decisão que os produziu ao lado. Enquanto o comercial não
          definir um plano, ele aparece sem preço — nunca com preço inventado.
        </span>
      </div>

      {/* Prova real do exame — sempre visível ao lado do preço */}
      <div className="card" style={{ padding: 26, marginTop: 32 }}>
        <span className="label-sm">Estrutura da prova que você vai enfrentar</span>
        <div className="row wrap" style={{ gap: 32, marginTop: 16 }}>
          {[
            [`${EXAME.prova.questoes}`, 'questões objetivas'],
            [`${EXAME.prova.opcoes}`, 'opções cada'],
            [`${EXAME.prova.percentualAprovacao}%`, 'para aprovação'],
            [`${EXAME.prova.duracaoHoras}h`, 'de prova'],
          ].map(([v, l]) => (
            <div key={l}>
              <div className="display-md" style={{ fontSize: 26 }}>{v}</div>
              <div className="xs" style={{ marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NaoEncontrado() {
  return (
    <div className="shell page" style={{ textAlign: 'center', paddingBlock: 120 }}>
      <span className="label">Erro 404</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>Página não encontrada</h1>
      <p className="lede" style={{ margin: '12px auto 0' }}>O endereço não corresponde a nenhuma rota do ecossistema.</p>
      <a className="btn btn-brass" style={{ marginTop: 28 }} href="#/">Voltar ao início</a>
    </div>
  );
}

export default App;