import { t } from './i18n.js';
import { state } from './app.js';

export const fmt = n => (Math.round(n * 2) / 2).toLocaleString('it-IT');
export const W = (n) => `<span class="step-water">${fmt(n)} g</span>`;
export const T = (t) => `<span class="step-time">${t}</span>`;

// ===== Inline SVG icon set (consistent rendering across platforms) =====
const svgI = (inner) => `<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
export const ICON = {
  moon: svgI('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  sun: svgI('<circle cx="12" cy="12" r="4"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"/>'),
  bell: svgI('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  bellOff: svgI('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="3" y1="3" x2="21" y2="21"/>'),
  play: svgI('<polygon points="7 4.5 19.5 12 7 19.5"/>'),
  pause: svgI('<line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>'),
  restart: svgI('<polyline points="2.5 4 2.5 10 8.5 10"/><path d="M4.8 15a9 9 0 1 0 2-9.5L2.5 10"/>'),
  skip: svgI('<polygon points="5 5 15.5 12 5 19"/><line x1="19" y1="5" x2="19" y2="19"/>'),
  prev: svgI('<polyline points="15 18 9 12 15 6"/>'),
  next: svgI('<polyline points="9 18 15 12 9 6"/>'),
  check: svgI('<polyline points="20 6 9 17 4 12"/>'),
  book: svgI('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  close: svgI('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')
};

export const ROAST = { light: { tempDelta: 2 }, medium: { tempDelta: 0 }, dark: { tempDelta: -3 } };
export function roastNote(r) { return r === 'light' ? t('roastLightNote') : r === 'dark' ? t('roastDarkNote') : ''; }
export function val2(key, val) {
  if (key !== 'Temperatura' && key !== 'Temperature') return val;
  const delta = ROAST[state.roast || 'medium'].tempDelta;
  if (!delta) return val;
  return val.replace(/(\d+)(?:–(\d+))?\s*°C/, (m, a, b) => {
    const na = parseInt(a, 10) + delta;
    const nb = b ? parseInt(b, 10) + delta : null;
    return nb != null ? `${na}–${nb} °C` : `${na} °C`;
  });
}
