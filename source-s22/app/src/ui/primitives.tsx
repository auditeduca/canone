import type { ReactNode } from 'react';

/* ============================ MONOGRAMA Ĉ ==============================
   O "Ĉ" é a assinatura. SVG inline: escala sem perda, funciona offline,
   e herda currentColor — o mesmo componente serve em fundo escuro e claro. */
export function Monogram({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`monogram ${className}`} width={size} height={size * 0.92} viewBox="0 0 100 92" aria-hidden="true">
      <text className="c" x="46" y="86" textAnchor="middle">C</text>
      {/* circunflexo: dois traços, ponta viva */}
      <path className="hat" d="M31 23 L45 8 L59 23" />
    </svg>
  );
}

/* Lockup completo — Ĉ + wordmark + regua + rótulo */
export function Lockup({
  size = 40, align = 'center', showRule = true, sub = 'Suficiência CFC',
}: { size?: number; align?: 'center' | 'left'; showRule?: boolean; sub?: string }) {
  const inline = align === 'left';
  return (
    <div className={`lockup ${inline ? 'lockup--left lockup--inline' : ''}`}>
      {inline && <Monogram size={size} />}
      <div className={inline ? '' : 'stack'}>
        {!inline && <Monogram size={size} />}
        <span className="wordmark">Cânone</span>
        {showRule && <span className="lockup-rule" />}
        {sub && <span className="lockup-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ============================ MOLDURA DE CELULAR ========================
   CSS puro. Os concepts das referências precisam ser reais — mock em imagem
   mente quando o layout quebra, e aqui nada quebra. */
export function Phone({
  children, paper = false, className = '', notch = true,
}: { children: ReactNode; paper?: boolean; className?: string; notch?: boolean }) {
  return (
    <div className={`phone ${paper ? 'phone-paper' : ''} ${className}`}>
      <div className="phone-screen">
        {notch && <div className="phone-notch" />}
        {children}
      </div>
    </div>
  );
}

export function StatusBar({ time = '9:41' }: { time?: string }) {
  return (
    <div className="status-bar">
      <span className="num">{time}</span>
      <span className="status-icons" aria-hidden="true">
        <svg width="14" height="11" viewBox="0 0 16 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" /><rect x="4.3" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="8.6" y="3" width="3" height="9" rx="1" /><rect x="12.9" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="14" height="11" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 11.2 5.8 9a3 3 0 0 1 4.4 0L8 11.2ZM3.4 6.6a6.5 6.5 0 0 1 9.2 0l-1.3 1.3a5 5 0 0 0-6.6 0l-1.3-1.3ZM.9 4.1a10 10 0 0 1 14.2 0L13.8 5.4a8.5 8.5 0 0 0-11.6 0L.9 4.1Z" />
        </svg>
        <svg width="20" height="11" viewBox="0 0 22 12" fill="none">
          <rect x=".7" y="1" width="18" height="10" rx="3" stroke="currentColor" strokeOpacity=".45" />
          <rect x="2.3" y="2.6" width="13" height="6.8" rx="1.6" fill="currentColor" />
          <path d="M20.3 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z" fill="currentColor" fillOpacity=".45" />
        </svg>
      </span>
    </div>
  );
}

/* Barra de abas inferior — a navegação das referências */
export function TabBar({
  items, active,
}: { items: { id: string; label: string; icon: ReactNode }[]; active: string }) {
  return (
    <nav className="row" style={{ justifyContent: 'space-around', padding: '9px 8px 16px', borderTop: '1px solid var(--line)', flex: 'none' }}>
      {items.map((it) => (
        <div key={it.id} className="stack" style={{ alignItems: 'center', gap: 3, opacity: active === it.id ? 1 : 0.42, color: active === it.id ? 'var(--brass-300)' : 'inherit' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20 }}>{it.icon}</span>
          <span style={{ fontSize: 9.5, fontWeight: active === it.id ? 700 : 500 }}>{it.label}</span>
        </div>
      ))}
    </nav>
  );
}

/* Cabeçalho interno do app */
export function AppBar({
  title, center, actions,
}: { title?: ReactNode; center?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', minHeight: 44, flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 44 }}>{actions}</div>
      <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, flex: 1 }}>{center ?? title}</div>
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{actions}</div>
    </div>
  );
}

/* ============================ ANEL DE PROGRESSO ======================== */
export function Ring({
  value, size = 96, stroke = 7, label, sub,
}: { value: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} className="ring" aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div className="stack" style={{ alignItems: 'center', gap: 0 }}>
          <span className="num" style={{ fontSize: size * 0.26, fontWeight: 600, letterSpacing: '-.02em' }}>{label ?? `${Math.round(value)}%`}</span>
          {sub && <span style={{ fontSize: size * 0.085, color: 'var(--tx-low)', letterSpacing: '.04em' }}>{sub}</span>}
        </div>
      </div>
    </div>
  );
}

/* Barras de atividade — os gráficos de 7 dias das referências */
export function Spark({
  data, height = 56, showDays = true,
}: { data: { d: string; v: number }[]; height?: number; showDays?: boolean }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="spark" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className={`spark-bar ${d.v === 0 ? 'spark-bar-dim' : ''}`}
            style={{ height: `${Math.max((d.v / max) * 100, 3)}%`, opacity: d.v === 0 ? 0.3 : 1 }} title={`${d.d}: ${d.v}`} />
        ))}
      </div>
      {showDays && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--tx-faint)' }}>
          {data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{d.d}</span>)}
        </div>
      )}
    </div>
  );
}

/* ============================ PILAR DE RECURSO =========================
   O padrão de rodapé das referências: ícone em círculo de latão + título
   serif + 2 linhas de descrição, separado por réguas verticais. */
export function Pillar({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start', padding: 'var(--s-4) 0' }}>
      <span className="pillar-icon">{icon}</span>
      <div className="stack" style={{ gap: 4 }}>
        <span className="h2" style={{ fontSize: '1.0625rem' }}>{title}</span>
        <span className="xs" style={{ lineHeight: 1.5, maxWidth: '26ch' }}>{children}</span>
      </div>
    </div>
  );
}

/* Selo de conteúdo — usado onde a fonte é verificável */
export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--tx-faint)', letterSpacing: '.02em' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {children}
    </span>
  );
}