import { ROAST, fmt } from './core.js';
import { METHODS } from './data/methods.js';
import { RECIPES, activeRecipe } from './data/recipes.js';
import { t } from './i18n.js';
import { $, getVals, renderFreshness, save, state } from './app.js';
import { render } from './render.js';
import { timer } from './timer.js';
import { showToast } from './share.js';
import { renderInsights } from './insights.js';
import { gToOz, isOz, massShort, ozToG } from './units.js';
import { diaryBackend, getDiary, onDiaryStoreError, openDiaryStore, setDiary } from './diary-store.js';
import { EY_TARGET, TDS_RANGE, entryExtraction, estimateOut, extractionYield, eyVerdict } from './extraction.js';

// ===== Diario infusioni =====
let pendingDiary = null, pendingRating = 0;
export let compareMode = false, compareSelected = [];
let diaryFilter = null, editingDiaryId = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Normalizza una voce del diario (da localStorage o da un file importato):
// tiene solo i campi noti, forza i tipi e limita i range. Restituisce null se inutilizzabile.
export function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.methodName !== 'string' || !raw.methodName.trim()) return null;
  const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const dose = num(raw.dose, 0.1, 5000), water = num(raw.water, 0.1, 50000), ratio = num(raw.ratio, 0.1, 1000);
  if (dose == null || water == null || ratio == null) return null;
  const d = new Date(raw.date);
  let id = raw.id;
  if (typeof id === 'string') id = id.replace(/[^\w.-]/g, '').slice(0, 40);
  if (typeof id !== 'string' && !Number.isFinite(id)) id = null;
  if (id === '' || id == null) id = Date.now() + Math.random();
  const e = {
    id, date: isNaN(d) ? new Date(0).toISOString() : d.toISOString(),
    methodName: str(raw.methodName, 80), dose, water, ratio,
    rating: Math.round(num(raw.rating, 0, 5) || 0), note: str(raw.note, 1000)
  };
  if (typeof raw.method === 'string' && METHODS[raw.method]) e.method = raw.method;
  const temp = num(raw.temp, 0, 100); if (temp != null && temp > 0) e.temp = temp;
  const tds = num(raw.tds, TDS_RANGE.min, TDS_RANGE.max); if (tds != null) e.tds = tds;
  const out = num(raw.out, 1, 50000); if (out != null) e.out = out;
  if (raw.cbMode === 'conc' || raw.cbMode === 'rtd') e.cbMode = raw.cbMode;
  if (typeof raw.recipe === 'string') e.recipe = raw.recipe.replace(/[^\w-]/g, '').slice(0, 40);
  if (typeof raw.recipeTag === 'string') e.recipeTag = raw.recipeTag.slice(0, 40);
  return e;
}
// Il diario vive in IndexedDB (vedi diary-store.js): qui si lavora su una copia in memoria, dalla voce più recente.
export function startDiary() { return openDiaryStore(sanitizeEntry); }
export function loadDiary() { return getDiary(); }
function saveDiary(arr) { setDiary(arr); }

// Quante voci mostrare alla volta nell'elenco (le altre con "Mostra altre")
const DIARY_PAGE = 50;
let diaryVisible = DIARY_PAGE;

function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function computeStreak(diary) {
  const days = new Set(diary.map(e => dayKey(new Date(e.date))));
  let cursor = new Date();
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function renderDiaryStats(diary) {
  const el = $('diaryStats');
  if (!diary.length) { el.classList.add('hidden'); return; }
  const rated = diary.filter(e => e.rating > 0);
  const avg = rated.length ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length) : 0;
  const counts = {};
  diary.forEach(e => { counts[e.methodName] = (counts[e.methodName] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const streak = computeStreak(diary);
  el.innerHTML = `
    <div class="dstat"><div class="dstat-val">${diary.length}</div><div class="dstat-lab">${t('dstatBrews')}</div></div>
    <div class="dstat"><div class="dstat-val">${avg ? avg.toFixed(1) + '★' : '—'}</div><div class="dstat-lab">${t('dstatAvg')}</div></div>
    <div class="dstat"><div class="dstat-val">${escapeHtml(top)}</div><div class="dstat-lab">${t('dstatFav')}</div></div>
    <div class="dstat"><div class="dstat-val">${streak}${state.lang === 'en' ? 'd' : 'g'}</div><div class="dstat-lab">${t('dstatStreak')}</div></div>`;
  el.classList.remove('hidden');
}
export function renderDiary() {
  const diary = loadDiary();
  $('diaryEmpty').classList.toggle('hidden', diary.length > 0);
  renderDiaryStats(diary);
  $('diaryCompareBtn').disabled = diary.length < 2 && !compareMode;

  // Se il browser non permette IndexedDB il diario resta in localStorage, più fragile: lo si dice
  const limited = diaryBackend() !== 'indexeddb';
  $('diaryStorageNote').classList.toggle('hidden', !limited);
  if (limited) {
    $('diaryStorageText').textContent = t('diaryStorageLimited');
    $('diaryStorageExport').textContent = t('diaryExportNow');
  }

  // Filtro per metodo
  const methodsPresent = [...new Set(diary.map(e => e.method))].filter(k => METHODS[k]);
  const fWrap = $('diaryFilter');
  if (methodsPresent.length > 1 && !compareMode) {
    if (diaryFilter && !methodsPresent.includes(diaryFilter)) diaryFilter = null;
    fWrap.innerHTML = `<button class="diary-filter-chip ${!diaryFilter ? 'active' : ''}" data-f="">${t('diaryFilterAll')}</button>` +
      methodsPresent.map(k => `<button class="diary-filter-chip ${diaryFilter === k ? 'active' : ''}" data-f="${k}">${METHODS[k].name}</button>`).join('');
    fWrap.classList.remove('hidden');
    fWrap.querySelectorAll('.diary-filter-chip').forEach(b =>
      b.addEventListener('click', () => { diaryFilter = b.dataset.f || null; diaryVisible = DIARY_PAGE; renderDiary(); }));
  } else {
    fWrap.classList.add('hidden');
    if (compareMode) diaryFilter = null;
  }

  const shown = diaryFilter ? diary.filter(e => e.method === diaryFilter) : diary;
  const xIcon = '<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const penIcon = '<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
  const more = $('diaryMore');
  more.classList.toggle('hidden', shown.length <= diaryVisible);
  more.textContent = t('diaryShowMore')(Math.min(DIARY_PAGE, shown.length - diaryVisible));
  $('diaryList').innerHTML = shown.slice(0, diaryVisible).map(e => {
    const date = new Date(e.date).toLocaleDateString(t('localeCode'), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const stars = e.rating ? `<div class="diary-stars-display">${'★'.repeat(e.rating)}${'☆'.repeat(5 - e.rating)}</div>` : '';
    const noteClamp = e.note && e.note.length > 90 ? ' clamp' : '';
    const note = e.note ? `<div class="diary-item-note${noteClamp}" data-id="${e.id}">"${escapeHtml(e.note)}"</div>` : '';
    const temp = e.temp ? ` · ${e.temp} °C` : '';
    const check = compareMode ? `<input type="checkbox" class="diary-compare-check" data-id="${e.id}" ${compareSelected.includes(String(e.id)) ? 'checked' : ''}>` : '';
    const actions = compareMode ? '' :
      `<button class="diary-edit" data-id="${e.id}" title="${t('diaryEditTitle')}" aria-label="${t('diaryEditTitle')}">${penIcon}</button>` +
      `<button class="diary-del" data-id="${e.id}" aria-label="${t('ariaDelete')}">${xIcon}</button>`;
    return `<div class="diary-item">
      <div class="diary-item-top">
        ${check}<span class="diary-item-method">${escapeHtml(e.methodName)}${e.recipeTag ? ' · ' + escapeHtml(e.recipeTag) : ''}</span>
        <span class="diary-item-date">${date}</span>
        ${actions}
      </div>
      <div class="diary-item-recipe">${fmt(e.dose)} g → ${fmt(e.water)} g · 1:${e.ratio}${temp}</div>
      ${eyLine(e)}${stars}${note}
    </div>`;
  }).join('');

  if (compareMode) {
    $('diaryList').querySelectorAll('.diary-compare-check').forEach(cb => cb.addEventListener('change', onCompareCheck));
  } else {
    $('diaryList').querySelectorAll('.diary-del').forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('confirm')) {
        saveDiary(loadDiary().filter(e => String(e.id) !== b.dataset.id));
        renderDiary();
      } else {
        $('diaryList').querySelectorAll('.diary-del.confirm').forEach(x => { x.classList.remove('confirm'); x.innerHTML = xIcon; });
        b.classList.add('confirm');
        b.textContent = t('diaryDeleteConfirm');
        setTimeout(() => { if (b.isConnected && b.classList.contains('confirm')) { b.classList.remove('confirm'); b.innerHTML = xIcon; } }, 3000);
      }
    }));
    $('diaryList').querySelectorAll('.diary-edit').forEach(b => b.addEventListener('click', () => {
      const entry = loadDiary().find(e => String(e.id) === b.dataset.id);
      if (entry) openDiaryForm(entry, true);
    }));
    $('diaryList').querySelectorAll('.diary-item-note').forEach(n =>
      n.addEventListener('click', () => n.classList.toggle('clamp')));
  }
  renderRepeatBanner();
  renderInsights();
}

// ===== Confronto ricette =====
function onCompareCheck(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) {
    compareSelected.push(id);
    if (compareSelected.length > 2) compareSelected.shift();
  } else {
    compareSelected = compareSelected.filter(x => x !== id);
  }
  if (compareSelected.length === 2) {
    openCompare(compareSelected[0], compareSelected[1]);
    compareMode = false; compareSelected = [];
    $('diaryCompareBtn').textContent = t('diaryCompareBtn');
    renderDiary();
  } else {
    showToast(t('compareSelectToast'));
  }
}
function compareColHtml(e) {
  const ex = entryExtraction(e);
  const date = new Date(e.date).toLocaleDateString(t('localeCode'), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stars = e.rating ? `<div class="compare-stars">${'★'.repeat(e.rating)}${'☆'.repeat(5 - e.rating)}</div>` : `<div class="compare-stars">—</div>`;
  return `<div class="compare-col">
    <div class="compare-col-method">${escapeHtml(e.methodName)}</div>
    <div class="compare-col-date">${date}</div>
    <div class="compare-row"><span>${t('rbCoffee')}</span><b>${fmt(e.dose)} g</b></div>
    <div class="compare-row"><span>${t('rbWater')}</span><b>${fmt(e.water)} g</b></div>
    <div class="compare-row"><span>${t('rbRatio')}</span><b>1:${e.ratio}</b></div>
    <div class="compare-row"><span>${t('rbTemp')}</span><b>${e.temp ? e.temp + ' °C' : '—'}</b></div>
    <div class="compare-row"><span>TDS</span><b>${ex ? fmtPct(ex.tds, 2) : '—'}</b></div>
    <div class="compare-row"><span>EY</span><b>${ex ? eyValue(ex) + ' · ' + t('ey_' + ex.verdict) : '—'}</b></div>
    <div class="compare-row"><span>${t('dstatAvg')}</span>${stars}</div>
    <div class="compare-note">${e.note ? '"' + escapeHtml(e.note) + '"' : t('compareNoNote')}</div>
  </div>`;
}
function openCompare(id1, id2) {
  const diary = loadDiary();
  const e1 = diary.find(e => String(e.id) === String(id1));
  const e2 = diary.find(e => String(e.id) === String(id2));
  if (!e1 || !e2) return;
  $('compareTitle').textContent = t('compareTitle');
  $('compareGrid').innerHTML = compareColHtml(e1) + compareColHtml(e2);
  $('compareOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// ===== Ripeti ultima infusione =====
function renderRepeatBanner() {
  const diary = loadDiary();
  const wrap = $('repeatBanner');
  if (!diary.length) { wrap.classList.add('hidden'); return; }
  const last = diary[0];
  if (!METHODS[last.method]) { wrap.classList.add('hidden'); return; }
  $('repeatBannerText').innerHTML = `${t('repeatBannerPrefix')} <b>${escapeHtml(last.methodName)}</b> — <b>${massShort(last.dose, fmt)} : ${massShort(last.water, fmt)}</b>`;
  $('repeatLastBtn').textContent = t('repeatLastBtn');
  wrap.classList.remove('hidden');
}

// ----- TDS / EY -----
const fmtPct = (x, d) => x.toLocaleString(t('localeCode'), { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
const eyValue = ex => (ex.estimated ? '~' : '') + fmtPct(ex.ey, 1);
function eyLine(e) {
  const ex = entryExtraction(e);
  if (!ex) return '';
  return `<div class="diary-item-ey ey-${ex.verdict}">TDS ${fmtPct(ex.tds, 2)} · EY ${eyValue(ex)} · ${t('ey_' + ex.verdict)}</div>`;
}
const parseNum = s => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
// Campo "bevanda ottenuta" nell'unità corrente (g con 1 decimale, oppure oz)
const outToInput = g => (isOz() ? Math.round(gToOz(g) * 100) / 100 : Math.round(g * 10) / 10);
const outFromInput = x => (isOz() ? ozToG(x) : x);

// Legge TDS e bevanda dal modulo (in grammi); i valori vuoti o fuori range restano undefined
function readExtractionFields() {
  const tds = parseNum($('diaryTds').value);
  const out = parseNum($('diaryOut').value);
  const outG = out != null ? outFromInput(out) : null;
  return {
    tds: tds != null && tds >= TDS_RANGE.min && tds <= TDS_RANGE.max ? tds : undefined,
    out: outG != null && outG >= 1 && outG <= 50000 ? outG : undefined
  };
}
function renderEyPreview() {
  const box = $('diaryEyPreview');
  const base = pendingDiary;
  const { tds, out } = readExtractionFields();
  const est = estimateOut(base.water, base.dose);
  $('diaryOut').placeholder = '~' + outToInput(est);
  const ey = tds != null ? extractionYield(tds, base.dose, out != null ? out : est) : null;
  if (ey == null) { box.classList.add('hidden'); box.textContent = ''; return; }
  const verdict = eyVerdict(ey);
  const tip = verdict === 'under' ? t('eyTipUnder') : verdict === 'over' ? t('eyTipOver') : '';
  const nonFilter = base.method === 'moka' || base.method === 'coldbrew';
  box.className = 'diary-ey-preview ey-' + verdict;
  box.textContent = `EY ${(out == null ? '~' : '') + fmtPct(ey, 1)} · ${t('ey_' + verdict)} (${t('eyTarget')(EY_TARGET.lo, EY_TARGET.hi)}).` +
    (out == null ? ` ${t('eyEstimated')}` : '') + (tip ? ` ${tip}` : '') + (nonFilter ? ` ${t('eyNonFilter')}` : '');
}

function openDiaryForm(prefill, isEdit) {
  pendingDiary = prefill;
  editingDiaryId = isEdit ? prefill.id : null;
  pendingRating = isEdit ? (prefill.rating || 0) : 0;
  $('diaryFormTitle').textContent = isEdit ? t('diaryEditTitle') : t('diaryFormTitle');
  const temp = prefill.temp ? ` · ${prefill.temp} °C` : '';
  $('diaryFormRecipe').textContent = `${prefill.methodName} — ${massShort(prefill.dose, fmt)} : ${massShort(prefill.water, fmt)} (1:${prefill.ratio})${temp}`;
  $('diaryStars').querySelectorAll('button').forEach(b => b.classList.toggle('filled', parseInt(b.dataset.v, 10) <= pendingRating));
  $('diaryNote').value = isEdit ? (prefill.note || '') : '';
  $('diaryTdsLabel').textContent = t('tdsLabel');
  $('diaryOutLabel').textContent = t('outLabel');
  $('diaryTds').value = isEdit && prefill.tds ? String(prefill.tds) : '';
  $('diaryOut').value = isEdit && prefill.out ? String(outToInput(prefill.out)) : '';
  $('diaryOut').step = isOz() ? '0.05' : '1';
  renderEyPreview();
  $('diaryOverlay').classList.add('show');
}

export function initDiary() {
  $('diaryCompareBtn').addEventListener('click', () => {
    const diary = loadDiary();
    if (diary.length < 2) return;
    compareMode = !compareMode;
    compareSelected = [];
    $('diaryCompareBtn').textContent = compareMode ? t('diaryCompareCancelBtn') : t('diaryCompareBtn');
    renderDiary();
  });
  $('compareClose').addEventListener('click', () => {
    $('compareOverlay').classList.remove('show');
    document.body.style.overflow = '';
  });
  // ===== Export / import diario =====
  $('diaryExportBtn').addEventListener('click', () => {
    const diary = loadDiary();
    const payload = {
      app: 'coffee-brew-calc', version: 2, exportedAt: new Date().toISOString(),
      settings: { roast: state.roast || 'medium', roastDate: state.roastDate || null },
      diary
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url; a.download = `${state.lang === 'en' ? 'coffee-diary' : 'diario-caffe'}-${dateStr}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(t('diaryExported'));
  });
  $('diaryTds').addEventListener('input', renderEyPreview);
  $('diaryOut').addEventListener('input', renderEyPreview);
  $('diaryStorageExport').addEventListener('click', () => $('diaryExportBtn').click());
  $('diaryMore').addEventListener('click', () => { diaryVisible += DIARY_PAGE; renderDiary(); });
  onDiaryStoreError(() => showToast(t('diaryStorageError')));
  $('diaryImportBtn').addEventListener('click', () => $('diaryImportFile').click());
  $('diaryImportFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data) ? data : (Array.isArray(data.diary) ? data.diary : null);
        if (!incoming) throw new Error('invalid');
        const existing = loadDiary();
        const existingIds = new Set(existing.map(x => String(x.id)));
        let added = 0, skipped = 0;
        incoming.forEach(raw => {
          const entry = sanitizeEntry(raw);
          if (!entry) return;
          if (raw.id && existingIds.has(String(entry.id))) { skipped++; return; }
          existing.push(entry);
          existingIds.add(String(entry.id));
          added++;
        });
        existing.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        saveDiary(existing);
        // Ripristina impostazioni tostatura se presenti nel backup (v2)
        let settingsMsg = '';
        if (data && data.settings && typeof data.settings === 'object') {
          if (data.settings.roast && ROAST[data.settings.roast]) state.roast = data.settings.roast;
          if ('roastDate' in data.settings) {
            state.roastDate = data.settings.roastDate || null;
            $('roastDateInput').value = state.roastDate || '';
          }
          save(); renderFreshness(); render();
          settingsMsg = t('diarySettingsRestored');
        }
        renderDiary();
        showToast(t('diaryImported')(added) + (skipped ? t('diaryImportSkipped')(skipped) : '') + settingsMsg);
      } catch (err) {
        showToast(t('diaryImportInvalid'));
      }
      $('diaryImportFile').value = '';
    };
    reader.readAsText(file);
  });
  $('repeatLastBtn').addEventListener('click', () => {
    const diary = loadDiary();
    if (!diary.length) return;
    const last = diary[0];
    if (!METHODS[last.method]) return;
    state.method = last.method;
    state.vals[last.method] = { dose: last.dose, ratio: last.ratio };
    if (last.temp) state.vals[last.method].temp = last.temp;
    if (last.recipe && RECIPES[last.method] && RECIPES[last.method].find(r => r.id === last.recipe)) state.vals[last.method].recipe = last.recipe;
    if (METHODS[last.method].coldbrew && last.cbMode) state.cbMode = last.cbMode;
    save();
    render();
    showToast(t('recipeReloaded'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('diaryStars').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    pendingRating = parseInt(b.dataset.v, 10);
    $('diaryStars').querySelectorAll('button').forEach(x => x.classList.toggle('filled', parseInt(x.dataset.v, 10) <= pendingRating));
  }));
  $('diaryClose').addEventListener('click', () => { editingDiaryId = null; $('diaryOverlay').classList.remove('show'); });
  $('diarySaveBtn').addEventListener('click', () => {
    if (!pendingDiary) return;
    const diary = loadDiary();
    if (editingDiaryId != null) {
      const i = diary.findIndex(e => String(e.id) === String(editingDiaryId));
      if (i >= 0) {
        diary[i].rating = pendingRating;
        diary[i].note = $('diaryNote').value.trim();
      const ex = readExtractionFields();
      if (ex.tds != null) diary[i].tds = ex.tds; else delete diary[i].tds;
      if (ex.out != null) diary[i].out = ex.out; else delete diary[i].out;
      }
      saveDiary(diary);
      renderDiary();
      $('diaryOverlay').classList.remove('show');
      showToast(t('diaryUpdated'));
      editingDiaryId = null;
      return;
    }
    const entry = Object.assign({ id: Date.now(), date: new Date().toISOString(), rating: pendingRating, note: $('diaryNote').value.trim() }, pendingDiary, readExtractionFields());
    if (entry.tds == null) delete entry.tds;
    if (entry.out == null) delete entry.out;
    diary.unshift(entry);
    saveDiary(diary);
    renderDiary();
    $('diaryOverlay').classList.remove('show');
    showToast(t('diarySaved'));
  });
  $('diaryAddBtn').addEventListener('click', () => {
    const key = state.method, m = METHODS[key], v = getVals(key);
    const arD = activeRecipe(key);
    openDiaryForm({ method: key, methodName: m.name, dose: v.dose, water: Math.round(v.dose * v.ratio), ratio: v.ratio, temp: m.temp ? v.temp : undefined, cbMode: m.coldbrew ? state.cbMode : undefined, recipe: arD ? arD.id : undefined, recipeTag: arD ? arD.chip : undefined });
  });
  $('timerSaveDiaryGuided').addEventListener('click', () => { if (timer.snapshot) openDiaryForm(timer.snapshot); });
  $('timerSaveDiaryManual').addEventListener('click', () => { if (timer.snapshot) openDiaryForm(timer.snapshot); });
  $('timerSaveDiaryLongform').addEventListener('click', () => { if (timer.snapshot) openDiaryForm(timer.snapshot); });
}
