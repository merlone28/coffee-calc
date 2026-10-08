import { METHODS, ORDER } from './data/methods.js';
import { activeRecipe } from './data/recipes.js';
import { $, save, state } from './app.js';
import { showToast } from './share.js';

// ===== Macinini: profili e guida alla macinatura =====
// Meccanica (click per giro, numeri per giro, µm per click, tipo di regolazione): tabella ufficiale 1zpresso.coffee/grind-setting
export const GRINDERS = {
  xultra: { name: '1Zpresso X-Ultra',  cpr: 60,  npr: 6,  um: 12.5, adj: 'external' },
  xpro:   { name: '1Zpresso X-Pro S',  cpr: 60,  npr: 6,  um: 12.5, adj: 'external' },
  jultra: { name: '1Zpresso J-Ultra',  cpr: 100, npr: 10, um: 8,    adj: 'external' },
  jmax:   { name: '1Zpresso J-Max S',  cpr: 90,  npr: 9,  um: 8.8,  adj: 'external' },
  jxpro:  { name: '1Zpresso JX-Pro S', cpr: 40,  npr: 10, um: 12.5, adj: 'top' },
  kultra: { name: '1Zpresso K-Ultra',  cpr: 100, npr: 10, um: 20,   adj: 'external' },
  kmax:   { name: '1Zpresso K-Max',    cpr: 90,  npr: 9,  um: 22,   adj: 'external' },
  q2:     { name: '1Zpresso Q2 / J',   cpr: 30,  npr: 10, um: 25,   adj: 'internal' }
};
// Fasce per metodo in click dallo zero. Verificate solo per X-Ultra (tabella 1Zpresso, riportata da completehomebarista.com).
// start = centro della fascia; est = punto di partenza stimato dai livelli di macinatura 1–7 dell'app.
const GRINDER_RANGES = {
  xultra: {
    v60:       { lo: 80,  hi: 138, start: 109 },
    aeropress: { lo: 64,  hi: 190, start: 109, est: true },
    kalita:    { lo: 82,  hi: 184, start: 116, est: true },
    switch:    { lo: 82,  hi: 184, start: 116, est: true },
    moka:      { lo: 72,  hi: 130, start: 101 },
    coldbrew:  { lo: 159, hi: 240, start: 200 }
  }
};
const GRINDER_EXTRA = {
  xultra: [ { id: 'turkish', lo: 8, hi: 43 }, { id: 'espresso', lo: 36, hi: 75 }, { id: 'frenchpress', lo: 137, hi: 240 } ]
};
const GSTR = {
  it: {
    label: 'Macinino', none: 'Nessuno / altro macinino', guideTitle: 'Guida alla macinatura',
    clicks: 'click', aFew: 'qualche click', oneTwo: '1–2 click',
    refStart: 'Riferimento', range: 'Range', fromZero: 'Click contati dallo zero (bave a contatto).',
    badgeTable: 'fascia 1Zpresso', badgeEst: 'stima', badgeMine: 'tuo setting',
    savePh: 'Il tuo setting: 1.4.9 o 109', save: 'Salva', remove: 'Rimuovi', saved: 'Setting salvato', removed: 'Setting rimosso',
    invalid: 'Valore non valido: usa giri.numero.click (es. 1.4.9) oppure i click totali',
    noPreset: 'Per questo modello non ho fasce verificate: trova il tuo setting e salvalo, lo ritroverai ogni volta per questo metodo.',
    sUm: 'Passo', sCpr: 'Click per giro', sNpr: 'Numeri per giro', sAdj: 'Regolazione',
    adj: { external: 'esterna', top: 'superiore', internal: 'interna' },
    hRead: 'Come leggere i numeri',
    read: (g, ex, exC, cpn) => `Il formato è giri.numero.click. Su ${g.name} 1 giro = ${g.cpr} click = ${g.npr} numeri, 1 numero = ${cpn} click. Esempio: ${ex} = ${exC} click dallo zero.`,
    zero: "Conta sempre dallo zero: gira in senso antiorario fino a sentire resistenza, senza forzare. Antiorario = più fine, orario = più grosso. Se lo 0 del quadrante non coincide con l'indice sul corpo, ricalibra l'anello come indicato dal manuale.",
    hTable: 'Punti di partenza per metodo', thMethod: 'Metodo', thStart: 'Parti da', thRange: 'Range',
    estNote: "* Stima ricavata dai livelli di macinatura 1–7 dell'app, non dalla tabella del produttore.",
    extra: { turkish: 'Turco', espresso: 'Espresso', frenchpress: 'French press' },
    hMine: 'I tuoi setting salvati',
    hDial: 'Come correggere la macinatura', thSymptom: 'Nel bicchiere', thFix: 'Cosa fare',
    dial: (big, small) => [
      ['Acida, sottile, aspra; flusso troppo veloce', `Sotto-estratto: macina più fine di ${big}.`],
      ['Amara, secca, astringente; flusso lento o che si ferma', `Sovra-estratto: macina più grossa di ${big}.`],
      ['Quasi giusta, ma manca qualcosa', `Affina di ${small} alla volta, poi riassaggia.`],
      ['Tazza torbida, con fondo', `Prova più grosso di ${big} e sciacqua bene il filtro.`],
      ['Cold brew debole o acquoso', `Più fine di ${big}, oppure allunga l'infusione di qualche ora.`],
      ['Cold brew amaro o legnoso', `Più grosso di ${big}, oppure accorcia l'infusione.`]
    ],
    rule: 'Cambia una sola cosa per volta (prima la macinatura, poi temperatura e rapporto) e annota il setting nelle note del diario: così sai sempre da dove sei partito.',
    hRoast: 'Tostatura e freschezza',
    roast: (n) => `Tostatura chiara (più densa): parti da ${n} più fine, con acqua un po' più calda. Tostatura scura: ${n} più grossa e acqua più fredda. Caffè tostato da oltre 3 settimane: scendi leggermente più fine.`,
    hCare: 'Manutenzione', care: "Pulisci le bave con pennello e soffietto, mai con l'acqua: può danneggiarle.",
    noGrinder: 'Scegli il tuo macinino dal menu «Macinino» per vedere i click di partenza. Intanto qui trovi le regole per correggere la macinatura.',
    sources: "Fonti: meccanica dei modelli da 1zpresso.coffee/grind-setting; fasce dell'X-Ultra dalla tabella 1Zpresso riportata da completehomebarista.com. Il movimento delle bave non coincide con la dimensione delle particelle: considera tutto un punto di partenza e correggi al gusto.",
    canvasGrinder: 'MACININO'
  },
  en: {
    label: 'Grinder', none: 'None / other grinder', guideTitle: 'Grind guide',
    clicks: 'click', aFew: 'a few clicks', oneTwo: '1–2 clicks',
    refStart: 'Reference', range: 'Range', fromZero: 'Clicks counted from zero (burrs touching).',
    badgeTable: '1Zpresso range', badgeEst: 'estimate', badgeMine: 'your setting',
    savePh: 'Your setting: 1.4.9 or 109', save: 'Save', remove: 'Remove', saved: 'Setting saved', removed: 'Setting removed',
    invalid: 'Invalid value: use rotations.number.click (e.g. 1.4.9) or total clicks',
    noPreset: "I don't have verified ranges for this model: find your setting and save it, and it will be here every time for this method.",
    sUm: 'Step', sCpr: 'Clicks per turn', sNpr: 'Numbers per turn', sAdj: 'Adjustment',
    adj: { external: 'external', top: 'top', internal: 'internal' },
    hRead: 'How to read the numbers',
    read: (g, ex, exC, cpn) => `The format is rotations.number.click. On the ${g.name}, 1 turn = ${g.cpr} clicks = ${g.npr} numbers, 1 number = ${cpn} clicks. Example: ${ex} = ${exC} clicks from zero.`,
    zero: "Always count from zero: turn counter-clockwise until you feel resistance, without forcing. Counter-clockwise = finer, clockwise = coarser. If the dial's 0 doesn't line up with the mark on the body, recalibrate the ring as the manual describes.",
    hTable: 'Starting points by method', thMethod: 'Method', thStart: 'Start at', thRange: 'Range',
    estNote: "* Estimate derived from the app's 1–7 grind levels, not from the maker's table.",
    extra: { turkish: 'Turkish', espresso: 'Espresso', frenchpress: 'French press' },
    hMine: 'Your saved settings',
    hDial: 'How to correct your grind', thSymptom: 'In the cup', thFix: 'What to do',
    dial: (big, small) => [
      ['Sour, thin, sharp; flow too fast', `Under-extracted: grind finer by ${big}.`],
      ['Bitter, dry, astringent; slow or stalling flow', `Over-extracted: grind coarser by ${big}.`],
      ['Almost there, but something is missing', `Fine-tune by ${small} at a time, then taste again.`],
      ['Muddy cup, silty bottom', `Try coarser by ${big} and rinse the filter well.`],
      ['Weak or watery cold brew', `Finer by ${big}, or steep a few hours longer.`],
      ['Bitter or woody cold brew', `Coarser by ${big}, or shorten the steep.`]
    ],
    rule: 'Change one thing at a time (grind first, then temperature and ratio) and write the setting in the diary notes, so you always know where you started.',
    hRoast: 'Roast and freshness',
    roast: (n) => `Light roast (denser): start ${n} finer, with slightly hotter water. Dark roast: ${n} coarser and cooler water. Coffee roasted over 3 weeks ago: go slightly finer.`,
    hCare: 'Care', care: 'Clean the burrs with a brush and blower, never with water: it can damage them.',
    noGrinder: 'Pick your grinder from the "Grinder" menu to see starting clicks. Meanwhile, here are the rules for correcting your grind.',
    sources: "Sources: grinder mechanics from 1zpresso.coffee/grind-setting; X-Ultra ranges from the 1Zpresso table as reported by completehomebarista.com. Burr movement is not the same as particle size: treat everything as a starting point and adjust to taste.",
    canvasGrinder: 'GRINDER'
  }
};
export function gt(k) { return GSTR[state.lang === 'en' ? 'en' : 'it'][k]; }
export function gClicksTxt(n) { return n + ' ' + (state.lang === 'en' && n !== 1 ? 'clicks' : 'click'); }
function gCpn(g) { return g.cpr / g.npr; }
export function gFmtPos(g, c) {
  const cpn = gCpn(g), rem = c % g.cpr;
  return Math.floor(c / g.cpr) + '.' + Math.floor(rem / cpn) + '.' + (rem % cpn);
}
export function gParse(g, txt) {
  txt = String(txt || '').trim().replace(/,/g, '.');
  if (!txt) return null;
  if (/^\d+$/.test(txt)) { const c = parseInt(txt, 10); return c <= 1000 ? c : null; }
  const m = txt.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const r = +m[1], n = +m[2], k = +m[3];
  if (n >= g.npr || k >= gCpn(g)) return null;
  return r * g.cpr + n * gCpn(g) + k;
}
function gStep(g, um) { return Math.max(1, Math.round(um / g.um)); }
export function gSuggest(gk, key) {
  const tbl = GRINDER_RANGES[gk] && GRINDER_RANGES[gk][key];
  if (!tbl) return null;
  const m = METHODS[key], ar = activeRecipe(key);
  const lvl = (ar && ar.grind) || m.grind;
  const step = Math.max(1, Math.round((tbl.hi - tbl.lo) / 8));
  const start = Math.max(tbl.lo, Math.min(tbl.hi, tbl.start + (lvl - m.grind) * step));
  return { start: start, lo: tbl.lo, hi: tbl.hi, est: !!tbl.est };
}
function gMine(gk, key) {
  const s = state.myGrind && state.myGrind[gk] && state.myGrind[gk][key];
  return typeof s === 'number' ? s : null;
}
export function grinderSettingFor(key) {
  const gk = state.grinder;
  if (!gk || !GRINDERS[gk]) return null;
  const mine = gMine(gk, key);
  if (mine != null) return { clicks: mine };
  const s = gSuggest(gk, key);
  return s ? { clicks: s.start } : null;
}

export function renderGrinder() {
  const cur = state.grinder && GRINDERS[state.grinder] ? state.grinder : '';
  $('grinderLabel').textContent = gt('label');
  $('grinderGuideTitle').textContent = gt('guideTitle');
  $('grinderSelect').innerHTML = `<option value="">${gt('none')}</option>` +
    Object.entries(GRINDERS).map(([k, g]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${g.name}</option>`).join('');
  renderGrinderResult(cur);
  renderGrinderGuide(cur);
}

function renderGrinderResult(cur) {
  const box = $('grinderResult');
  if (!cur) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const g = GRINDERS[cur], key = state.method;
  const sug = gSuggest(cur, key), mine = gMine(cur, key);
  const main = (c, badge) => `<div class="gr-main"><span class="gr-pos">${gFmtPos(g, c)}</span><span class="gr-clicks">${gClicksTxt(c)}</span><span class="gr-badge">${badge}</span></div>`;
  const rangeLine = (s, label) => `<div class="gr-range">${label} <b>${gFmtPos(g, s.start)}</b> · ${gt('range')} <b>${gFmtPos(g, s.lo)}</b> – <b>${gFmtPos(g, s.hi)}</b> (${s.lo}–${s.hi})</div>`;
  let html = '';
  if (mine != null) {
    html += main(mine, gt('badgeMine'));
    if (sug) html += rangeLine(sug, gt('refStart'));
  } else if (sug) {
    html += main(sug.start, sug.est ? gt('badgeEst') : gt('badgeTable'));
    html += `<div class="gr-range">${gt('range')} <b>${gFmtPos(g, sug.lo)}</b> – <b>${gFmtPos(g, sug.hi)}</b> (${sug.lo}–${sug.hi})</div>`;
  } else {
    html += `<div class="gr-hint" style="margin-top:0">${gt('noPreset')}</div>`;
  }
  html += `<div class="gr-save"><input class="gr-input" id="grMineInput" type="text" inputmode="decimal" autocomplete="off" placeholder="${gt('savePh')}">` +
    `<button class="gr-btn primary" id="grMineSave" type="button">${gt('save')}</button>` +
    (mine != null ? `<button class="gr-btn" id="grMineRemove" type="button">${gt('remove')}</button>` : '') + `</div>`;
  html += `<div class="gr-hint">${gt('fromZero')}</div>`;
  box.innerHTML = html;
  box.classList.remove('hidden');
  const doSave = () => {
    const c = gParse(g, $('grMineInput').value);
    if (c == null) { showToast(gt('invalid')); return; }
    state.myGrind = state.myGrind || {};
    (state.myGrind[cur] = state.myGrind[cur] || {})[key] = c;
    save(); renderGrinder(); showToast(gt('saved'));
  };
  $('grMineSave').addEventListener('click', doSave);
  $('grMineInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  const rm = $('grMineRemove');
  if (rm) rm.addEventListener('click', () => {
    if (state.myGrind && state.myGrind[cur]) delete state.myGrind[cur][key];
    save(); renderGrinder(); showToast(gt('removed'));
  });
}

function renderGrinderGuide(cur) {
  const g = cur ? GRINDERS[cur] : null;
  const big = g ? gClicksTxt(gStep(g, 40)) : gt('aFew');
  const small = g ? gClicksTxt(gStep(g, 12)) : gt('oneTwo');
  const roastN = g ? gClicksTxt(gStep(g, 30)) : gt('aFew');
  let h = '';
  if (g) {
    const cpn = gCpn(g), exC = g.cpr + 2 * cpn + 1;
    h += `<div class="specs">` +
      `<span class="spec"><b>${gt('sUm')}:</b> ${g.um} µm</span>` +
      `<span class="spec"><b>${gt('sCpr')}:</b> ${g.cpr}</span>` +
      `<span class="spec"><b>${gt('sNpr')}:</b> ${g.npr}</span>` +
      `<span class="spec"><b>${gt('sAdj')}:</b> ${gt('adj')[g.adj]}</span></div>`;
    h += `<h4>${gt('hRead')}</h4><p>${gt('read')(g, gFmtPos(g, exC), exC, cpn)}</p><p>${gt('zero')}</p>`;
    const rng = GRINDER_RANGES[cur];
    if (rng) {
      let rows = '', anyEst = false;
      ORDER.forEach(k => {
        const r = rng[k]; if (!r) return;
        if (r.est) anyEst = true;
        rows += `<tr${k === state.method ? ' class="cur"' : ''}><td>${METHODS[k].name}</td>` +
          `<td class="nowrap"><span class="mono">${gFmtPos(g, r.start)}</span> <small>${r.start}</small>${r.est ? ' *' : ''}</td>` +
          `<td class="nowrap">${gFmtPos(g, r.lo)} – ${gFmtPos(g, r.hi)}</td></tr>`;
      });
      (GRINDER_EXTRA[cur] || []).forEach(x => {
        rows += `<tr><td>${gt('extra')[x.id]}</td><td class="nowrap">-</td><td class="nowrap">${gFmtPos(g, x.lo)} – ${gFmtPos(g, x.hi)}</td></tr>`;
      });
      h += `<h4>${gt('hTable')}</h4><div class="gtable-wrap"><table class="gtable"><thead><tr><th>${gt('thMethod')}</th><th>${gt('thStart')}</th><th>${gt('thRange')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      if (anyEst) h += `<p class="gnote">${gt('estNote')}</p>`;
    } else {
      h += `<p class="gnote">${gt('noPreset')}</p>`;
    }
    let mineRows = '';
    ORDER.forEach(k => {
      const c = gMine(cur, k);
      if (c != null) mineRows += `<tr${k === state.method ? ' class="cur"' : ''}><td>${METHODS[k].name}</td><td class="nowrap"><span class="mono">${gFmtPos(g, c)}</span> <small>${c}</small></td></tr>`;
    });
    if (mineRows) h += `<h4>${gt('hMine')}</h4><div class="gtable-wrap"><table class="gtable"><tbody>${mineRows}</tbody></table></div>`;
  } else {
    h += `<p>${gt('noGrinder')}</p>`;
  }
  const dialRows = gt('dial')(big, small).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  h += `<h4>${gt('hDial')}</h4><div class="gtable-wrap"><table class="gtable"><thead><tr><th>${gt('thSymptom')}</th><th>${gt('thFix')}</th></tr></thead><tbody>${dialRows}</tbody></table></div>`;
  h += `<p>${gt('rule')}</p>`;
  h += `<h4>${gt('hRoast')}</h4><p>${gt('roast')(roastN)}</p>`;
  h += `<h4>${gt('hCare')}</h4><p>${gt('care')}</p>`;
  h += `<div class="gsources">${gt('sources')}</div>`;
  $('grinderGuideBody').innerHTML = h;
}

export function initGrinder() {
  $('grinderSelect').addEventListener('change', e => {
    state.grinder = e.target.value || null;
    save(); renderGrinder();
  });
}
