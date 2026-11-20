/* Dois ícones que só servem ao catálogo — ficam aqui para não poluir o
   conjunto da marca com glifos sem uso nas telas. */
export const IcTrendingIn = (p: { className?: string }) => (
  <svg className={`icon ${p.className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3 17 6-6 4 4 8-8M21 7v5h-5" />
  </svg>
);
export const IcGauge = (p: { className?: string }) => (
  <svg className={`icon ${p.className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21a9 9 0 1 1 9-9M12 12l5-3" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

