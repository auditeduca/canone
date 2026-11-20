/* Conjunto de ícones da marca. Traço 1.6, grade 24, cantos arredondados.
   Regra: qualquer ícone novo entra AQUI, nunca inline na tela. */

type P = { className?: string };
const S = (d: string, extra?: React.ReactNode) => (p: P) => (
  <svg className={`icon ${p.className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
    {extra}
  </svg>
);

export const IcSearch = S('M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.35-4.35');
export const IcClose = S('M18 6 6 18M6 6l12 12');
export const IcChevron = S('m9 18 6-6-6-6');
export const IcArrow = S('M5 12h14M12 5l7 7-7 7');
export const IcArrowDiag = S('M7 17 17 7M8 7h9v9');
export const IcArrowLeft = S('M19 12H5M12 19l-7-7 7-7');
export const IcPlus = S('M12 5v14M5 12h14');
export const IcCheck = S('M20 6 9 17l-5-5');
export const IcCheckCircle = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.2l2.4 2.4 4.6-4.9');
export const IcXCircle = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15 9l-6 6M9 9l6 6');
export const IcRotate = S('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5');
export const IcStar = S('m12 3 2.9 5.9 6.4.9-4.6 4.5 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.7 9.8l6.4-.9L12 3Z');
export const IcHome = S('m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z');
export const IcCards = S('M4 6h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM6 3h12a2 2 0 0 1 2 2');
export const IcMap = S('M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z');
export const IcBrain = S('M9.5 3A3.5 3.5 0 0 0 6 6.5v.3A3.5 3.5 0 0 0 4 10a3.5 3.5 0 0 0 2 3.2v.3A3.5 3.5 0 0 0 9.5 17H12V3H9.5ZM14.5 3A3.5 3.5 0 0 1 18 6.5v.3a3.5 3.5 0 0 1 2 3.2 3.5 3.5 0 0 1-2 3.2v.3a3.5 3.5 0 0 1-3.5 3H12V3h2.5Z');
export const IcBook = S('M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5v-16ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5Z');
export const IcChart = S('M3 21h18M7 21V10M12 21V4M17 21v-7');
export const IcBookOpen = S('M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Zm0 0v13');
export const IcLayers = S('m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5');
export const IcTarget = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z');
export const IcScale = S('M12 3v18M7 21h10M6 7h12M6 7 3 14h6L6 7Zm12 0-3 7h6l-3-7ZM9 4h6');
export const IcReceipt = S('M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21V3ZM9 8h6M9 12h6');
export const IcCalculator = S('M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM8 6h8v3H8V6Zm0 7h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-6 3h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2Z');
export const IcLightbulb = S('M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2 1 2h5c.1-.8.4-1.5 1-2A6 6 0 0 0 12 3Z');
export const IcCalendar = S('M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 3v4M16 3v4M4 10h16');
export const IcClock = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2');
export const IcMic = S('M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM5 11a7 7 0 0 0 14 0M12 18v3');
export const IcPlay = S('M7 4.5v15l12-7.5-12-7.5Z');
export const IcShield = S('M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z');
export const IcDownload = S('M12 3v12M7 11l5 5 5-5M4 21h16');
export const IcUser = S('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z');
export const IcMenu = S('M4 7h16M4 12h16M4 17h16');
export const IcSparkle = S('M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8');
export const IcAlert = S('M12 8v5M12 16.5v.5M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z');
export const IcInfo = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.5');
export const IcLock = S('M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7a4 4 0 1 1 8 0v4');
export const IcGrid = S('M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z');
export const IcFile = S('M14 2H6a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7l-5-5ZM14 2v5h5');
export const IcWifi = S('M5 12.5a10 10 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01');
export const IcSignal = S('M4 20v-4M9 20v-8M14 20v-12M19 20V4');
export const IcBattery = S('M3 8h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM21 11v2');
export const IcTrash = S('M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14');
export const IcCompare = S('M12 3v18M6 7l-3 5h6l-3-5Zm12 10 3 5h-6l3-5Z');
export const IcDna = S('M6 2c0 6 12 6 12 12M18 22c0-6-12-6-12-12M6 22c0-3 12-3 12-6M8 6h8M7 18h10');
export const IcFilter = S('M3 5h18l-7 8v6l-4 2v-8L3 5Z');
export const IcSwords = S('m14.5 14.5 3 3M3 3l7 7M9.5 14.5l-3 3M21 3l-7 7M3 21l4-4M21 21l-4-4');
export const IcZap = S('M13 2 4 14h7l-1 8 9-12h-7l1-8Z');
export const IcHeadphones = S('M4 15v-3a8 8 0 1 1 16 0v3M4 15a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v-5H4Zm16 0a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1v-5h1Z');
export const IcGem = S('M6 3h12l4 6-10 12L2 9l4-6ZM12 21 8 9m4 12 4-12M2 9h20M9 9l3-6 3 6');
export const IcArchive = S('M3 5h18v4H3V5Zm1 4h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Zm5 4h6');
export const IcBolt = IcZap;