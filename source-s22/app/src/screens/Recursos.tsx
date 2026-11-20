/* ============================================================================
   RECURSOS — o que o acesso libera, mostrado, não prometido.
   -----------------------------------------------------------------------------
   Esta página existia como LINK sem página: a navegação, o hero e o cartão de
   plano apontavam para "#/recursos" e caíam em "não encontrado". Aqui ela
   vira a vitrine do que o ecossistema entrega — as quatro fases, os módulos
   de cada fase e as TELAS REAIS do produto (as mesmas que os conceitos e o
   app usam), não uma ilustração genérica.
   ========================================================================== */
import { Phone } from '../ui/primitives';
import { MODULOS, FASES } from '../content/modulos';
import { ScreenDecks, ScreenCardQ, ScreenQuiz, ScreenProgress } from './phoneScreens';
import { QUESTOES } from '../content/questoes';
import { IcArrow } from '../brand/icons';

const Q = QUESTOES[1];

export function Recursos() {
  return (
    <div className="shell page">
      <span className="label">Recursos</span>
      <h1 className="display-lg" style={{ marginTop: 12 }}>O que o acesso libera</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: '62ch' }}>
        Quatro fases, {MODULOS.length} módulos e as telas que você usa no dia a dia.
        O que está abaixo é o produto — as mesmas telas que aparecem no app.
      </p>

      {/* ---- As telas reais ---- */}
      <section style={{ marginTop: 56 }}>
        <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
          <h2 className="display-md">As telas</h2>
          <span className="label-sm">O app, não um mockup de propaganda</span>
        </div>
        <div
          className="row wrap"
          style={{ gap: 32, marginTop: 24, alignItems: 'flex-start' }}
        >
          <figure style={{ margin: 0 }}>
            <Phone>
              <ScreenDecks />
            </Phone>
            <figcaption className="xs" style={{ marginTop: 12, maxWidth: '22ch' }}>
              Flashcards — a pilha do dia, montada pela revisão espaçada.
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            <Phone>
              <ScreenCardQ q={Q} onReveal={() => {}} />
            </Phone>
            <figcaption className="xs" style={{ marginTop: 12, maxWidth: '22ch' }}>
              Carta — você responde antes de ver a justificativa.
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            <Phone>
              <ScreenQuiz q={Q} />
            </Phone>
            <figcaption className="xs" style={{ marginTop: 12, maxWidth: '22ch' }}>
              Simulado — no formato da prova, com o tempo de prova.
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            <Phone>
              <ScreenProgress />
            </Phone>
            <figcaption className="xs" style={{ marginTop: 12, maxWidth: '22ch' }}>
              Progresso — a lacuna por assunto, antes da prova.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---- As fases e o que há em cada uma ---- */}
      <section style={{ marginTop: 72 }}>
        <h2 className="display-md">As quatro fases</h2>
        <div className="stack" style={{ gap: 0, marginTop: 24 }}>
          {FASES.map((fase, i) => {
            const daFase = MODULOS.filter((m) => m.fase === fase.nome);
            return (
              <div
                key={fase.nome}
                className="row wrap between"
                style={{
                  gap: 24,
                  paddingBlock: 28,
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ minWidth: '22ch' }}>
                  <span className="num" style={{ fontSize: 13, color: 'var(--brass-500)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="display-md" style={{ fontSize: 22, marginTop: 8 }}>
                    {fase.nome}
                  </h3>
                  <p className="xs" style={{ marginTop: 8, maxWidth: '30ch' }}>
                    {fase.lema}
                  </p>
                </div>
                <div className="row wrap" style={{ gap: 10, flex: 1, minWidth: '30ch' }}>
                  {daFase.map((m) => (
                    <a
                      key={m.id}
                      href={`#/modulo/${m.id}`}
                      className="chip"
                      style={{ textDecoration: 'none' }}
                    >
                      <m.icone className="icon-sm" />
                      {m.nome}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Chamada ---- */}
      <section className="card" style={{ padding: 32, marginTop: 56 }}>
        <h2 className="display-md" style={{ fontSize: 24 }}>Tudo isso, com um acesso</h2>
        <p className="xs" style={{ marginTop: 12, maxWidth: '54ch' }}>
          Um único acesso libera os {MODULOS.length} módulos, os simulados e o
          painel de progresso. O preço e as condições estão na página de planos,
          com a origem registrada.
        </p>
        <div className="row wrap" style={{ gap: 12, marginTop: 24 }}>
          <a className="btn btn-brass" href="#/planos">
            Ver planos <IcArrow className="icon-sm" />
          </a>
          <a className="btn btn-ghost" href="#/ecossistema">
            Conhecer o ecossistema
          </a>
        </div>
      </section>
    </div>
  );
}
