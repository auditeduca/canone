import { useEffect, useRef, useState } from 'react';
import { Lockup, Monogram } from './primitives';
import { IcArrow, IcDownload } from '../brand/icons';
import { NAO_AFILIACAO } from '../content/exame';

/* ============================================================================
   NAVEGAÇÃO PÚBLICA
   Menu mais curto que o do app — a navegação pública é de marketing, o
   ecossistema de 26 módulos mora dentro do app. Mesmo DNA, escala diferente.
   ========================================================================== */

export const LINKS = [
  { href: '#/', label: 'Início' },
  { href: '#/recursos', label: 'Recursos' },
  { href: '#/conteudos', label: 'Conteúdos' },
  { href: '#/ecossistema', label: 'Ecossistema' },
  { href: '#/integridade', label: 'Integridade' },
  { href: '#/faq', label: 'FAQ' },
];

export function Nav({ path }: { path: string }) {
  const [stuck, setStuck] = useState(false);
  const top = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (top.current !== y <= 0) { top.current = y <= 0; setStuck(y > 12); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${stuck ? 'nav-stuck' : ''}`}>
      <div className="shell between" style={{ height: '100%' }}>
        <a href="#/" aria-label="Cânone — início" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Monogram size={30} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="wordmark" style={{ fontSize: 19 }}>Cânone</span>
            <span style={{ fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--tx-faint)' }}>Suficiência CFC</span>
          </span>
        </a>

        <div className="row" style={{ gap: 30 }}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}
              className={`nav-link ${path === l.href ? 'nav-link-on' : ''}`}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <a className="btn btn-ghost btn-sm" href="#/integridade">Verificar fontes</a>
          <a className="btn btn-brass btn-sm" href="#/planos">Ver planos em homologação <IcArrow className="icon-sm" /></a>
        </div>
      </div>
    </nav>
  );
}

/* Aviso de não-afiliação — obrigatório em qualquer tela que cite o CFC */
export function Disclaimer({ variant = 'inline' }: { variant?: 'inline' | 'box' }) {
  if (variant === 'box') {
    return (
      <div className="disclaimer">
        <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" />
        </svg>
        <span><strong>Não afiliação.</strong> {NAO_AFILIACAO}</span>
      </div>
    );
  }
  return (
    <p className="xs" style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--tx-faint)', maxWidth: '90ch' }}>
      <strong style={{ color: 'var(--tx-low)' }}>Não afiliação.</strong> {NAO_AFILIACAO}
    </p>
  );
}

/* Rodapé institucional */
export function Footer() {
  /*
   * Todo link do rodapé vai para uma página que EXISTE. Item sem página
   * não entra como link: link que não resolve é promessa quebrada (e o
   * teste de rotas do app conta os destinos órfãos).
   */
  const COLS: { t: string; l: { r: string; href?: string }[] }[] = [
    {
      t: 'Produto',
      l: [
        { r: 'Recursos', href: '#/recursos' },
        { r: 'Planos', href: '#/planos' },
        { r: 'Flashcards', href: '#/modulo/flashcards' },
        { r: 'Simulados', href: '#/modulo/simulados' },
        { r: 'Dashboard', href: '#/modulo/dashboard' },
        { r: 'Offline', href: '#/modulo/offline' },
      ],
    },
    {
      t: 'Conteúdos',
      l: [
        { r: 'Contabilidade Geral', href: '#/conteudos' },
        { r: 'Auditoria', href: '#/conteudos' },
        { r: 'CPCs e Normas', href: '#/conteudos' },
        { r: 'Setor Público', href: '#/conteudos' },
        { r: 'Matemática Financeira', href: '#/conteudos' },
      ],
    },
    {
      t: 'Institucional',
      l: [
        { r: 'Sobre', href: '#/ecossistema' },
        { r: 'Integridade editorial', href: '#/integridade' },
        { r: 'Contato', href: '#/faq' },
        // Política de privacidade e Termos de uso são DOCUMENTOS JURÍDICOS:
        // não existem ainda, e inventar texto legal é pior que não publicar.
        // Entram marcados como pendentes, sem link.
        { r: 'Política de privacidade' },
        { r: 'Termos de uso' },
      ],
    },
  ];
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 96 }}>
      <div className="shell" style={{ paddingBlock: 56 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr) 1.2fr', gap: 40 }}>
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Lockup size={34} align="left" sub="Suficiência CFC" />
            <p className="xs" style={{ maxWidth: '28ch', lineHeight: 1.55 }}>
              Ecossistema de estudo para o Exame de Suficiência do CFC. Estudar. Praticar. Evoluir. Aprovar.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.t} className="stack" style={{ gap: 10 }}>
              <span className="label-sm">{c.t}</span>
              {c.l.map((x) =>
                x.href ? (
                  <a key={x.r} href={x.href} className="xs" style={{ fontSize: 12.5 }}>
                    {x.r}
                  </a>
                ) : (
                  <span
                    key={x.r}
                    className="xs"
                    style={{ fontSize: 12.5, color: 'var(--tx-faint)' }}
                    title="Documento ainda não publicado"
                  >
                    {x.r} <span style={{ fontSize: 10 }}>(em preparação)</span>
                  </span>
                )
              )}
            </div>
          ))}
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span className="label-sm">Receba novidades</span>
            <p className="xs" style={{ fontSize: 11.5 }}>Conteúdos, simulados e novidades do ecossistema.</p>
            <div className="row" style={{ gap: 8, width: '100%' }}>
              <input aria-label="Seu e-mail" placeholder="seu@email.com" type="email"
                style={{
                  flex: 1, height: 40, paddingInline: 14, borderRadius: 999,
                  border: '1px solid var(--line)', background: 'var(--ink-100)', fontSize: 12,
                }} />
              <button className="btn btn-ink btn-sm">Inscrever</button>
            </div>
          </div>
        </div>

        <hr className="hr" style={{ marginBlock: 40 }} />
        <div className="between wrap" style={{ gap: 16 }}>
          <span className="xs" style={{ fontSize: 11 }}>
            © 2026 Cânone. Todos os direitos reservados. ·{' '}
            <a href="#/comander" style={{ color: 'var(--tx-low)' }}>Área do administrador</a>
          </span>
          <span className="xs" style={{ fontSize: 11, maxWidth: '70ch', textAlign: 'right' }}>
            Cânone é plataforma independente. Não é produto oficial do CFC ou da FGV Conhecimento.
          </span>
        </div>
      </div>
    </footer>
  );
}