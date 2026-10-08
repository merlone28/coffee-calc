import { $, applyLang, save, state } from './app.js';
import { ICON } from './core.js';
import { t } from './i18n.js';

// ===== Unità di misura =====
// Di default tutto è metrico (g, ml, °C). Tre impostazioni indipendenti:
//   peso (caffè e acqua)  g | oz      volume (es. tazze)  ml | fl oz      temperatura  °C | °F
// Tutti i dati interni (stato, ricette, diario, link condivisi) restano in grammi e °C: le altre
// unità sono solo una conversione di visualizzazione e di inserimento.
export const G_PER_OZ = 28.3495;
export const ML_PER_FLOZ = 29.5735;
export const DEFAULT_UNITS = { weight: 'g', volume: 'ml', temp: 'c' };
const CHOICES = { weight: ['g', 'oz'], volume: ['ml', 'floz'], temp: ['c', 'f'] };

// Impostazioni correnti, sempre valide anche se lo stato salvato è vuoto o malformato
export function units() {
  const u = state.units && typeof state.units === 'object' ? state.units : {};
  const pick = k => (CHOICES[k].includes(u[k]) ? u[k] : DEFAULT_UNITS[k]);
  return { weight: pick('weight'), volume: pick('volume'), temp: pick('temp') };
}
export const isOz = () => units().weight === 'oz';
export const isF = () => units().temp === 'f';
export const isCustom = (u = units()) => Object.keys(DEFAULT_UNITS).some(k => u[k] !== DEFAULT_UNITS[k]);

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
  return isOz() ? Math.round(gToOz(g) * 100) / 100 : Math.round(g * 2) / 2;
}
export function massFromInput(x) { return isOz() ? ozToG(x) : x; }

// Massa in forma compatta senza spazio ("20g" / "0,7oz"), per i testi che la usavano già così
export function massShort(g, fmt) { return isOz() ? fmtAmount(gToOz(g)) + 'oz' : fmt(g) + 'g'; }

const N = '(\\d+(?:[.,]\\d+)?)';
const RANGE = `${N}(?:\\s?[–-]\\s?${N})?`;
const RE_MASS = new RegExp(`${RANGE}\\s(g|ml)\\b(?![\\/\\w])`, 'g');
const RE_TEMP = new RegExp(`${RANGE}\\s?°\\s?C\\b`, 'g');
const RE_LABEL = /\((?:g|g \/ ml)\)/g;

// Converte le quantità scritte nel testo (es. "Versa 60 g a 93 °C") secondo le unità scelte.
// Idempotente: il risultato non contiene più le unità convertite, quindi una seconda passata non cambia nulla.
export function convertText(str, u = units()) {
  if (!str || !isCustom(u)) return str;
  return str
    .replace(RE_MASS, (m, a, b, unit) => {
      if (unit === 'g' && u.weight !== 'oz') return m;
      if (unit === 'ml' && u.volume !== 'floz') return m;
      const f = unit === 'ml' ? ML_PER_FLOZ : G_PER_OZ;
      const out = fmtAmount(num(a) / f) + (b ? '–' + fmtAmount(num(b) / f) : '');
      return out + (unit === 'ml' ? ' fl oz' : ' oz');
    })
    .replace(RE_TEMP, (m, a, b) => u.temp !== 'f' ? m :
      Math.round(cToF(num(a))) + (b ? '–' + Math.round(cToF(num(b))) : '') + ' °F')
    .replace(RE_LABEL, m => (u.weight === 'oz' ? '(oz)' : m));
}

// ----- Conversione del DOM -----
// I testi dell'app contengono quantità un po' ovunque (procedure, ricette, timer, diario, toast):
// invece di cambiare ogni punto che li genera, i nodi di testo vengono convertiti dopo la scrittura.
// Per poter tornare alle unità di partenza si ricorda il testo originale di ogni nodo convertito.
const converted = new WeakMap(); // nodo di testo -> { orig, conv }
const SKIP = 'script, style, textarea, input, [data-no-units], .diary-item-note, .compare-note';

// mode 'convert': converte secondo le unità correnti; 'restore': rimette i testi originali
function localizeNode(node, mode) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const cur = node.nodeValue, rec = converted.get(node);
    if (rec && cur === rec.conv) {                  // già convertito da noi
      if (mode === 'restore') { node.nodeValue = rec.orig; converted.delete(node); }
      return;
    }
    if (mode !== 'convert') return;
    const conv = convertText(cur);
    if (conv !== cur) { converted.set(node, { orig: cur, conv }); node.nodeValue = conv; }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (w.nextNode()) texts.push(w.currentNode);
    texts.forEach(n => localizeNode(n, mode));
  }
}

function localizeAll() { localizeNode(document.body, 'convert'); }

// ----- Pulsante e finestra delle unità -----
export function updateUnitsBtn() {
  const b = $('unitsBtn');
  b.innerHTML = ICON.sliders;
  b.title = t('unitsTitle');
  b.setAttribute('aria-haspopup', 'dialog');
  b.classList.toggle('on', isCustom());
}

const LABELS = {
  weight: { g: 'g', oz: 'oz' },
  volume: { ml: 'ml', floz: 'fl oz' },
  temp: { c: '°C', f: '°F' }
};
function renderUnitsDialog() {
  const u = units();
  $('unitsTitleText').textContent = t('unitsTitle');
  $('unitsNote').textContent = t('unitsNote');
  $('unitsPresetMetric').textContent = t('unitsPresetMetric');
  $('unitsPresetImperial').textContent = t('unitsPresetImperial');
  document.querySelectorAll('#unitsOverlay .units-row').forEach(row => {
    const k = row.dataset.k;
    row.querySelector('.units-label').textContent = t('units_' + k);
    const group = row.querySelector('.roast-group');
    group.innerHTML = CHOICES[k].map(v =>
      `<button type="button" class="roast-btn ${u[k] === v ? 'active' : ''}" data-k="${k}" data-v="${v}" aria-pressed="${u[k] === v}">${LABELS[k][v]}</button>`).join('');
  });
}

// Applica nuove unità: ripristina i testi convertiti, li riscrive dai dati metrici e riconverte
function setUnits(next) {
  state.units = Object.assign(units(), next);
  save();
  localizeNode(document.body, 'restore');
  applyLang();
  localizeAll();
  updateUnitsBtn();
  renderUnitsDialog();
}

let observer = null;
export function initUnits() {
  observer = new MutationObserver(muts => {
    if (!isCustom()) return;
    for (const m of muts) {
      if (m.type === 'characterData') localizeNode(m.target, 'convert');
      else m.addedNodes.forEach(n => localizeNode(n, 'convert'));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  $('unitsBtn').addEventListener('click', () => {
    renderUnitsDialog();
    $('unitsOverlay').classList.add('show');
  });
  $('unitsClose').addEventListener('click', () => $('unitsOverlay').classList.remove('show'));
  $('unitsOverlay').addEventListener('click', e => {
    const b = e.target.closest('[data-k][data-v]');
    if (b) setUnits({ [b.dataset.k]: b.dataset.v });
  });
  $('unitsPresetMetric').addEventListener('click', () => setUnits(DEFAULT_UNITS));
  $('unitsPresetImperial').addEventListener('click', () => setUnits({ weight: 'oz', volume: 'floz', temp: 'f' }));

  updateUnitsBtn();
  localizeAll();
}
