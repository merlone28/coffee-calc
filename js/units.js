import { $, applyLang, save, state } from './app.js';
import { t } from './i18n.js';

// ===== Unità di misura: metriche (g, ml, °C) o imperiali (oz, fl oz, °F) =====
// Tutti i dati interni (stato, ricette, diario, link condivisi) restano in grammi e °C:
// le unità imperiali sono solo una conversione di visualizzazione e di inserimento.
export const G_PER_OZ = 28.3495;
export const ML_PER_FLOZ = 29.5735;

export const isImperial = () => state.units === 'imperial';

const decimalSep = () => (state.lang === 'en' ? '.' : ',');
const num = s => parseFloat(String(s).replace(',', '.'));

// Numero con poche cifre significative: 2 decimali sotto 10, 1 oltre; niente zeri finali
function fmtAmount(x) {
  const s = (x < 10 ? x.toFixed(2) : x.toFixed(1)).replace(/\.?0+$/, '');
  return s.replace('.', decimalSep());
}
export const gToOz = g => g / G_PER_OZ;
export const ozToG = oz => oz * G_PER_OZ;
export const cToF = c => c * 9 / 5 + 32;

// Valore per i campi di input (dose/acqua) nell'unità corrente
export function massForInput(g) {
  return isImperial() ? Math.round(gToOz(g) * 100) / 100 : Math.round(g * 2) / 2;
}
export function massFromInput(x) { return isImperial() ? ozToG(x) : x; }

// Massa in forma compatta senza spazio ("20g" / "0,7oz"), per i testi che la usavano già così
export function massShort(g, fmt) { return isImperial() ? fmtAmount(gToOz(g)) + 'oz' : fmt(g) + 'g'; }
export function tempText(c) { return isImperial() ? Math.round(cToF(c)) + '°F' : c + '°C'; }

const N = '(\\d+(?:[.,]\\d+)?)';
const RANGE = `${N}(?:\\s?[–-]\\s?${N})?`;
const RE_MASS = new RegExp(`${RANGE}\\s(g|ml)\\b(?![\\/\\w])`, 'g');
const RE_TEMP = new RegExp(`${RANGE}\\s?°\\s?C\\b`, 'g');
const RE_LABEL = /\((?:g|g \/ ml)\)/g;

// Converte le quantità scritte nel testo (es. "Versa 60 g a 93 °C"). Idempotente:
// il risultato non contiene più "g", "ml" o "°C", quindi una seconda passata non cambia nulla.
export function convertText(str, imperial = isImperial()) {
  if (!imperial || !str) return str;
  return str
    .replace(RE_MASS, (m, a, b, unit) => {
      const f = unit === 'ml' ? ML_PER_FLOZ : G_PER_OZ;
      const out = fmtAmount(num(a) / f) + (b ? '–' + fmtAmount(num(b) / f) : '');
      return out + (unit === 'ml' ? ' fl oz' : ' oz');
    })
    .replace(RE_TEMP, (m, a, b) =>
      Math.round(cToF(num(a))) + (b ? '–' + Math.round(cToF(num(b))) : '') + ' °F')
    .replace(RE_LABEL, '(oz)');
}

// ----- Conversione del DOM -----
// I testi dell'app contengono quantità un po' ovunque (procedure, ricette, timer, diario, toast):
// invece di cambiare ogni punto che li genera, i nodi di testo vengono convertiti dopo la scrittura.
// Per poter tornare alle unità metriche si ricorda il testo originale di ogni nodo convertito.
const converted = new WeakMap(); // nodo di testo -> { orig, conv }
const SKIP = 'script, style, textarea, input, [data-no-units], .diary-item-note, .compare-note';

function localizeNode(node, imperial) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const cur = node.nodeValue, rec = converted.get(node);
    if (rec && cur === rec.conv) {                  // già convertito da noi
      if (!imperial) { node.nodeValue = rec.orig; converted.delete(node); }
      return;
    }
    if (!imperial) return;
    const conv = convertText(cur, true);
    if (conv !== cur) { converted.set(node, { orig: cur, conv }); node.nodeValue = conv; }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (w.nextNode()) texts.push(w.currentNode);
    texts.forEach(n => localizeNode(n, imperial));
  }
}

export function localizeAll() { localizeNode(document.body, isImperial()); }

export function updateUnitsBtn() {
  const b = $('unitsBtn');
  b.textContent = isImperial() ? 'oz' : 'g';
  b.title = t('unitsTitle');
  b.setAttribute('aria-pressed', String(isImperial()));
}

let observer = null;
export function initUnits() {
  observer = new MutationObserver(muts => {
    if (!isImperial()) return;
    for (const m of muts) {
      if (m.type === 'characterData') localizeNode(m.target, true);
      else m.addedNodes.forEach(n => localizeNode(n, true));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  $('unitsBtn').addEventListener('click', () => {
    state.units = isImperial() ? 'metric' : 'imperial';
    save();
    localizeAll();   // metriche: ripristina i testi convertiti che applyLang non riscrive
    applyLang();     // riscrive i testi dai dati metrici (l'osservatore li riconverte se imperiali)
    localizeAll();
  });
  updateUnitsBtn();
  localizeAll();
}
