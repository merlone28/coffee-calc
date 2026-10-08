function render() {
  renderTabs();
  renderRoastButtons();
  const key = state.method;
  const m = METHODS[key];
  const v = getVals(key);
  const water = Math.round(v.dose * v.ratio);

  $('mName').textContent = m.name;
  $('mType').textContent = mType(key);
  $('mDesc').textContent = mDesc(key);
  $('mSpecs').innerHTML = Object.entries(mSpecsOf(key)).map(([k2, val]) =>
    `<span class="spec"><b>${k2}:</b> ${val2(k2, val)}</span>`).join('');

  // Ricette celebri
  const recs = RECIPES[key] || [];
  const rBlock = $('recipesBlock');
  if (recs.length) {
    const lang2 = mLang() === 'en' ? 'en' : 'it';
    const activeId = v.recipe && recs.find(r => r.id === v.recipe) ? v.recipe : null;
    $('recipesLabel').textContent = t('recipesLabel');
    $('recipeChips').innerHTML =
      `<button class="recipe-chip ${!activeId ? 'active' : ''}" data-r="">${t('recipeClassic')}</button>` +
      recs.map(r => `<button class="recipe-chip ${activeId === r.id ? 'active' : ''}" data-r="${r.id}">${r.chip}</button>`).join('');
    $('recipeChips').querySelectorAll('.recipe-chip').forEach(b => b.addEventListener('click', () => {
      const vv = getVals(key);
      if (!b.dataset.r) {
        delete vv.recipe; delete vv.temp;
        vv.dose = m.dose;
        vv.ratio = (m.coldbrew && state.cbMode === 'rtd') ? 14 : m.ratio;
      } else {
        const r = recs.find(x => x.id === b.dataset.r);
        vv.recipe = r.id; vv.dose = r.dose; vv.ratio = r.ratio;
        if (r.temp != null) vv.temp = r.temp; else delete vv.temp;
        if (r.cbMode) state.cbMode = r.cbMode;
      }
      save(); render();
    }));
    const ar = activeId ? recs.find(r => r.id === activeId) : null;
    const rd = $('recipeDesc');
    if (ar) {
      rd.innerHTML = `<b>${ar.title[lang2]}</b> — ${ar.author}, ${ar.cred[lang2]}. ${ar.desc[lang2]}`;
      rd.classList.remove('hidden');
    } else rd.classList.add('hidden');
    rBlock.style.display = '';
  } else rBlock.style.display = 'none';

  // Tostatura: aggiusta temperatura consigliata + tip
  const note = roastNote(state.roast || 'medium');
  const tipEl = $('roastTip');
  if (note && !m.coldbrew) { tipEl.textContent = note; tipEl.classList.remove('hidden'); }
  else tipEl.classList.add('hidden');

  // Scala macinatura (le ricette possono avere la propria)
  const arGrind = activeRecipe(key);
  const grindLevel = (arGrind && arGrind.grind) || m.grind;
  $('grindDots').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(i =>
    `<span class="grind-dot ${i === grindLevel ? 'active' : ''}"></span>`
  ).join('');

  // Cold brew toggle
  const cbT = $('cbToggle');
  if (m.coldbrew) {
    cbT.style.display = 'flex';
    cbT.querySelectorAll('.toggle').forEach(b => {
      b.classList.toggle('active', b.dataset.cb === state.cbMode);
      b.onclick = () => {
        state.cbMode = b.dataset.cb;
        const vv = getVals(key);
        vv.ratio = state.cbMode === 'conc' ? 8 : 14;
        delete vv.recipe; // cambiando modalità si torna alla ricetta classica
        save(); render();
      };
    });
  } else cbT.style.display = 'none';

  // Ratio slider bounds (cold brew RTD has its own range)
  let min = m.min, max = m.max;
  if (m.coldbrew && state.cbMode === 'rtd') { min = 12; max = 16; }
  const sl = $('ratioSlider');
  sl.min = min; sl.max = max;
  if (v.ratio < min) v.ratio = min;
  if (v.ratio > max) v.ratio = max;
  sl.value = v.ratio;
  $('ratioVal').textContent = '1 : ' + v.ratio;
  $('ratioHint').textContent = mHint(key);

  // Temperatura acqua (solo metodi a caldo, range adattato alla tostatura)
  const tempRow = $('tempRow');
  if (m.temp) {
    const tDelta = ROAST[state.roast || 'medium'].tempDelta;
    const tmin = m.temp[0] + tDelta, tmax = m.temp[1] + tDelta;
    if (v.temp == null) v.temp = Math.round((tmin + tmax) / 2);
    if (v.temp < tmin) v.temp = tmin;
    if (v.temp > tmax) v.temp = tmax;
    const ts = $('tempSlider');
    ts.min = tmin; ts.max = tmax; ts.value = v.temp;
    $('tempVal').textContent = v.temp + ' °C';
    $('tempHint').textContent = t('tempRange')(tmin, tmax);
    tempRow.style.display = '';
  } else {
    tempRow.style.display = 'none';
  }

  $('doseInput').value = Math.round(v.dose * 2) / 2;
  $('waterInput').value = water;
  $('doseLabel').textContent = t(m.waterDriven ? 'doseLabelWD' : 'doseLabel');
  $('waterLabel').textContent = t(m.waterDriven ? 'waterLabelWD' : 'waterLabel');

  // Presets
  $('mPresets').innerHTML = m.presets.map((p, i) =>
    `<button class="preset" data-i="${i}">${mPresetLabel(key, i)}</button>`).join('');
  $('mPresets').querySelectorAll('.preset').forEach(b =>
    b.addEventListener('click', () => {
      const p = m.presets[+b.dataset.i];
      const vv = getVals(key);
      vv.dose = p.water / vv.ratio;
      save(); render();
    })
  );

  // Result banner
  $('resultBanner').innerHTML = buildBanner(m, v, water);

  // Steps (con eventuale ricetta attiva)
  $('mSteps').innerHTML = stepsFor(key, v.dose, water).map(s => `<li>${s}</li>`).join('');
  const arCredit = activeRecipe(key);
  const creditEl = $('recipeCredit');
  if (arCredit) {
    const lc = mLang() === 'en' ? 'en' : 'it';
    creditEl.textContent = `${arCredit.title[lc]} — ${t('recipeBy')} ${arCredit.author}`;
    creditEl.classList.remove('hidden');
  } else creditEl.classList.add('hidden');

  // Timer button label
  $('openTimerBtn').textContent = m.coldbrew ? t('timerBtnColdbrew')
    : (key === 'moka' ? t('timerBtnMoka') : t('timerBtnDefault'));

  // Barra visiva proporzione
  updateRatioVisual(v.dose, water);

  // Macinino selezionato: click di partenza e guida
  renderGrinder();
}

function buildBanner(m, v, water) {
  let banner = `
    <div class="rb-item"><div class="rb-val">${fmt(v.dose)} g</div><div class="rb-lab">${t('rbCoffee')}</div></div>
    <div class="rb-item"><div class="rb-val">${water} g</div><div class="rb-lab">${t('rbWater')}</div></div>
    <div class="rb-item rb-hero"><div class="rb-val">1:${v.ratio}</div><div class="rb-lab">${t('rbRatio')}</div></div>`;
  if (m.temp && v.temp != null) {
    banner += `<div class="rb-item"><div class="rb-val">${v.temp}°</div><div class="rb-lab">${t('rbTemp')}</div></div>`;
  }
  if (m.coldbrew && state.cbMode === 'conc') {
    banner += `<div class="rb-item"><div class="rb-val">~${Math.round(water * 2 * 0.85)} g</div><div class="rb-lab">${t('rbFinalDrink')}</div></div>`;
  } else if (!m.waterDriven && !m.coldbrew) {
    const cups = Math.max(1, Math.round(water / 200));
    banner += `<div class="rb-item"><div class="rb-val">~${cups}</div><div class="rb-lab">${t('rbCups')}</div></div>`;
  }
  return banner;
}

// Input handlers — bidirectional
$('doseInput').addEventListener('input', () => {
  const d = parseFloat($('doseInput').value);
  if (!d || d <= 0) return;
  const v = getVals(state.method);
  v.dose = d;
  save(); renderOutputs();
});
$('waterInput').addEventListener('input', () => {
  const w = parseFloat($('waterInput').value);
  if (!w || w <= 0) return;
  const v = getVals(state.method);
  v.dose = w / v.ratio;
  save(); renderOutputs();
});
$('ratioSlider').addEventListener('input', () => {
  const v = getVals(state.method);
  v.ratio = parseFloat($('ratioSlider').value);
  // keep dose fixed, recompute water
  save(); renderOutputs(true);
});
$('tempSlider').addEventListener('input', () => {
  const v = getVals(state.method);
  v.temp = parseInt($('tempSlider').value, 10);
  $('tempVal').textContent = v.temp + ' °C';
  save(); renderOutputs();
});

// Lighter re-render that doesn't rebuild inputs being typed into
function renderOutputs(fromSlider) {
  const key = state.method;
  const m = METHODS[key];
  const v = getVals(key);
  const water = Math.round(v.dose * v.ratio);
  $('ratioVal').textContent = '1 : ' + v.ratio;
  if (document.activeElement !== $('doseInput')) $('doseInput').value = Math.round(v.dose * 2) / 2;
  if (document.activeElement !== $('waterInput') || fromSlider) $('waterInput').value = water;

  $('resultBanner').innerHTML = buildBanner(m, v, water);
  $('mSteps').innerHTML = stepsFor(key, v.dose, water).map(s => `<li>${s}</li>`).join('');
  updateRatioVisual(v.dose, water);
}

// Tema chiaro/scuro
function applyTheme() {
  const th = state.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = th;
  $('themeBtn').innerHTML = th === 'dark' ? ICON.sun : ICON.moon;
  $('themeBtn').title = t('themeTitle');
}
$('themeBtn').addEventListener('click', () => {
  state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
});
applyTheme();

// Lingua
$('langBtn').addEventListener('click', () => {
  state.lang = state.lang === 'en' ? 'it' : 'en';
  save();
  applyLang();
});
