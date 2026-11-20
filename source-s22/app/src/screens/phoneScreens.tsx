import { useState } from 'react';
import {
  Phone, StatusBar, TabBar, AppBar, Ring, Spark,
} from '../ui/primitives';
import {
  IcSearch, IcChevron, IcArrowLeft, IcCheck, IcRotate,
  IcStar, IcCards, IcChart, IcUser, IcBookOpen, IcHome, IcLightbulb,
  IcSwords, IcTarget, 
} from '../brand/icons';
import { IcGauge } from '../content/icones-internos';
import { QUESTOES, type Questao } from '../content/questoes';
import { ExamQuestion, ExamGateNotice } from '../ui/learning/ExamQuestion';

/* ============================================================================
   TELAS DE CONCEITO E NAVEGAÇÃO — exemplos visuais, sem persistência real.
   O motor de provas fica no backend e a prévia não envia respostas, não
   calcula resultados de alunos nem disponibiliza gabarito normativo.
   ========================================================================== */

const TAB_ICONS = [
  { id: 'inicio', label: 'Início', icon: <IcHome className="icon-sm" /> },
  { id: 'decks', label: 'Decks', icon: <IcCards className="icon-sm" /> },
  { id: 'estudar', label: 'Estudar', icon: <IcBookOpen className="icon-sm" /> },
  { id: 'favoritos', label: 'Favoritos', icon: <IcStar className="icon-sm" /> },
  { id: 'mais', label: 'Mais', icon: <IcUser className="icon-sm" /> },
];

/* ---------------------------- 1. SPLASH ---------------------------------- */
export function ScreenSplash() {
  return (
    <>
      <StatusBar />
      <div className="grow stack" style={{ alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }}>
        <svg className="monogram" width="88" height="72" viewBox="0 0 100 92" aria-hidden="true">
          <text className="c" x="46" y="86" textAnchor="middle">C</text>
          <path className="hat" d="M31 23 L45 8 L59 23" />
        </svg>
        <span className="wordmark" style={{ fontSize: 30 }}>Cânone</span>
        <span className="lockup-rule" style={{ maxWidth: 96, margin: '6px 0' }} />
        <span className="lockup-sub" style={{ fontSize: 8.5 }}>Suficiência CFC</span>
        <p className="serif italic" style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: 'var(--tx-low)', lineHeight: 1.45 }}>
          Fixe o essencial.<br />Aprove com confiança.
        </p>
      </div>
      <div style={{ padding: 22, paddingBottom: 30 }}>
        <button className="btn btn-brass btn-block" style={{ height: 46 }}>Começar agora <span className="cta-arrow">→</span></button>
      </div>
    </>
  );
}

/* ------------------------- 2. HOME / DECKS ------------------------------- */
export function ScreenHome() {
  return (
    <>
      <StatusBar />
      <AppBar
        center={
          <span className="stack" style={{ alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 19, fontWeight: 400, letterSpacing: '-.02em' }}>Cânone</span>
            <span style={{ fontSize: 7, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--tx-low)' }}>Suficiência CFC</span>
          </span>
        }
        actions={<IcSearch className="icon-sm" />}
      />
      <div className="grow" style={{ overflowY: 'auto', padding: '0 14px 14px' }}>
        <p style={{ fontFamily: 'var(--f-display)', fontSize: 25, lineHeight: 1.05, letterSpacing: '-.02em', marginBottom: 2 }}>Olá,Ana. Vamos continuar?</p>
        <span className="xs" style={{ fontSize: 10.5 }}>Sua trilha está em dia. Faltam 12 minutos hoje.</span>

        {/* Continuar de onde parou */}
        <div className="card card-hover" style={{ padding: 13, marginTop: 14, cursor: 'pointer' }}>
          <div className="between" style={{ marginBottom: 9 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Trilha de estudos</span>
            <IcChevron className="icon-sm" />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, display: 'block' }}>Contabilidade Geral</span>
          <div className="between" style={{ margin: '6px 0 7px' }}>
            <span className="num" style={{ fontSize: 10, color: 'var(--tx-low)' }}>68% concluído</span>
            <span className="num" style={{ fontSize: 10, color: 'var(--brass-300)' }}>204/300</span>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: '68%' }} /></div>
        </div>

        <span className="label-sm" style={{ display: 'block', margin: '18px 0 8px' }}>Acessos rápidos</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { i: <IcCards className="icon-sm" />, t: 'Flashcards', s: '300 cards' },
            { i: <IcTarget className="icon-sm" />, t: 'Simulados', s: '12 simulados' },
            { i: <IcSwords className="icon-sm" />, t: 'Questões', s: 'comentadas' },
            { i: <IcGauge className="icon-sm" />, t: 'Desempenho', s: 'sua evolução' },
          ].map((q) => (
            <div key={q.t} className="card card-hover" style={{ padding: 12, cursor: 'pointer' }}>
              <span style={{ color: 'var(--brass-300)', display: 'block', marginBottom: 7 }}>{q.i}</span>
              <span style={{ fontSize: 11, fontWeight: 600, display: 'block', lineHeight: 1.2 }}>{q.t}</span>
              <span style={{ fontSize: 9, color: 'var(--tx-low)' }}>{q.s}</span>
            </div>
          ))}
        </div>

        <span className="label-sm" style={{ display: 'block', margin: '18px 0 8px' }}>Sua semana</span>
        <div className="card" style={{ padding: 13 }}>
          <Spark data={[{ d: 'S', v: 2 }, { d: 'T', v: 4 }, { d: 'Q', v: 1 }, { d: 'Q', v: 5 }, { d: 'S', v: 3 }, { d: 'S', v: 6 }, { d: 'D', v: 2 }]} height={44} />
        </div>
      </div>
      <TabBar items={TAB_ICONS} active="inicio" />
    </>
  );
}

/* --------------------------- 3. LISTA DE DECKS ---------------------------- */
const DECKS = [
  { n: 'Contabilidade Geral', c: 300, p: 72 },
  { n: 'Contabilidade de Custos', c: 184, p: 38 },
  { n: 'Contabilidade Aplicada ao Setor Público', c: 160, p: 12 },
  { n: 'Auditoria Independente', c: 274, p: 45 },
  { n: 'Legislação e Ética Profissional', c: 210, p: 28 },
];

export function ScreenDecks() {
  return (
    <>
      <StatusBar />
      <AppBar
        center={
          <span className="stack" style={{ alignItems: 'center', gap: 0 }}>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 17 }}>Meus Decks</span>
          </span>
        }
        actions={<IcSearch className="icon-sm" />}
      />
      <div className="grow" style={{ overflowY: 'auto', padding: '0 14px' }}>
        <span className="xs" style={{ fontSize: 10.5, display: 'block', marginBottom: 10 }}>Escolha uma disciplina para começar.</span>
        <div className="seg" style={{ width: '100%', marginBottom: 14 }}>
          <button aria-pressed="true" style={{ flex: 1 }}>Todos</button>
          <button style={{ flex: 1 }}>Favoritos</button>
          <button style={{ flex: 1 }}>Por disciplina</button>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {DECKS.map((d, i) => (
            <div key={d.n} className="card card-hover" style={{ padding: '11px 12px', cursor: 'pointer' }}>
              <div className="row" style={{ gap: 11 }}>
                <span style={{
                  width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                  borderRadius: 7, background: 'var(--ink-200)', color: 'var(--brass-300)',
                }}>{i === 0 ? <IcCards className="icon-sm" /> : i === 1 ? <IcChart className="icon-sm" /> : <IcBookOpen className="icon-sm" />}</span>
                <div className="grow stack" style={{ gap: 5, minWidth: 0 }}>
                  <div className="between">
                    <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2 }}>{d.n}</span>
                    <IcChevron className="icon-sm" />
                  </div>
                  <span className="num" style={{ fontSize: 9.5, color: 'var(--tx-low)' }}>{d.c} flashcards</span>
                  <div className="bar bar-sm"><div className="bar-fill" style={{ width: `${d.p}%` }} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar items={TAB_ICONS} active="decks" />
    </>
  );
}

/* --------------------- 4. FLASHCARD — PERGUNTA --------------------------- */
export function ScreenCardQ({ q, onReveal }: { q: Questao; onReveal: () => void }) {
  return (
    <>
      <StatusBar />
      <AppBar
        actions={<span className="icon-sm" style={{ opacity: .7 }}>✕</span>}
        center={
          <span className="stack" style={{ gap: 1, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{q.disciplina}</span>
            <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>3 de 20</span>
          </span>
        }
      />
      <div className="bar" style={{ borderRadius: 0, height: 3, flex: 'none' }}><div className="bar-fill" style={{ width: '15%' }} /></div>

      <div className="grow stack" style={{ padding: 16, gap: 12, minHeight: 0 }}>
        <span className="label-sm" style={{ alignSelf: 'flex-start', fontSize: 9 }}>Pergunta</span>
        <div className="grow stack" style={{ justifyContent: 'center', gap: 14 }}>
          <p style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: 1.2, letterSpacing: '-.015em' }}>
            {q.enunciado}
          </p>
        </div>
        <div className="stack" style={{ gap: 9, alignItems: 'center' }}>
          <span style={{ color: 'var(--brass-300)' }}><IcLightbulb className="icon" /></span>
          <span className="xs" style={{ fontSize: 10.5, textAlign: 'center', maxWidth: '24ch' }}>
            Exemplo sintético de navegação. Conteúdo normativo e revisão ainda indisponíveis.
          </span>
          <button className="btn btn-brass btn-block" style={{ height: 42, fontSize: 12 }} onClick={onReveal}>
            Mostrar resposta
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------- 5. FLASHCARD — RESPOSTA --------------------------- */
export function ScreenCardA({ q }: { q: Questao }) {
  return (
    <>
      <StatusBar />
      <AppBar
        actions={<span className="icon-sm" style={{ opacity: .7 }}>✕</span>}
        center={
          <span className="stack" style={{ gap: 1, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{q.disciplina}</span>
            <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>3 de 20</span>
          </span>
        }
      />
      <div className="bar" style={{ borderRadius: 0, height: 3, flex: 'none' }}><div className="bar-fill" style={{ width: '15%' }} /></div>

      <div className="grow stack" style={{ padding: 16, gap: 12, minHeight: 0 }}>
        <span className="label-sm" style={{ alignSelf: 'flex-start', fontSize: 9 }}>Resposta</span>
        <div className="stack" style={{ gap: 11 }}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>{q.alternativas[q.correta]}</p>
          <div style={{
            padding: 11, borderRadius: 6, background: 'rgba(201,169,97,.06)',
            border: '1px solid var(--line-brass)',
          }}>
            <div className="row" style={{ gap: 7, marginBottom: 5, color: 'var(--brass-300)' }}>
              <IcLightbulb className="icon-sm" />
              <span className="label-sm" style={{ color: 'var(--brass-300)', fontSize: 9 }}>Por quê</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--tx-mid)', lineHeight: 1.5, display: 'block' }}>
              {q.justificativa.slice(0, 148)}…
            </span>
          </div>
          <div className="row" style={{ gap: 7, color: 'var(--tx-faint)' }}>
            <IcBookOpen className="icon-sm" />
            <span className="num" style={{ fontSize: 9 }}>{q.base.slice(0, 46)}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px 16px', flex: 'none' }}>
        <button className="btn btn-brass btn-block" style={{ height: 42, fontSize: 12 }}>
          Avaliar meu desempenho
        </button>
      </div>
    </>
  );
}

/* ------------------- 6. AUTOAVALIAÇÃO (4 estados) -------------------------
   Estados AUTORRELATOS — não é gabarito. Ver integridade/ESTADOS.md.
   ======================================================================== */
export function ScreenAval({ q, onDone }: { q: Questao; onDone?: () => void }) {
  const [escolha, setEscolha] = useState<string | null>(null);
  const OPCOES = [
    { k: 'facil', c: 'var(--st-facil)', t: 'Acertei facilmente', s: 'Já sabia de primeira.' },
    { k: 'esforco', c: 'var(--st-esforco)', t: 'Acertei com esforço', s: 'Precisei pensar bastante.' },
    { k: 'errei', c: 'var(--st-errei)', t: 'Errei', s: 'Fiquei em dúvida na hora.' },
    { k: 'naosei', c: 'var(--st-naosei)', t: 'Não sabia', s: 'Nunca vi esse conteúdo.' },
  ];
  return (
    <>
      <StatusBar />
      <AppBar
        actions={<span className="icon-sm" style={{ opacity: .7 }}>✕</span>}
        center={<span style={{ fontSize: 11, fontWeight: 600 }}>{q.disciplina}</span>}
      />
      <div className="bar" style={{ borderRadius: 0, height: 3, flex: 'none' }}><div className="bar-fill" style={{ width: '15%' }} /></div>

      <div className="grow stack" style={{ padding: 18, gap: 14, minHeight: 0, overflowY: 'auto' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span style={{
            width: 46, height: 46, borderRadius: 999, display: 'grid', placeItems: 'center',
            background: 'rgba(47,158,99,.12)', color: 'var(--st-facil)',
          }}><IcCheck className="icon-lg" /></span>
        </div>
        <div className="stack" style={{ alignItems: 'center', gap: 3, textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 19 }}>Como foi sua resposta?</span>
          <span className="xs" style={{ fontSize: 10, maxWidth: '26ch' }}>
            Isso nos ajuda a programar as próximas revisões.
          </span>
        </div>

        <div className="stack" style={{ gap: 7 }}>
          {OPCOES.map((o) => {
            const on = escolha === o.k;
            return (
              <button key={o.k} onClick={() => { setEscolha(o.k); onDone?.(); }}
                className="card" style={{
                  padding: '11px 13px', textAlign: 'left', cursor: 'pointer',
                  borderColor: on ? o.c : 'var(--line)',
                  background: on ? `${o.c.replace(')', '')}` : undefined,
                  boxShadow: on ? `0 0 0 1px ${o.c}` : undefined,
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                <span style={{
                  width: 15, height: 15, borderRadius: 999, flex: 'none',
                  border: `2px solid ${on ? o.c : 'var(--line-strong)'}`,
                  background: on ? o.c : 'transparent',
                }} />
                <span className="stack" style={{ gap: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{o.t}</span>
                  <span className="xs" style={{ fontSize: 9.5 }}>{o.s}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="disclaimer" style={{ fontSize: 9.5, padding: 9 }}>
          <IcRotate className="icon-sm" />
          <span>Demonstração: a revisão espaçada depende de login e serviço homologados.</span>
        </div>
      </div>
      <TabBar items={TAB_ICONS} active="estudar" />
    </>
  );
}

/* ------------------------- 7. DASHBOARD ---------------------------------- */
export function ScreenProgress() {
  return (
    <>
      <StatusBar />
      <AppBar center={<span style={{ fontSize: 12, fontWeight: 600 }}>Progresso ilustrativo</span>}
        actions={<IcChart className="icon-sm" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '0 14px 14px' }}>
        <div className="seg" style={{ width: '100%', marginBottom: 14 }}>
          <button aria-pressed="true" style={{ flex: 1 }}>7 dias</button>
          <button style={{ flex: 1 }}>30 dias</button>
          <button style={{ flex: 1 }}>Total</button>
        </div>

        <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
          <div className="row" style={{ gap: 18, justifyContent: 'space-between' }}>
            <Ring value={78} size={92} sub="do ciclo" />
            <div className="stack" style={{ gap: 11, flex: 1 }}>
              {[['248', 'cards estudados'], ['78%', 'taxa de acerto'], ['12', 'dias de sequência']].map(([n, l]) => (
                <div key={l}>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.02em' }}>{n}</div>
                  <div className="xs" style={{ fontSize: 9 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <span className="label-sm" style={{ display: 'block', marginBottom: 8 }}>Atividade</span>
        <div className="card" style={{ padding: 13, marginBottom: 16 }}>
          <Spark data={[{ d: 'Seg', v: 3 }, { d: 'Ter', v: 5 }, { d: 'Qua', v: 4 }, { d: 'Qui', v: 6 }, { d: 'Sex', v: 8 }, { d: 'Sáb', v: 7 }, { d: 'Dom', v: 5 }]} height={62} />
        </div>

        <span className="label-sm" style={{ display: 'block', marginBottom: 8 }}>Meus favoritos</span>
        <div className="stack" style={{ gap: 7 }}>
          {[
            ['Diferença entre ativo circulante e não circulante', 'Contabilidade Geral'],
            ['Métodos de depreciação', 'Contabilidade de Custos'],
            ['Princípios fundamentais de auditoria', 'Auditoria Independente'],
          ].map(([t, d]) => (
            <div key={t} className="card card-hover" style={{ padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ color: 'var(--brass-300)' }}><IcStar className="icon-sm" /></span>
              <div className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.25 }}>{t}</span>
                <span className="xs" style={{ fontSize: 9 }}>{d}</span>
              </div>
              <IcChevron className="icon-sm" />
            </div>
          ))}
        </div>
      </div>
      <TabBar items={TAB_ICONS} active="favoritos" />
    </>
  );
}

/* ------------------- 8. QUIZ — SIMULAÇÃO DE UI (NÃO É PROVA REAL) -------- */
export function ScreenQuiz({ q }: { q: Questao }) {
  const [resp, setResp] = useState<string | null>(null);
  const letras = ['A', 'B', 'C', 'D'] as const;
  const acertou = resp === q.correta; // APENAS DEMONSTRAÇÃO SINTÉTICA; nunca nota real
  return (
    <>
      <StatusBar />
      <AppBar
        actions={<IcArrowLeft className="icon-sm" />}
        center={<span className="stack" style={{ gap: 0, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{q.disciplina}</span>
          <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>Questão 12/20</span>
        </span>}
      />
      <div className="bar" style={{ borderRadius: 0, height: 3, flex: 'none' }}><div className="bar-fill" style={{ width: '60%' }} /></div>
      <div className="grow stack" style={{ padding: 16, gap: 12, overflowY: 'auto' }}>
        <ExamGateNotice reason="Questão sintética. A correção real só ocorrerá no backend homologado." />
        <ExamQuestion ordinal={1} stem={q.enunciado}
          options={letras.map((l)=>({code:l,text:q.alternativas[l]}))}
          selected={resp} onChoose={(option)=>setResp(option)}
          status={<span className="label-sm">{q.topico}</span>}/>
        {resp && (
          <div style={{ padding: 11, borderRadius: 6, background: 'rgba(201,169,97,.06)', border: '1px solid var(--line-brass)' }}>
            <span className="label-sm" style={{ fontSize: 9, color: 'var(--brass-300)' }}>
              {acertou ? 'Exemplo sintético: resposta esperada' : `Exemplo sintético: opção ${q.correta}`}
            </span>
            <p style={{ fontSize: 10.5, color: 'var(--tx-mid)', lineHeight: 1.5, marginTop: 5 }}>
              {q.justificativa}
            </p>
            <p className="num" style={{ fontSize: 8.5, color: 'var(--tx-faint)', marginTop: 7 }}>
              Base: {q.base}
            </p>
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px 14px', flex: 'none' }}>
        <button className="btn btn-brass btn-block" style={{ height: 42, fontSize: 12 }} disabled={!resp}
          aria-disabled={!resp}>
          {resp ? 'Próxima questão' : 'Selecione uma alternativa'}
        </button>
      </div>
    </>
  );
}