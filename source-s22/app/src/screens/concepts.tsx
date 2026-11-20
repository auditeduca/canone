import type { ReactNode } from 'react';
import { useState } from 'react';
import { Phone } from '../ui/primitives';
import {
  ScreenSplash, ScreenHome, ScreenDecks, ScreenCardQ, ScreenCardA,
  ScreenAval, ScreenProgress, ScreenQuiz,
} from './phoneScreens';
import { QUESTOES } from '../content/questoes';

/* ============================================================================
   CONCEPT 1 — "Flashcards Cânone" (referências 1 e 4)
   Réplica fiel das duas variantes: a escura (ref. 1) e a de cards claros (ref. 4).
   ========================================================================== */

const Q = QUESTOES[1]; // CG-002 — regime de competência

export function ConceptFlashcards({ variant }: { variant: 'escuro' | 'claro' }) {
  const claro = variant === 'claro';
  const [revelada, setRevelada] = useState(false);
  const [tela, setTela] = useState(0);

  const conteudo = (() => {
    switch (tela) {
      case 0: return <ScreenSplash />;
      case 1: return <ScreenDecks />;
      case 2: return <ScreenCardQ q={Q} onReveal={() => setTela(3)} />;
      case 3: return <ScreenCardA q={Q} />;
      case 4: return <ScreenAval q={Q} onDone={() => setTela(5)} />;
      default: return <ScreenProgress />;
    }
  })();

  return (
    <div className="showcase" data-theme={claro ? 'paper' : 'ink'}>
      {/* ---------------- FITA DE CELULARES ---------------- */}
      <div className="ribbon">
        <div className="ribbon-inner">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <button key={i} className="ribbon-slot" onClick={() => setTela(i)}
            aria-label={`Tela ${i + 1}`} data-on={tela === i}>
            <Phone paper={claro && i >= 2}>{i === tela ? conteudo : <Placeholder k={i} claro={claro} />}</Phone>
          </button>
        ))}
        </div>
      </div>

      {/* ---------------- CAPA ---------------- */}
      <header className="showcase-head">
        <div className="lockup" style={{ gap: 10 }}>
          <svg className="monogram" width="52" height="42" viewBox="0 0 100 92" aria-hidden="true">
            <text className="c" x="46" y="86" textAnchor="middle">C</text>
            <path className="hat" d="M31 23 L45 8 L59 23" />
          </svg>
          <span className="wordmark" style={{ fontSize: 40 }}>Cânone</span>
          <span className="lockup-rule" style={{ maxWidth: 150 }} />
          <span className="lockup-sub" style={{ fontSize: 8.5 }}>Suficiência CFC</span>
        </div>

        <h1 className="display-xl" style={{ marginTop: 22 }}>Flashcards Cânone</h1>
        <p className="lede" style={{ textAlign: 'center', marginTop: 4 }}>
          Memorização ativa para acelerar sua preparação no Exame de Suficiência.
        </p>
      </header>

      {/* ---------------- PILARES DE RECURSO ---------------- */}
      <div className="pillars">
        {[
          ['Revisão espaçada', 'Algoritmo inteligente que prioriza o que você precisa revisar para fixar de verdade.'],
          ['Decks por disciplina', 'Conteúdo organizado conforme o edital do Exame de Suficiência, com progresso individual.'],
          ['Favoritos', 'Salve os cards mais importantes e revise sua própria lista de revisão quando quiser.'],
          ['Desempenho', 'Acompanhe sua evolução e identifique seus pontos fortes e fracos.'],
        ].map(([t, d]) => (
          <div key={t} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <span className="pillar-icon" style={{ width: 46, height: 46 }}>
              <PillarIcon k={t} />
            </span>
            <div className="stack" style={{ gap: 3 }}>
              <span className="h2" style={{ fontSize: 15 }}>{t}</span>
              <span className="xs" style={{ fontSize: 11.5, lineHeight: 1.45, maxWidth: '25ch' }}>{d}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarIcon({ k }: { k: string }) {
  const paths: Record<string, string> = {
    'Revisão espaçada': 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
    'Decks por disciplina': 'M4 4h5v16H4V4Zm7 3h5v13h-5V7Zm7 4h5v9h-5v-9Z',
    'Favoritos': 'm12 3 2.9 5.9 6.4.9-4.6 4.5 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.7 9.8l6.4-.9L12 3Z',
    'Desempenho': 'M3 21h18M7 21V10M12 21V4M17 21v-7',
  };
  return (
    <svg className="icon icon-lg" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[k]} />
    </svg>
  );
}

/* Placeholders das telas não-ativas — mantém a fita legível sem roubar CPU */
function Placeholder({ k, claro }: { k: number; claro: boolean }) {
  return (
    <div className="grow" style={{ padding: 14, opacity: .96 }}>
      <div className="bar" style={{ height: 3, marginBottom: 12 }}><div className="bar-fill" style={{ width: `${18 + k * 13}%` }} /></div>
      <div className="stack" style={{ gap: 7 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="card" style={{
            padding: '10px 11px',
            background: claro && i === 1 ? 'var(--paper-000)' : undefined,
            borderColor: claro && i === 1 ? 'var(--paper-200)' : undefined,
            opacity: 1 - i * 0.06,
          }}>
            <div className="between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, width: '62%' }}>{i === 0 ? 'Contabilidade Geral' : ''}</span>
              <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>{i + 1}0</span>
            </div>
            <div className="bar bar-sm"><div className="bar-fill" style={{ width: `${30 + i * 17}%` }} /></div>
          </div>
        ))}
      </div>
      {k === 4 && (
        <div className="stack" style={{ gap: 7, marginTop: 12 }}>
          {[['var(--st-facil)', 1], ['var(--st-esforco)', 1], ['var(--st-errei)', 1], ['var(--st-naosei)', 1]].map(([c], i) => (
            <div key={i} className="card" style={{ padding: '9px 11px', display: 'flex', gap: 9, alignItems: 'center', borderColor: i === 0 ? String(c) : undefined }}>
              <span style={{ width: 13, height: 13, borderRadius: 999, background: i === 0 ? String(c) : 'var(--ink-200)' }} />
              <span style={{ fontSize: 10.5 }}>{['Acertei facilmente', 'Acertei com esforço', 'Errei', 'Não sabia'][i]}</span>
            </div>
          ))}
        </div>
      )}
      {k === 5 && (
        <div className="stack" style={{ alignItems: 'center', gap: 12, marginTop: 20 }}>
          <div className="stack" style={{ alignItems: 'center' }}>
            <span className="num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>78%</span>
            <span className="xs" style={{ fontSize: 9 }}>do ciclo</span>
          </div>
          <div className="spark" style={{ height: 48, width: '100%' }}>
            {[30, 55, 42, 68, 84, 72, 50].map((h, i) => <div key={i} className="spark-bar" style={{ height: `${h}%` }} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   CONCEPT GENÉRICO — Mapas Mentais / Contabilidade Ilustrada / Guia de Bolso
   Referências 6, 7 e 8 compartilham a mesma composição: fita de 6 telas,
   monograma à esquerda, título display, 4 pilares no rodapé.
   ========================================================================== */

export interface ConceptSpec {
  eyebrow: string;
  titulo: string;
  sub: string;
  nota?: string;
  pilares: [string, string][];
  /** Rótulo curto dentro do celular, por tela */
  telas: { titulo: string; corpo: ReactNode; paper?: boolean }[];
  tema?: 'ink' | 'paper';
}

export function ConceptShowcase({ spec, idx }: { spec: ConceptSpec; idx: string }) {
  const [tela, setTela] = useState(0);
  return (
    <div className="showcase" data-theme={spec.tema ?? 'ink'}>
      <div className="ribbon">
        <div className="ribbon-inner">
        <Phone className="ribbon-lead">
          <div className="grow stack" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: 22 }}>
            <svg className="monogram" width="54" height="44" viewBox="0 0 100 92" aria-hidden="true">
              <text className="c" x="46" y="86" textAnchor="middle">C</text>
              <path className="hat" d="M31 23 L45 8 L59 23" />
            </svg>
            <span className="wordmark" style={{ fontSize: 26 }}>Cânone</span>
            <span className="lockup-rule" style={{ maxWidth: 110 }} />
            <span className="lockup-sub" style={{ fontSize: 7.5 }}>{spec.eyebrow}</span>
            <p className="serif" style={{ fontSize: 12, color: 'var(--tx-low)', textAlign: 'center', lineHeight: 1.5, marginTop: 10 }}>
              {spec.pilares[0]?.[1]}
            </p>
            <button className="btn btn-brass btn-xs" style={{ marginTop: 4 }}>Começar agora <span className="cta-arrow">→</span></button>
          </div>
        </Phone>
        {spec.telas.map((t, i) => (
          <button key={i} className="ribbon-slot" onClick={() => setTela(i)} data-on={tela === i}
            aria-label={t.titulo}>
            <Phone paper={t.paper}>
              <PhoneChrome titulo={t.titulo} idx={i} active={tela === i}>{t.corpo}</PhoneChrome>
            </Phone>
          </button>
        ))}
        </div>
      </div>

      <header className="showcase-head">
        <div className="lockup" style={{ gap: 8 }}>
          <svg className="monogram" width="48" height="38" viewBox="0 0 100 92" aria-hidden="true">
            <text className="c" x="46" y="86" textAnchor="middle">C</text>
            <path className="hat" d="M31 23 L45 8 L59 23" />
          </svg>
          <span className="wordmark" style={{ fontSize: 36 }}>Cânone</span>
          <span className="lockup-rule" style={{ maxWidth: 130 }} />
          <span className="lockup-sub" style={{ fontSize: 8 }}>Suficiência CFC</span>
        </div>
        <h2 className="display-lg" style={{ marginTop: 20 }}>{spec.titulo}</h2>
        <p className="lede" style={{ textAlign: 'center' }}>{spec.sub}</p>
        {spec.nota && <p className="label-sm" style={{ marginTop: 12 }}>{spec.nota}</p>}
      </header>

      <div className="pillars">
        {spec.pilares.map(([t, d], i) => (
          <div key={t} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <span className="pillar-icon" style={{ width: 46, height: 46 }}>
              <PillarIcon2 k={i} />
            </span>
            <div className="stack" style={{ gap: 3 }}>
              <span className="h2" style={{ fontSize: 15 }}>{t}</span>
              <span className="xs" style={{ fontSize: 11.5, lineHeight: 1.45, maxWidth: '24ch' }}>{d}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PillarIcon2({ k }: { k: number }) {
  const p = [
    'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z',
    'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M12 8v8M8 12h8',
    'm12 3 2.9 5.9 6.4.9-4.6 4.5 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.7 9.8l6.4-.9L12 3Z',
    'M3 21h18M7 21V10M12 21V4M17 21v-7',
  ];
  return (
    <svg className="icon icon-lg" viewBox="0 0 24 24" aria-hidden="true">
      <path d={p[k % 4]} />
    </svg>
  );
}

/* Moldura interna das telas: cabeçalho + corpo */
export function PhoneChrome({
  titulo, idx, active, children,
}: { titulo: string; idx: number; active: boolean; children: ReactNode }) {
  return (
    <>
      <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', flex: 'none' }}>
        <span className="num" style={{ fontSize: 10, fontWeight: 600 }}>9:41</span>
        <span style={{ fontSize: 9, color: 'var(--tx-low)', fontWeight: 600 }}>{titulo}</span>
        <span style={{ width: 22 }} />
      </div>
      <div style={{ height: 1, background: 'var(--line)', flex: 'none' }} />
      <div className="grow" style={{ overflowY: 'auto' }}>{children}</div>
      {!active && null}
    </>
  );
}

/* ------------------- Blocos reutilizáveis dentro do phone ----------------- */
export function PList({
  items, filtro = ['Todos', 'Favoritos', 'Por disciplina'],
}: { items: { t: string; s: string; p?: number }[]; filtro?: string[] }) {
  return (
    <div className="stack" style={{ padding: 14 }}>
      <span style={{ fontFamily: 'var(--f-display)', fontSize: 19, letterSpacing: '-.02em' }}>{'Meu Study'}</span>
      <div className="seg" style={{ width: '100%', marginTop: 10 }}>
        {filtro.map((f, i) => <button key={f} aria-pressed={i === 0} style={{ flex: 1, fontSize: 9.5 }}>{f}</button>)}
      </div>
      <div className="stack" style={{ gap: 7, marginTop: 12 }}>
        {items.map((it, i) => (
          <div key={it.t} className="card card-hover" style={{ padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--ink-200)', flex: 'none' }} />
            <div className="grow stack" style={{ gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.t}</span>
              <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>{it.s}</span>
              {it.p !== undefined && <div className="bar bar-sm"><div className="bar-fill" style={{ width: `${it.p}%` }} /></div>}
            </div>
            <span className="num" style={{ fontSize: 9, color: 'var(--brass-300)' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function POptions({ titulo, sub, itens }: { titulo: string; sub: string; itens: string[] }) {
  return (
    <div className="stack" style={{ padding: 14, gap: 9 }}>
      <span style={{ fontFamily: 'var(--f-display)', fontSize: 17, textAlign: 'center' }}>{titulo}</span>
      <span className="xs" style={{ fontSize: 9.5, textAlign: 'center', marginTop: -4 }}>{sub}</span>
      <div className="stack" style={{ gap: 7, marginTop: 6 }}>
        {itens.map((it, i) => (
          <div key={it} className="card" style={{
            padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10,
            borderColor: i === 0 ? 'var(--brass-300)' : 'var(--line)',
            background: i === 0 ? 'rgba(201,169,97,.07)' : undefined,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, flex: 1 }}>{it}</span>
            <span style={{
              width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${i === 0 ? 'var(--brass-300)' : 'var(--line-strong)'}`,
              background: i === 0 ? 'var(--brass-300)' : 'transparent', flex: 'none',
            }} />
          </div>
        ))}
      </div>
      <button className="btn btn-brass btn-block btn-sm" style={{ marginTop: 4 }}>Continuar <span className="cta-arrow">→</span></button>
    </div>
  );
}

export function PCompare({ a, b }: { a: string; b: string }) {
  return (
    <div className="stack" style={{ padding: 14, gap: 9 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[a, b].map((t, i) => (
          <div key={t} className="panel" style={{
            padding: 11, borderColor: i === 0 ? 'var(--line-brass)' : 'var(--line)',
            background: i === 0 ? 'rgba(201,169,97,.05)' : undefined,
          }}>
            <div className="stack" style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: 'var(--brass-300)' }}>{i === 0 ? '▣' : '▤'}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em' }}>{t}</span>
            </div>
            <ul style={{ display: 'grid', gap: 5 }}>
              {['Circulante', 'Não circulante', 'Realizável até 12 meses', 'Exigível', 'Classificação'].map((t2) => (
                <li key={t2} style={{ fontSize: 8.5, color: 'var(--tx-mid)', display: 'flex', gap: 4 }}>
                  <span style={{ color: 'var(--brass-500)' }}>·</span>{t2}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 3 }}>
        <span className="label-sm" style={{ fontSize: 8.5 }}>Exemplos</span>
        {['Caixa, clientes, estoques', 'Fornecedores, empréstimos', 'Imobilizado, intangível'].map((e) => (
          <span key={e} className="xs" style={{ fontSize: 9 }}>— {e}</span>
        ))}
      </div>
      <div className="stack" style={{ gap: 3, marginTop: 4 }}>
        <span className="label-sm" style={{ fontSize: 8.5, color: 'var(--st-errei)' }}>Erros comuns</span>
        {['Confundir circulante com realize', 'Classificar pelo prazo do contrato', 'Ignorar a realizzabilidade'].map((e) => (
          <span key={e} className="xs" style={{ fontSize: 9, color: 'var(--tx-mid)', display: 'flex', gap: 4 }}>
            <span style={{ color: 'var(--st-errei)' }}>×</span>{e}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PMap({ centro, ramos }: { centro: string; ramos: { t: string; c: string }[] }) {
  return (
    <div className="stack" style={{ padding: 14, gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'var(--tx-low)', alignSelf: 'flex-start' }}>Visão geral</span>
      <div style={{ position: 'relative', width: '100%', height: 190, display: 'grid', placeItems: 'center' }}>
        {ramos.map((r, i) => {
          const ang = (i / ramos.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(ang) * 68, y = Math.sin(ang) * 52;
          return (
            <div key={r.t} style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)' }}>
              <span style={{
                display: 'block', padding: '6px 9px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: 'var(--ink-150)', border: '1px solid var(--line-brass)', whiteSpace: 'nowrap',
              }}>{r.t}</span>
            </div>
          );
        })}
        <span style={{
          padding: '9px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          background: 'var(--brass-300)', color: 'var(--brass-on)', zIndex: 2,
        }}>{centro}</span>
      </div>
    </div>
  );
}

export function PCalendar({ mes, dias }: { mes: string; dias: number[] }) {
  const semanas = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  return (
    <div className="stack" style={{ padding: 14, gap: 9 }}>
      <span className="num" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{mes}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {semanas.map((s, i) => (
          <span key={i} className="num" style={{ fontSize: 8, textAlign: 'center', color: 'var(--tx-faint)' }}>{s}</span>
        ))}
        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
          const ev = dias.includes(d);
          return (
            <span key={d} className="num" style={{
              fontSize: 8.5, textAlign: 'center', padding: '4px 0', borderRadius: 4,
              background: ev ? 'var(--brass-300)' : 'transparent',
              color: ev ? 'var(--brass-on)' : 'var(--tx-mid)',
              fontWeight: ev ? 700 : 400,
            }}>{d}</span>
          );
        })}
      </div>
      <div className="stack" style={{ gap: 5, marginTop: 4 }}>
        {[['Contabilidade Geral', '2h · 2ª'], ['CPCs e Normas', '1h · 4ª'], ['Auditoria', '1h · Flashcards']].map(([t, s]) => (
          <div key={t} className="row" style={{ gap: 8, padding: '7px 9px', borderRadius: 6, background: 'var(--ink-100)', border: '1px solid var(--line)' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--brass-300)' }} />
            <span style={{ fontSize: 9.5, flex: 1 }}>{t}</span>
            <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PProgresso({ pct, legenda, dias }: { pct: number; legenda: string; dias: number[] }) {
  return (
    <div className="stack" style={{ padding: 14, gap: 12 }}>
      <span style={{ fontFamily: 'var(--f-display)', fontSize: 19 }}>Meu progresso</span>
      <div className="stack" style={{ alignItems: 'center', gap: 3, padding: '10px 0' }}>
        <span className="num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1 }}>{pct}%</span>
        <span className="xs" style={{ fontSize: 9 }}>{legenda}</span>
      </div>
      <div className="spark" style={{ height: 56 }}>
        {dias.map((h, i) => <div key={i} className="spark-bar" style={{ height: `${h}%` }} />)}
      </div>
      <div className="stack" style={{ gap: 7 }}>
        {['Balanço Patrimonial', 'Ativo x Passivo', 'CPCs e Normas', 'DRE'].map((t, i) => (
          <div key={t} className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 9.5, flex: 1 }}>{t}</span>
            <div className="bar bar-sm" style={{ width: 84 }}><div className="bar-fill" style={{ width: `${78 - i * 14}%` }} /></div>
            <span className="num" style={{ fontSize: 8.5, color: 'var(--tx-low)', width: 26, textAlign: 'right' }}>{78 - i * 14}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ScreenQuiz };