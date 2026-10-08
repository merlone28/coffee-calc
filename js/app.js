import { fmt } from './core.js';
import { isImperial, updateUnitsBtn } from './units.js';
import { LS_KEY, METHODS, ORDER } from './data/methods.js';
import { RECIPES } from './data/recipes.js';
import { t } from './i18n.js';
import { applyTheme, render } from './render.js';
import { updateBellIcon } from './notify.js';
import { compareMode, renderDiary } from './diary.js';

// Nomi accessibili: data-aria -> aria-label tradotto; title -> aria-label per i pulsanti solo-icona
function syncAria() {
  document.querySelectorAll('[data-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.aria)));
  document.querySelectorAll('#diaryStars button').forEach(b => b.setAttribute('aria-label', b.dataset.v + ' ' + t('ariaStar')));
  document.querySelectorAll('button[title]').forEach(el => {
    if (!el.hasAttribute('data-aria') && el.title) el.setAttribute('aria-label', el.title);
  });
}

export function applyLang() {
  document.documentElement.lang = state.lang === 'en' ? 'en' : 'it';
  syncAria();
  document.title = t('appTitle');
  $('langBtn').textContent = state.lang === 'en' ? 'EN' : 'IT';
  $('langBtn').title = t('langTitle');
  $('appTitle').textContent = t('appTitle');
  $('appSubtitle').textContent = t('appSubtitle');
  $('roastRowLabel').textContent = t('roastRowLabel');
  $('roastedOnLabel').textContent = t('roastedOnLabel');
  const rl = document.querySelector('.roast-btn[data-r="light"]'); if (rl) rl.textContent = t('roastLight');
  const rm = document.querySelector('.roast-btn[data-r="medium"]'); if (rm) rm.textContent = t('roastMedium');
  const rd = document.querySelector('.roast-btn[data-r="dark"]'); if (rd) rd.textContent = t('roastDark');
  $('methodEyebrow').textContent = t('methodEyebrow');
  $('tempLabelText').textContent = t('tempLabel');
  $('grindLabel').textContent = t('grindLabel');
  $('grindFineLabel').textContent = t('grindFine');
  $('grindCoarseLabel').textContent = t('grindCoarse');
  const cc = document.querySelector('.toggle[data-cb="conc"]'); if (cc) cc.textContent = t('cbConc');
  const cr = document.querySelector('.toggle[data-cb="rtd"]'); if (cr) cr.textContent = t('cbRtd');
  $('doseWaterEyebrow').textContent = t('doseWaterEyebrow');
  $('ratioLabelText').textContent = t('ratioLabelText');
  $('resultEyebrow').textContent = t('resultEyebrow');
  $('shareBtn').textContent = t('shareLinkBtn');
  $('shareImageBtn').textContent = t('shareImageBtn');
  $('procedureEyebrow').textContent = t('procedureEyebrow');
  $('waterQualityTitle').textContent = t('waterQualityTitle');
  $('waterTdsTitle').textContent = t('waterTdsTitle'); $('waterTdsText').textContent = t('waterTdsText');
  $('waterHardTitle').textContent = t('waterHardTitle'); $('waterHardText').textContent = t('waterHardText');
  $('waterAlkTitle').textContent = t('waterAlkTitle'); $('waterAlkText').textContent = t('waterAlkText');
  $('waterPhTitle').textContent = t('waterPhTitle'); $('waterPhText').textContent = t('waterPhText');
  $('waterNoteText').textContent = t('waterNoteText');
  $('footerText').textContent = t(isImperial() ? 'footerTextImperial' : 'footerText');
  updateUnitsBtn();
  $('diaryTitle').textContent = t('diaryTitle');
  $('diaryAddBtn').textContent = t('diaryAddBtn');
  $('diaryExportBtn').textContent = t('diaryExportBtn');
  $('diaryImportBtn').textContent = t('diaryImportBtn');
  $('diaryCompareBtn').textContent = compareMode ? t('diaryCompareCancelBtn') : t('diaryCompareBtn');
  $('diaryEmpty').textContent = t('diaryEmpty');
  $('diaryFormTitle').textContent = t('diaryFormTitle');
  $('diaryNote').placeholder = t('diaryNotePlaceholder');
  $('diarySaveBtn').textContent = t('diarySaveBtn');
  $('compareTitle').textContent = t('compareTitle');
  $('timerLongformStart').textContent = t('timerLongformStartBtn');
  $('timerLongformReset').textContent = t('timerLongformResetBtn');
  updateBellIcon();
  applyTheme();
  renderFreshness();
  render();
  renderDiary();
}

export const state = { method: 'v60', cbMode: 'conc', roast: 'medium', lang: 'it', units: 'metric', vals: {} };

export function getVals(key) {
  if (!state.vals[key]) {
    const m = METHODS[key];
    let ratio = m.ratio;
    if (m.coldbrew && state.cbMode === 'rtd') ratio = 14;
    state.vals[key] = { dose: m.dose, ratio: ratio };
  }
  return state.vals[key];
}
export function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

export const $ = id => document.getElementById(id);

export function renderTabs() {
  $('tabs').innerHTML = ORDER.map(k =>
    `<button class="tab ${k === state.method ? 'active' : ''}" data-m="${k}" role="tab" aria-selected="${k === state.method}">${METHODS[k].name}</button>`
  ).join('');
  $('tabs').querySelectorAll('.tab').forEach(b =>
    b.addEventListener('click', () => { state.method = b.dataset.m; save(); render(); })
  );
}

export function renderRoastButtons() {
  document.querySelectorAll('.roast-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.r === (state.roast || 'medium')));
}
export function renderFreshness() {
  const el = $('freshnessTip');
  if (!state.roastDate) { el.classList.add('hidden'); return; }
  const roastDate = new Date(state.roastDate + 'T00:00:00');
  const days = Math.floor((Date.now() - roastDate.getTime()) / 86400000);
  if (days < 0) {
    el.textContent = t('freshFuture');
    el.classList.remove('hidden');
    return;
  }
  let msg, phase, color;
  if (days <= 3) { msg = t('freshVeryRecent')(days); phase = 'degas'; color = 'var(--ink-soft)'; }
  else if (days <= 14) { msg = t('freshPeak')(days); phase = 'peak'; color = 'var(--success)'; }
  else if (days <= 21) { msg = t('freshGood')(days); phase = 'good'; color = 'var(--success)'; }
  else if (days <= 30) { msg = t('freshFading')(days); phase = 'fading'; color = 'var(--warning)'; }
  else { msg = t('freshStale')(days); phase = 'stale'; color = 'var(--danger)'; }
  const pct = Math.max(3, Math.min(100, (days / 35) * 100));
  el.innerHTML = `
    <div class="fresh-head">
      <span class="fresh-day">${t('freshDay')(days)}</span>
      <span class="fresh-phase" style="color:${color}">${t('freshPhases')[phase]}</span>
    </div>
    <div class="fresh-bar"><div class="fresh-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <div class="fresh-msg">${msg}</div>`;
  el.classList.remove('hidden');
}

export function updateRatioVisual(dose, water) {
  if (!$('rvCoffee')) return; // barra visuale rimossa dal layout
  const total = dose + water;
  if (!total) return;
  const cPct = (dose / total) * 100;
  const wPct = 100 - cPct;
  $('rvCoffee').style.flexBasis = cPct + '%';
  $('rvWater').style.flexBasis = wPct + '%';
  $('rvCoffeeLabel').textContent = `${fmt(dose)} g · ${cPct.toFixed(1)}%`;
  $('rvWaterLabel').textContent = `${fmt(water)} g · ${wPct.toFixed(1)}%`;
}

// Lingua dell'interfaccia dalle preferenze del browser: la prima tra italiano e inglese
// nell'elenco; se nessuna è supportata, inglese (l'italiano resta il default solo per chi lo chiede).
export function detectLang(languages) {
  for (const l of languages || []) {
    const code = String(l).toLowerCase().split(/[-_]/)[0];
    if (code === 'it' || code === 'en') return code;
  }
  return 'en';
}

export function initApp() {
  new MutationObserver(syncAria).observe(document.body, { attributes: true, attributeFilter: ['title'], subtree: true });
  let hasSaved = false;
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && METHODS[saved.method]) { Object.assign(state, saved); hasSaved = true; }
  } catch (e) {}
  // Prima visita: nessuna scelta salvata, quindi si parte dalla lingua del browser
  if (!hasSaved) state.lang = detectLang(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
  // Ricetta condivisa via link (?m=v60&d=20&r=15&cb=conc)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('lang') && (params.get('lang') === 'en' || params.get('lang') === 'it')) {
      state.lang = params.get('lang');
    }
    if (params.has('m') && METHODS[params.get('m')]) {
      const key = params.get('m');
      const d = parseFloat(params.get('d'));
      const r = parseFloat(params.get('r'));
      state.method = key;
      if (params.has('cb')) state.cbMode = params.get('cb') === 'rtd' ? 'rtd' : 'conc';
      state.vals = state.vals || {};
      state.vals[key] = {
        dose: d > 0 ? d : METHODS[key].dose,
        ratio: r > 0 ? r : METHODS[key].ratio
      };
      const tw = parseInt(params.get('tw'), 10);
      if (tw > 0) state.vals[key].temp = tw;
      const rc = params.get('rc');
      if (rc && RECIPES[key] && RECIPES[key].find(r => r.id === rc)) state.vals[key].recipe = rc;
      save();
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  } catch (e) {}
  document.querySelectorAll('.roast-btn').forEach(b => b.addEventListener('click', () => {
    state.roast = b.dataset.r; save(); render();
  }));
  // ===== Data di tostatura e freschezza =====
  if (state.roastDate) $('roastDateInput').value = state.roastDate;
  $('roastDateInput').addEventListener('change', () => {
    state.roastDate = $('roastDateInput').value || null;
    save(); renderFreshness();
  });
  renderFreshness();
}
